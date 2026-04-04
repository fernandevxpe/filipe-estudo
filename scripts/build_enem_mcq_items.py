#!/usr/bin/env python3
"""
Monta itens de múltipla escolha a partir de:
  - JSON gerado por extract_questions.py (prova)
  - PDF de gabarito oficial (texto selecionável)

Uso típico (1º dia, caderno azul, língua inglesa):
  python scripts/build_enem_mcq_items.py \\
    --prova-json data/processed/enem/2024/dia1/cd1/prova.json \\
    --gabarito-pdf data/raw/enem/2024/dia1/cd1/gabarito.pdf \\
    --lingua ingles \\
    --out data/processed/items_enem_2024_dia1_cd1_ingles.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]

QUESTION_START = re.compile(r"QUEST[ÃA]O\s*(\d+)", re.IGNORECASE)
OPTION_LINE = re.compile(r"^([A-E])\s+(.+)$", re.MULTILINE)


def full_text_from_prova_json(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    parts = []
    for p in data.get("pages", []):
        parts.append(p.get("text") or "")
    return "\n\n".join(parts)


def parse_gabarito_linguagens(pdf_path: Path, lingua: str) -> dict[int, str]:
    """Extrai mapa questão -> letra para área Linguagens (1-45), conforme coluna Inglês ou Espanhol."""
    doc = fitz.open(pdf_path)
    raw = "\n".join((doc[i].get_text("text") or "") for i in range(doc.page_count))
    doc.close()
    lingua = lingua.lower().strip()
    if lingua not in ("ingles", "espanhol"):
        raise ValueError("lingua deve ser ingles ou espanhol")

    # Trecho típico: linha "INGLÊS" / "ESPANHOL" seguida de pares para Q1-5
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    col_idx = 0 if lingua == "ingles" else 1
    answers: dict[int, str] = {}
    i = 0
    while i < len(lines):
        if lines[i].upper().replace("Ê", "E") in ("INGLES", "INGLÊS", "ESPANHOL"):
            # próximas linhas: pode ser cabeçalho duplo na mesma linha ou linhas separadas
            pass
        i += 1

    # Parser robusto: após "INGLÊS" e "ESPANHOL" na mesma linha ou consecutivas
    joined = "\n".join(lines)
    block_match = re.search(
        r"INGL[ÊE]S\s+ESPANHOL\s*\n((?:\d+\s+[A-E]\s+[A-E]\s*\n)+)",
        joined,
        re.IGNORECASE,
    )
    if block_match:
        for m in re.finditer(r"^(\d+)\s+([A-E])\s+([A-E])\s*$", block_match.group(1), re.MULTILINE):
            q = int(m.group(1))
            if q <= 5:
                letter = m.group(2) if col_idx == 0 else m.group(3)
                answers[q] = letter

    # Questões 6-45: uma coluna única após o bloco bilíngue
    # Procurar sequência "6\nE\n7\nC" após "5 E A" ou similar
    tail_match = re.search(
        r"(?:^|\n)6\s*\n([A-E])\s*\n7\s*\n([A-E])",
        joined,
        re.MULTILINE,
    )
    if not tail_match:
        return answers

    start_idx = joined.find(tail_match.group(0))
    chunk = joined[start_idx:]
    nums = re.findall(r"(?:^|\n)(\d{1,2})\s*\n([A-E])\s*(?=\n|$)", chunk, re.MULTILINE)
    for num_s, letter in nums:
        q = int(num_s)
        if 6 <= q <= 45:
            answers[q] = letter
    return answers


def split_questions(full_text: str) -> list[tuple[int, str]]:
    """Retorna lista (numero, bloco_texto) para cada QUESTÃO encontrada."""
    matches = list(QUESTION_START.finditer(full_text))
    if not matches:
        return []
    out: list[tuple[int, str]] = []
    for i, m in enumerate(matches):
        qn = int(m.group(1))
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
        block = full_text[start:end].strip()
        out.append((qn, block))
    return out


def extract_options(block: str) -> tuple[str, dict[str, str]]:
    """
    Separa enunciado (até a alternativa A) e opções A–E.

    Muitos ENEM usam ``A\\ttexto``; em 2020 aparece ``A \\t texto`` (espaço antes do tab).
    O padrão antigo ``^A(\\t|  )`` quebrava: capturava linhas como ``A relação entre...``
    (artigo + espaço) e cortava o enunciado no meio.
    """
    # Tab obrigatório na alternativa — não confunde com "A relação", "Acesso", etc.
    pat_tab = re.compile(r"(?m)^\s*([A-E])\s*\t\s*(.+)$")
    tab_matches = list(pat_tab.finditer(block))
    start_i = next((i for i, m in enumerate(tab_matches) if m.group(1) == "A"), None)
    if start_i is not None:
        first_a = tab_matches[start_i]
        stem = block[: first_a.start()].strip()
        opts: dict[str, str] = {}
        for m in tab_matches[start_i:]:
            k = m.group(1)
            if k not in opts:
                opts[k] = m.group(2).strip()
            if len(opts) == 5:
                break
        if len(opts) >= 5:
            return stem, opts

    # Fallback: anos com alternativas só com espaços (sem tab)
    first_opt = re.search(r"(?m)^\s*([A-E])(\t| {2,}|\s{3,})(.+)$", block)
    if not first_opt:
        return block.strip(), {}
    stem = block[: first_opt.start()].strip()
    opts = {}
    for m in re.finditer(r"(?m)^\s*([A-E])(?:\t| {2,}|\s{3,})(.+)$", block):
        opts[m.group(1)] = m.group(2).strip()
    return stem, opts


def slice_linguagens_for_lingua(full: str, lingua: str) -> str:
    """
    Remove bloco da outra língua estrangeira (Q1-5 duplicadas no caderno).
    Inglês: texto até antes de 'opção espanhol' + texto a partir de 'Questões de 06'.
    Espanhol: texto da seção espanhola + comum a partir da Q6.
    """
    low = full.lower()
    mark_es = "questões de 01 a 05 (opção espanhol)"
    mark_en = "questões de 01 a 05 (opção inglês)"
    mark_06 = "questões de 06 a 45"
    if lingua.lower() == "ingles":
        if mark_es in low:
            i = low.find(mark_es)
            head = full[:i]
            j = low.find(mark_06)
            tail = full[j:] if j >= 0 else ""
            return head + "\n\n" + tail
        return full
    # espanhol
    if mark_en in low and mark_es in low:
        i = low.find(mark_es)
        j = low.find(mark_06)
        tail = full[j:] if j >= 0 else ""
        return full[i:j] + "\n\n" + tail if j > i else full[i:]
    return full


def collect_images_for_question(prova_data: dict, qn: int) -> list[str]:
    """
    Junta recortes embutidos + página inteira rasterizada (full_page_ref).
    Pôsteres do ENEM costumam estar na página anterior ao texto da questão (ex.: figura p.1, enunciado p.2).
    """
    pages = prova_data.get("pages", [])
    by_num = {int(p["page"]): p for p in pages}
    pat = re.compile(rf"(?i)quest(ão|ao)\s*0*{qn}(?!\d)")
    hit_pages = [int(p["page"]) for p in pages if pat.search(p.get("text") or "")]
    if not hit_pages:
        pat2 = re.compile(rf"QUEST[ÃA]O\s*0*{qn}(?!\d)", re.I)
        hit_pages = [int(p["page"]) for p in pages if pat2.search(p.get("text") or "")]
    if not hit_pages:
        return []

    # Q1–5 existem em inglês e espanhol no mesmo caderno; para o recorte de língua usamos a 1ª ocorrência (folhas menores).
    hit_pages = sorted(set(hit_pages))
    if qn <= 5:
        hit_pages = [hit_pages[0]]

    seen: set[str] = set()
    out: list[str] = []

    def add_list(xs: list[str]) -> None:
        for x in xs:
            if x and x not in seen:
                seen.add(x)
                out.append(x)

    for pnum in hit_pages:
        prev = by_num.get(pnum - 1)
        if prev:
            add_list(prev.get("image_refs") or [])
            fp = prev.get("full_page_ref")
            if fp:
                add_list([fp])
        cur = by_num.get(pnum)
        if cur:
            add_list(cur.get("image_refs") or [])
            fp = cur.get("full_page_ref")
            if fp:
                add_list([fp])
    return out


def build_items(
    prova_json: Path,
    gabarito_pdf: Path,
    lingua: str,
    area_max_q: int = 45,
) -> list[dict]:
    raw_full = full_text_from_prova_json(prova_json)
    full = slice_linguagens_for_lingua(raw_full, lingua)
    gab = parse_gabarito_linguagens(gabarito_pdf, lingua)
    items: list[dict] = []
    exam_id = json.loads(prova_json.read_text(encoding="utf-8")).get("exam_id", "enem")

    prova_data = json.loads(prova_json.read_text(encoding="utf-8"))

    seen: set[int] = set()
    for qn, block in split_questions(full):
        if qn < 1 or qn > area_max_q:
            continue
        if qn in seen:
            continue
        stem, opts = extract_options(block)
        if len(opts) < 5:
            continue
        seen.add(qn)
        letter = gab.get(qn)
        status = "ok" if letter else "no_gabarito"
        imgs = collect_images_for_question(prova_data, qn)

        items.append(
            {
                "id": f"{exam_id}__q{qn:02d}",
                "source": "enem",
                "exam_id": exam_id,
                "question_number": qn,
                "area": "linguagens",
                "lingua_estrangeira": lingua,
                "stem": stem,
                "options": [{"key": k, "text": opts[k]} for k in sorted(opts.keys())],
                "correct": letter,
                "status": status,
                "annulled": False,
                "image_refs": imgs,
            }
        )
    items.sort(key=lambda x: x["question_number"])
    return items


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prova-json", type=Path, required=True)
    ap.add_argument("--gabarito-pdf", type=Path, required=True)
    ap.add_argument("--lingua", choices=["ingles", "espanhol"], default="ingles")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    prova = args.prova_json if args.prova_json.is_absolute() else ROOT / args.prova_json
    gab = args.gabarito_pdf if args.gabarito_pdf.is_absolute() else ROOT / args.gabarito_pdf
    out = args.out if args.out.is_absolute() else ROOT / args.out

    if not prova.exists() or not gab.exists():
        print("Arquivos não encontrados", file=sys.stderr)
        return 1

    items = build_items(prova, gab, args.lingua)
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_from": {"prova": str(prova.relative_to(ROOT)), "gabarito": str(gab.relative_to(ROOT))},
        "item_count": len(items),
        "items": items,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Itens:", len(items), "->", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
