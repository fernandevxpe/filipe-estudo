# Integração WhatsApp (fase final)

Esta etapa fica **depois** do app web estável. **Ainda não foi executada** no projeto: existe apenas o *stub* em `web/app/api/whatsapp/webhook/route.ts` para quando você configurar a API da Meta ou um provedor. Objetivo: grupo com Filipe + responsável + bot para lembretes, links da sessão e recebimento de mídia (foto/áudio).

## Opções técnicas

| Abordagem | Prós | Contras |
|-----------|------|---------|
| **Meta Cloud API** (oficial) | Confiável, documentação clara | Exige app Meta Business, aprovação |
| **Provedor** (Twilio, Z-API, etc.) | Menos burocracia inicial | Custo e lock-in |

## Fluxo sugerido (híbrido)

1. Bot envia no grupo: “Hoje: 10 questões — abrir [URL do app]/study”.
2. Filipe responde no app; painel registra tentativas.
3. Opcional: envio de **foto** da redação ou rascunho → webhook grava URL no storage + referência em `audit_flags` com `evidence_type: photo`.

## Endpoint no projeto

- `GET/POST` [web/app/api/whatsapp/webhook/route.ts](../web/app/api/whatsapp/webhook/route.ts) — stub com verificação por `WHATSAPP_VERIFY_TOKEN`.

## Variáveis de ambiente (exemplo)

```
WHATSAPP_VERIFY_TOKEN=seu_token_secreto
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
```

## Próximos passos de implementação

1. Criar app no Meta for Developers e configurar webhook apontando para o domínio público do Next.js.
2. Mapear `from` (telefone) → usuário interno (tabela `users` futura).
3. Enfileirar mídias em objeto storage (S3, R2, ou disco com backup).
