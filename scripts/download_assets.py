#!/usr/bin/env python3
"""
Baixa provas e gabaritos ENEM (INEP) e PDFs SSA UPE (páginas procesoYYYY).
Grava em data/raw/ conforme README. Suporta checksums e log.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import certifi
import requests
import urllib3
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
MANIFEST_DIR = ROOT / "manifests"
CHECKSUMS_PATH = MANIFEST_DIR / "checksums.json"

INEP_BASE = "https://download.inep.gov.br/enem/provas_e_gabaritos/"
UPE_PROCESSO = "http://processodeingresso.upe.pe.gov.br/processo{year}"

SESSION = requests.Session()
SESSION.headers.update(
    {
        "User-Agent": "FilipeStudyBot/1.0 (+educational; contact: local)",
        "Accept": "*/*",
    }
)
SESSION.verify = certifi.where()

LOG = logging.getLogger("download_assets")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def download_one(url: str, dest: Path, retries: int = 3) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(retries):
        tmp_path: str | None = None
        try:
            r = SESSION.get(url, stream=True, timeout=120)
            if r.status_code != 200:
                LOG.warning("HTTP %s %s", r.status_code, url)
                return False
            fd, tmp_path = tempfile.mkstemp(dir=dest.parent, suffix=".part")
            with os.fdopen(fd, "wb") as f:
                for chunk in r.iter_content(chunk_size=65536):
                    if chunk:
                        f.write(chunk)
            os.replace(tmp_path, dest)
            return True
        except Exception as e:
            LOG.warning("tentativa %s falhou %s: %s", attempt + 1, url, e)
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
            time.sleep(2 ** attempt)
    return False


def enem_urls_for_year(year: int) -> list[tuple[str, Path]]:
    """Padrão confirmado 2020–2024: D1 CD1–4, D2 CD5–8."""
    out: list[tuple[str, Path]] = []
    mapping_day1 = [(1, n) for n in range(1, 5)]
    mapping_day2 = [(2, n) for n in range(5, 9)]
    for day, cd in mapping_day1 + mapping_day2:
        base = f"{year}_PV_impresso_D{day}_CD{cd}"
        gb = f"{year}_GB_impresso_D{day}_CD{cd}"
        cor = {1: "cd1", 2: "cd2", 3: "cd3", 4: "cd4", 5: "cd5", 6: "cd6", 7: "cd7", 8: "cd8"}[cd]
        out.append((f"{INEP_BASE}{base}.pdf", RAW / "enem" / str(year) / f"dia{day}" / cor / "prova.pdf"))
        out.append((f"{INEP_BASE}{gb}.pdf", RAW / "enem" / str(year) / f"dia{day}" / cor / "gabarito.pdf"))
    return out


def download_enem(years: list[int], skip_existing: bool) -> None:
    for y in years:
        for url, dest in enem_urls_for_year(y):
            if skip_existing and dest.exists() and dest.stat().st_size > 1000:
                LOG.info("pula (existe) %s", dest.relative_to(ROOT))
                continue
            LOG.info("baixando %s", url)
            ok = download_one(url, dest)
            if not ok:
                LOG.error("falhou %s", url)


def load_manual_enem() -> list[tuple[str, Path, str]]:
    p = MANIFEST_DIR / "enem_manual_urls.json"
    if not p.exists():
        return []
    data = json.loads(p.read_text(encoding="utf-8"))
    entries = data.get("entries") or []
    rows = []
    for e in entries:
        rows.append((e["url"], ROOT / "data" / "raw" / e["rel_path"], e.get("kind", "file")))
    return rows


def scrape_ssa_pdf_urls(year: int) -> list[tuple[str, str]]:
    """Retorna (abs_url, fase) com fase ssa1|ssa2|ssa3."""
    page = UPE_PROCESSO.format(year=year)
    r = SESSION.get(page, timeout=60)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    found: list[tuple[str, str]] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href.lower().endswith(".pdf"):
            continue
        if "/arquivos/ssa1/" in href.replace("\\", "/"):
            phase = "ssa1"
        elif "/arquivos/ssa2/" in href.replace("\\", "/"):
            phase = "ssa2"
        elif "/arquivos/ssa3/" in href.replace("\\", "/"):
            phase = "ssa3"
        else:
            continue
        abs_u = urljoin(page + "/", href)
        found.append((abs_u, phase))
    # dedupe por URL
    seen = set()
    uniq = []
    for u, ph in found:
        if u in seen:
            continue
        seen.add(u)
        uniq.append((u, ph))
    return uniq


def download_ssa(years: list[int], skip_existing: bool) -> None:
    for y in years:
        try:
            pairs = scrape_ssa_pdf_urls(y)
        except Exception as e:
            LOG.error("SSA scrape %s: %s", y, e)
            continue
        for url, phase in pairs:
            name = Path(urlparse(url).path).name
            dest = RAW / "ssa" / str(y) / phase / name
            if skip_existing and dest.exists() and dest.stat().st_size > 100:
                LOG.info("pula (existe) %s", dest.relative_to(ROOT))
                continue
            LOG.info("SSA %s %s", y, url)
            download_one(url, dest)


def write_checksums() -> None:
    sums: dict[str, str] = {}
    for base in [RAW / "enem", RAW / "ssa"]:
        if not base.exists():
            continue
        for pdf in base.rglob("*.pdf"):
            rel = pdf.relative_to(ROOT).as_posix()
            try:
                sums[rel] = sha256_file(pdf)
            except OSError:
                continue
    CHECKSUMS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CHECKSUMS_PATH.write_text(json.dumps(sums, indent=2, sort_keys=True), encoding="utf-8")
    LOG.info("checksums: %s arquivos -> %s", len(sums), CHECKSUMS_PATH)


def main() -> int:
    parser = argparse.ArgumentParser(description="Download ENEM + SSA UPE oficiais")
    parser.add_argument("--all", action="store_true", help="ENEM (2020-2024) + SSA (2013-2024) + manual ENEM")
    parser.add_argument("--enem", action="store_true")
    parser.add_argument("--ssa", action="store_true")
    parser.add_argument("--checksums", action="store_true", help="Só recalcular checksums.json")
    parser.add_argument("--no-skip", action="store_true", help="Re-baixar mesmo se arquivo existir")
    parser.add_argument(
        "--enem-years",
        type=str,
        default="2020,2021,2022,2023,2024,2025",
        help="Anos ENEM separados por vírgula (padrão INEP recente; 2025+ se já publicado)",
    )
    parser.add_argument(
        "--ssa-years",
        type=str,
        default="2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024",
        help="Anos processo UPE",
    )
    parser.add_argument(
        "--insecure",
        action="store_true",
        help="Desabilita verificação SSL (use só se certifi falhar no seu Mac/ambiente)",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if args.insecure:
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        SESSION.verify = False

    if args.checksums:
        write_checksums()
        return 0

    skip = not args.no_skip
    enem_years = [int(x.strip()) for x in args.enem_years.split(",") if x.strip()]
    ssa_years = [int(x.strip()) for x in args.ssa_years.split(",") if x.strip()]

    if args.all or args.enem:
        download_enem(enem_years, skip)
        for url, dest, _kind in load_manual_enem():
            if skip and dest.exists():
                continue
            LOG.info("manual ENEM %s", url)
            download_one(url, dest)

    if args.all or args.ssa:
        download_ssa(ssa_years, skip)

    if not args.all and not args.enem and not args.ssa:
        parser.print_help()
        return 1

    write_checksums()
    return 0


if __name__ == "__main__":
    sys.exit(main())
