# Template de rotina semanal — Filipe (1º ano, base ENEM + SSA)

## Parâmetros configuráveis

| Parâmetro | Valor sugerido | Notas |
|-----------|----------------|-------|
| Questões/dia (seg–sex) | 10 ± 2 | Subir +1 a cada mês com aderência ≥ 80% |
| Revisão espaçada | 5–8 questões | Tópicos dos últimos 7 dias |
| Mini vestibular | **Sábado** *ou* **quinzenal** (domingo alternado) | `modo: sabado` recomendado para ritmo |
| Tempo máximo/dia | 90–120 min | Respeitar semi-integral |

## Segunda a sexta — esqueleto

| Dia | Bloco 1 (40–45 min) | Bloco 2 (35–40 min) | Bloco 3 (15–20 min) |
|-----|---------------------|---------------------|---------------------|
| Seg | Linguagens (prova real) | Matemática (prova real) | Revisão espaçada |
| Ter | Humanas | Natureza | Leitura + anotações |
| Qua | Matemática | Linguagens | Revisão espaçada |
| Qui | Natureza | Humanas | Redação (rascunho ou plano) |
| Sex | **Consolidação** — mistura das 4 áreas | Erros da semana no app | — |

## Sábado — mini vestibular

- **Duração 1º bimestre:** 90 min.
- **Conteúdo:** 24–36 questões reais (amostra balanceada) + 2 questões com imagem obrigatória.
- **Correção:** imediata no app; exportar PDF de erros para pasta `docs/feedback/YYYY-MM-DD.md` (opcional).

## Quinzenal (alternativa ao sábado)

Se `modo: quinzenal`, o mini vestibular cai no **sábado par** (semana ISO par), mantendo sextas leves antes.

## Vídeos complementares

- Consultar [data/curadoria_videos.json](../data/curadoria_videos.json).
- Após cada sessão, buscar no YouTube com o `youtube_query` do tópico com maior erro.

## IA / resumos

- Resumo **somente** após sessão: listar 3 erros + 1 padrão + 1 ação para o dia seguinte.

## Evidências (auditoria)

- Objetivas: tempo por questão registrado no app.
- Discursivas/redação: foto ou áudio quando configurado.
- Flag automática “revisar humano” se tempo médio por bloco < limiar (configurável no app).
