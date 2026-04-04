# Guia de temas — ENEM (ancorado em provas reais)

Este guia organiza **eixos do ENEM** e subtemas. Os **IDs de questão** estáveis são gerados pelo pipeline (`exam_id__qNN`) a partir de PDFs oficiais; após rodar `extract_questions.py` e `build_enem_mcq_items.py`, cada item em `data/processed/items_*.json` pode receber tags manuais ou semi-automáticas (palavras-chave no enunciado).

## Eixos e subtemas típicos

### Linguagens, Códigos e suas Tecnologias

| Subtema | Indicadores no texto | Prioridade 1º ano |
|--------|----------------------|-------------------|
| Interpretação de texto | comando de inferência, função, efeito de sentido | Alta |
| Gêneros discursivos | notícia, carta, crônica, propagand | Alta |
| Variação linguística | uso situacional, regionalismo, preconceito | Alta |
| Literatura | escolas, figuras, intertextualidade | Média |
| Língua estrangeira (Inglês ou Espanhol) | Q1–5 exclusivas + vocabulário | Alta |

### Matemática e suas Tecnologias

| Subtema | Notas | Prioridade 1º ano |
|--------|-------|-------------------|
| Números e grandezas | porcentagem, razão, regra de três | Alta |
| Funções (afim, quadrática) | leitura de gráficos | Alta |
| Geometria plana | semelhança, áreas | Média |
| Probabilidade e estatística | gráficos, interpretação | Média |

### Ciências da Natureza

| Subtema | Notas | Prioridade 1º ano |
|--------|-------|-------------------|
| Ecologia e energia | cadeias, sustentabilidade | Média |
| Física contextualizada | cinemática básica, energia | Média |
| Química do cotidiano | pH, reações simples | Média |
| Biologia celular e corpo humano | sistemas, DNA básico | Média |

### Ciências Humanas

| Subtema | Notas | Prioridade 1º ano |
|--------|-------|-------------------|
| História Brasil e geral | períodos, documentos | Alta |
| Geografia | espaço agrário/urbano, clima | Alta |
| Filosofia/Sociologia | pensadores, conceitos | Média |
| Atualidades | conexão com contexto | Alta |

## Como ampliar este guia com dados

1. Processar mais cadernos (`scripts/extract_questions.py --source enem`).
2. Gerar itens com gabarito (`scripts/build_enem_mcq_items.py` por dia/cor/língua).
3. Classificar por tag (CSV ou campo `tags[]` no JSON).
4. Rodar contagem por tag (script futuro `scripts/topic_frequency.py`).

## Eras do ENEM (peso na análise)

| Era | Observação |
|-----|------------|
| Até 2008 | Formato distinto; usar com cautela |
| 2009+ triênio | Alinhado ao ensino médio atual |
| 2020+ digital/impressa híbrida | **Maior peso** em ranking de incidência |

Fonte oficial de provas: [INEP — ENEM provas e gabaritos](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacoes-e-exames-educacionais/enem/provas-e-gabaritos).
