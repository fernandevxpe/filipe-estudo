#!/usr/bin/env bash
# Executa download → extração ENEM → itens Linguagens (inglês) → índice para o app.
# Uso: ./scripts/run_pipeline.sh   (da raiz do repositório)
# WhatsApp não faz parte deste script (última fase manual).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -q -r scripts/requirements.txt

echo "== Download ENEM + SSA (use --insecure por SSL em alguns Mac) =="
.venv/bin/python scripts/download_assets.py --all --insecure

echo "== Extração ENEM (todos os prova.pdf) =="
.venv/bin/python scripts/extract_questions.py --source enem

echo "== Itens MCQ Linguagens + items_index.json =="
.venv/bin/python scripts/batch_enem_linguagens_items.py

echo "== Opcional: amostra SSA =="
.venv/bin/python scripts/extract_questions.py --source ssa --limit 20

echo "Pronto. Suba o app: cd web && npm install && npm run dev"
