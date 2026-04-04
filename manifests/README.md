# Manifests

- `enem_auto.json` — lista gerada pelo script `generate_enem_manifest.py` (anos com padrão INEP `{ano}_PV_impresso_*`).
- `checksums.json` — preenchido após downloads (`download_assets.py --checksums`) com SHA-256 dos arquivos locais.

## ENEM: anos sem URL automática

O servidor `download.inep.gov.br` nem sempre usa o mesmo padrão de nome antes de ~2020. Nesses casos:

1. Acesse a página oficial do ano no INEP e copie os links diretos dos PDFs.
2. Adicione em `manifests/enem_manual_urls.json` no formato:

```json
{
  "2009": [
    {
      "url": "https://...",
      "rel_path": "enem/2009/dia1/azul/prova.pdf",
      "kind": "prova"
    }
  ]
}
```

O `download_assets.py` mescla manifest automático + manual.
