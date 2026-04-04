# Deploy na Vercel (Filipe · app web)

## O que já está preparado no código

- **`outputFileTracingRoot`**: o Next inclui `data/processed` e restantes ficheiros lidos em servidor no bundle serverless.
- **Imagens**: no build, `data/assets` é copiado para `web/public/data/assets` e servido como ficheiro estático (evita o limite de tamanho das funções serverless).
- **SQLite**: na Vercel a base fica em `/tmp` (ephemeral — histórico pode resetar entre deploys ou cold starts; para persistência futura use Turso/PlanetScale/etc.).
- **`NEXT_PUBLIC_VERCEL_ENV`**: definido no `next.config.mjs` a partir de `VERCEL_ENV` para as figuras usarem URLs estáticas em produção/preview.

## O que precisas de fazer (checklist)

### 1. Git + GitHub

Na pasta **raiz do monorepo** (`Filipe/`, onde estão `data/` e `web/`):

```bash
git init
git add .
git commit -m "chore: preparar deploy Vercel"
```

Cria um repositório **vazio** no GitHub (sem README) e liga o remoto:

```bash
git remote add origin https://github.com/TEU_USER/filipe-estudo.git
git branch -M main
git push -u origin main
```

**Nota:** o primeiro push pode demorar (centenas de MB por causa dos PNG em `data/assets`). Se o GitHub avisar o limite, usa [Git LFS](https://git-lfs.com/) para `*.png` ou comprime assets.

### 2. Conta Vercel

1. Entra em [vercel.com](https://vercel.com) e faz login (podes usar “Continue with GitHub”).
2. **Add New Project** → importa o repositório **`fernandevxpe/filipe-estudo`** (autoriza a Vercel no GitHub se pedir).
3. **Root Directory** → clica em **Edit** e define **`web`** (obrigatório: é aí que está o `package.json` com Next.js).
4. **Framework Preset**: Next.js (automático).
5. **Build Command** / **Install Command**: deixa os defaults (`npm run build` e `npm install` **dentro de `web/`**).
6. **Deploy**.

O clone do GitHub inclui a pasta `data/` na raiz do repo; o script `sync-repo-data.mjs` copia `data/` → `web/data/` no início de cada build.

### 3. Depois do primeiro deploy

- Abre o URL tipo `https://filipe-estudo.vercel.app`.
- Testa **Atividades**, figuras e painel.
- No telemóvel: “Adicionar ao ecrã inicial” para usar como PWA.

### 4. Variáveis de ambiente (opcional)

Nada é obrigatório para o MVP. Se no futuro usares `FILIPE_REPO_ROOT`, define-o no painel da Vercel.

## Problemas comuns

| Sintoma | Causa provável |
|--------|----------------|
| Build falha por tamanho | Muitos assets; Git LFS ou alojar imagens noutro storage. |
| Figuras 404 | `data/assets` não está no repo ou o build não correu `prepare-public-assets.mjs`. |
| JSON/API 500 | `data/processed` em falta no commit ou caminho errado. |
| Dados do painel “somem” | SQLite em `/tmp` na Vercel não é permanente. |

## Domínio próprio (opcional)

No projeto Vercel: **Settings → Domains** e segue o assistente (o domínio pago é à parte do plano Hobby).
