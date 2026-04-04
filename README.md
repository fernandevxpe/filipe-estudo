# Filipe — ENEM + SSA UPE

Sistema de estudo baseado em provas reais para **Filipe Monteiro** (1º ano EM), com foco em **ENEM** e **SSA UPE** (Pernambuco).

## Estrutura

| Pasta | Conteúdo |
|-------|-----------|
| `data/raw/enem/{ano}/dia{N}/{cor}/` | PDFs oficiais INEP (não versionados) |
| `data/raw/ssa/{ano}/ssa{1\|2\|3}/` | Cadernos e gabaritos UPE |
| `data/processed/` | JSON de questões e índices |
| `data/assets/` | Recortes de imagens por questão |
| `manifests/` | URLs oficiais + checksums esperados |
| `docs/` | Guias de temas, prioridades, calendário, rotina |
| `scripts/` | Download, extração, utilitários |
| `web/` | App Next.js (PWA): questões, pontuação, dashboard |

## Início rápido

```bash
cd /Users/fernandoxpe/Fernandev/Filipe
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt

# Pipeline completo (download ENEM+SSA, extração ENEM, itens Linguagens + items_index.json)
chmod +x scripts/run_pipeline.sh
./scripts/run_pipeline.sh

# Ou manualmente:
# Baixar provas (requer rede; PDFs ficam em data/raw/)
# Use --insecure se aparecer erro de certificado SSL no Python (comum em alguns macOS).
python scripts/download_assets.py --all --insecure

# Cobertura ENEM automática: 2020–2024 (padrão `{ano}_PV_impresso_*` no INEP).
# Anos anteriores: preencha manifests/enem_manual_urls.json com links oficiais do INEP.

# Extrair amostra / processar PDFs presentes (texto + figuras embutidas + raster das 10 primeiras páginas para pôsteres vetoriais)
python scripts/extract_questions.py --source enem --limit 1

# Montar itens de múltipla escolha (ENEM + gabarito PDF)
python scripts/build_enem_mcq_items.py \\
  --prova-json data/processed/enem/2024/dia1/cd1/prova.json \\
  --gabarito-pdf data/raw/enem/2024/dia1/cd1/gabarito.pdf \\
  --lingua ingles \\
  --out data/processed/items_enem_2024_dia1_cd1_ingles.json

# Regenerar todos os pools Linguagens (inglês) e `items_index.json` (ignora anos com gabarito incompatível, ex. 2021)
python scripts/batch_enem_linguagens_items.py

# App web (painel + sessão + API SQLite)
cd web && npm install && npm run dev
# Abra http://localhost:3000 — use `--insecure` no download Python se o SSL falhar.
```

### WhatsApp (última fase)

Ver [docs/whatsapp_integracao.md](docs/whatsapp_integracao.md) e o stub em `web/app/api/whatsapp/webhook/route.ts`.

## Fontes oficiais

- ENEM: [INEP — Provas e gabaritos](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacoes-e-exames-educacionais/enem/provas-e-gabaritos)
- SSA UPE: [Processo de ingresso UPE](https://processodeingresso.upe.pe.gov.br/)

## Aluno

- **Nome:** Filipe Monteiro  
- **Série:** 1º ano (EM)  
- **Início planejado:** abril/2026 (pós-Páscoa)
