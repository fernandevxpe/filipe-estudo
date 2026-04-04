#!/usr/bin/env python3
"""
Regenera itens Linguagens (inglês) para ENEM dia 1, cadernos cd1–cd4, e grava data/processed/items_index.json.
Ignora anos em que o gabarito não casa com o parser (ex.: formato diferente).
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"

MIN_ITEMS = 40  # abaixo disso, ano/caderno provavelmente com parser quebrado


def main() -> int:
    pools: list[dict] = []
    enem_root = ROOT / "data" / "raw" / "enem"
    years = sorted(p.name for p in enem_root.iterdir() if p.is_dir() and p.name.isdigit())

    for y in years:
        for c in range(1, 5):
            prova_json = PROC / "enem" / y / "dia1" / f"cd{c}" / "prova.json"
            gab = ROOT / "data" / "raw" / "enem" / y / "dia1" / f"cd{c}" / "gabarito.pdf"
            if not prova_json.exists() or not gab.exists():
                continue
            out_name = f"items_enem_{y}_dia1_cd{c}_ingles.json"
            out_path = PROC / out_name
            r = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts" / "build_enem_mcq_items.py"),
                    "--prova-json",
                    str(prova_json),
                    "--gabarito-pdf",
                    str(gab),
                    "--lingua",
                    "ingles",
                    "--out",
                    str(out_path),
                ],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
            )
            if r.returncode != 0:
                print(r.stderr, file=sys.stderr)
                continue
            data = json.loads(out_path.read_text(encoding="utf-8"))
            n = data.get("item_count", 0)
            if n < MIN_ITEMS:
                print(f"pula {y} cd{c}: só {n} itens", file=sys.stderr)
                out_path.unlink(missing_ok=True)
                continue
            color = {1: "C1", 2: "C2", 3: "C3", 4: "C4"}.get(c, str(c))
            pools.append(
                {
                    "id": f"enem_{y}_dia1_cd{c}_ingles",
                    "path": out_name,
                    "label": f"ENEM {y} — 1º dia — {color} — Inglês ({n} q)",
                    "area": "linguagens",
                    "kind": "enem",
                }
            )
            print(f"ok {y} cd{c} -> {n} itens")

    if not any(p.get("kind") == "enem" for p in pools):
        print(
            "Nenhum pool ENEM foi gerado (dependências em falta?). items_index.json não foi alterado.",
            file=sys.stderr,
        )
        return 1

    pools.sort(key=lambda p: p["id"])
    static_path = PROC / "pools_static.json"
    if static_path.exists():
        extra = json.loads(static_path.read_text(encoding="utf-8")).get("pools") or []
        have = {p["id"] for p in pools}
        for p in extra:
            p = {**p, "kind": p.get("kind") or "extra"}
            if p["id"] not in have:
                pools.append(p)
                have.add(p["id"])
        pools.sort(key=lambda p: p["id"])
    idx = {"pools": pools}
    (PROC / "items_index.json").write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")
    print("items_index.json:", len(pools), "pools")
    return 0


if __name__ == "__main__":
    sys.exit(main())
