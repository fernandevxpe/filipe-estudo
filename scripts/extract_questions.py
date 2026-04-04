#!/usr/bin/env python3
"""
Extrai texto e imagens de PDFs de prova (ENEM/SSA) para data/processed e data/assets.
Gera índice por página e heurística de blocos de questão (QUESTÃO N).
Gabaritos em PDF têm tratamento limitado: marca como gabarito_bruto no manifesto.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
ASSETS = ROOT / "data" / "assets"


QUESTION_RE = re.compile(r"QUEST[ÃA]O\s*(\d+)", re.IGNORECASE)
# "Questão 01" / "QUESTÃO 1" (com ou sem cedilha/til)
QUESTION_RE_LOOSE = re.compile(r"(?i)quest(ão|ao)\s*0*(\d+)")


def safe_rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def _question_numbers_from_text(text: str) -> list[int]:
    seen: set[int] = set()
    for m in QUESTION_RE_LOOSE.finditer(text):
        seen.add(int(m.group(2)))
    return sorted(seen)


def _render_full_page_png(doc: fitz.Document, page_index: int, asset_dir: Path, file_base: str) -> str | None:
    """Rasteriza a página inteira (figuras vetoriais, pôsteres etc.)."""
    try:
        page = doc.load_page(page_index)
        mat = fitz.Matrix(1.85, 1.85)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        out_png = asset_dir / f"{file_base}_fullpage_p{page_index + 1}.png"
        out_png.parent.mkdir(parents=True, exist_ok=True)
        pix.save(out_png.as_posix())
        return safe_rel(out_png)
    except Exception:
        return None


def extract_pdf(
    pdf_path: Path,
    asset_subdir: Path,
    exam_id: str,
    *,
    fullpage_first_n: int = 0,
) -> dict:
    doc = fitz.open(pdf_path)
    pages_out = []
    asset_dir = ASSETS / asset_subdir
    for i in range(doc.page_count):
        page = doc.load_page(i)
        text = page.get_text("text") or ""
        img_refs = []
        images = page.get_images(full=True)
        for img_index, img in enumerate(images):
            xref = img[0]
            try:
                base = f"{exam_id}_p{i+1}_img{img_index+1}"
                pix = fitz.Pixmap(doc, xref)
                if pix.n - pix.alpha < 4:  # GRAY or RGB
                    out_png = asset_dir / f"{base}.png"
                    out_png.parent.mkdir(parents=True, exist_ok=True)
                    pix.save(out_png.as_posix())
                    img_refs.append(safe_rel(out_png))
                pix = None
            except Exception:
                continue
        q_hits = _question_numbers_from_text(text)
        full_page_ref: str | None = None
        if fullpage_first_n > 0 and i < fullpage_first_n:
            full_page_ref = _render_full_page_png(doc, i, asset_dir, f"{exam_id}")
        row: dict = {
            "page": i + 1,
            "text": text.strip(),
            "image_refs": img_refs,
            "question_numbers_hint": sorted(set(q_hits)),
        }
        if full_page_ref:
            row["full_page_ref"] = full_page_ref
        pages_out.append(row)
    doc.close()
    return {
        "source_pdf": safe_rel(pdf_path),
        "exam_id": exam_id,
        "page_count": len(pages_out),
        "pages": pages_out,
    }


def infer_exam_id(pdf_path: Path) -> str:
    parts = [p for p in pdf_path.relative_to(RAW).parts]
    return "__".join(parts).replace("/", "__").replace(".pdf", "")


def guess_gabarito_confidence(path: Path) -> str:
    name = path.name.lower()
    if "preliminar" in name:
        return "preliminary"
    if "definitiv" in name:
        return "definitive"
    return "unknown"


def walk_enem_pdfs(limit: int | None) -> list[Path]:
    base = RAW / "enem"
    if not base.exists():
        return []
    provas = sorted(base.rglob("prova.pdf"))
    if limit:
        provas = provas[:limit]
    return provas


def walk_ssa_cadernos(limit: int | None) -> list[Path]:
    base = RAW / "ssa"
    if not base.exists():
        return []
    cadernos = [
        p
        for p in base.rglob("*.pdf")
        if "caderno" in p.name.lower() or p.name.upper().startswith("SSA")
    ]
    # priorizar cadernos de prova (não gabarito isolado)
    cadernos = [p for p in cadernos if "gabarito" not in p.name.lower()]
    cadernos = sorted(set(cadernos))
    if limit:
        cadernos = cadernos[:limit]
    return cadernos


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=["enem", "ssa", "file"], default="enem")
    ap.add_argument("--pdf", type=Path, help="Caminho absoluto ou relativo ao ROOT")
    ap.add_argument("--limit", type=int, default=0, help="Limitar quantidade de PDFs (0=todos)")
    ap.add_argument("--out-subdir", default="", help="Subpasta em data/processed")
    args = ap.parse_args()
    limit = args.limit if args.limit and args.limit > 0 else None

    manifest = {"items": [], "gabaritos": []}

    if args.source == "file":
        if not args.pdf:
            ap.error("--pdf obrigatório com --source file")
        pdf_path = args.pdf if args.pdf.is_absolute() else ROOT / args.pdf
        if not pdf_path.exists():
            print("PDF não encontrado:", pdf_path, file=sys.stderr)
            return 1
        exam_id = infer_exam_id(pdf_path) if RAW in pdf_path.parents else pdf_path.stem
        sub = Path(args.out_subdir) if args.out_subdir else Path("manual")
        data = extract_pdf(pdf_path, sub, exam_id, fullpage_first_n=10)
        out = PROCESSED / sub / f"{exam_id}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        manifest["items"].append(safe_rel(out))
    else:
        pdfs = walk_enem_pdfs(limit) if args.source == "enem" else walk_ssa_cadernos(limit)
        for pdf_path in pdfs:
            exam_id = infer_exam_id(pdf_path)
            rel_under_raw = pdf_path.relative_to(RAW)
            asset_subdir = rel_under_raw.parent
            out = PROCESSED / rel_under_raw.with_suffix(".json")
            out.parent.mkdir(parents=True, exist_ok=True)
            fp = 10 if pdf_path.name == "prova.pdf" and "enem" in pdf_path.parts else 0
            data = extract_pdf(pdf_path, asset_subdir, exam_id, fullpage_first_n=fp)
            out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            manifest["items"].append(safe_rel(out))

        # registrar gabaritos (sem extração profunda)
        gab = (RAW / "enem").rglob("gabarito.pdf") if args.source == "enem" else (RAW / "ssa").rglob("*GABARITO*.pdf")
        for g in sorted(set(gab)):
            manifest["gabaritos"].append(
                {
                    "pdf": safe_rel(g),
                    "confidence": guess_gabarito_confidence(g),
                    "note": "Parse de gabarito PDF não implementado; use leitura humana ou futura extração por OCR.",
                }
            )

    manifest_path = PROCESSED / "extraction_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Manifest:", manifest_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
