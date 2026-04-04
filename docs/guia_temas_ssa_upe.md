# Guia de temas — SSA UPE (Pernambuco)

O **Sistema Seriado de Avaliação (SSA)** da UPE possui três fases (**SSA 1, 2 e 3**), com pesos 3, 3 e 4 no resultado final do processo. As provas são **objetivas** (e redação conforme edital por ano), com tempo prolongado (4 h ou 4 h 30 conforme fase).

## Estrutura típica (referência pedagógica)

> A matriz exata varia por edital; sempre validar no **manual** do ano em `data/raw/ssa/{ano}/ssa{N}/`.

| Área comum | Observação |
|------------|------------|
| Linguagens | Português, literatura, língua estrangeira (conforme caderno) |
| Matemática | Fundamentos até nível médio completo no arcabouço das fases |
| Ciências da Natureza | Biologia, Química, Física integradas |
| Ciências Humanas | História, Geografia, Filosofia/Sociologia |

## Fontes de PDF no projeto

- Download automático: `scripts/download_assets.py --ssa` (varre `processo{ano}` e links `./arquivos/ssa*/`).
- Arquivos relevantes para estudo: `*CADERNO*PROVAS*.pdf`, `*GABARITO*.pdf` (preliminar vs definitivo — ver campo `confidence` em `extraction_manifest.json`).

## Ancoragem em questões reais

1. Rodar `scripts/extract_questions.py --source ssa --limit N` sobre cadernos baixados.
2. Os JSON em `data/processed/ssa/...` trazem `pages[].text` e `image_refs` para figuras.
3. O parser MCQ específico SSA pode ser estendido (similar a `build_enem_mcq_items.py`) quando o padrão de enunciado for estável no seu recorte de anos.

## Diferenças pedagógicas vs ENEM

| Aspecto | ENEM | SSA UPE |
|---------|------|---------|
| Ritmo | Dois dias, muitas questões | Fases seriadas, foco em aprovação acumulada |
| Pesos | TRI (ENEM) | Combinação das notas das fases (conferir edital) |
| Alinhamento | Nacional | Institucional (UPE) |

Site oficial: [processodeingresso.upe.pe.gov.br](https://processodeingresso.upe.pe.gov.br/).
