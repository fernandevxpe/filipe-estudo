import fs from "fs";
import path from "path";

/**
 * Raiz do monorepo Filipe (onde existem `data/assets`, `data/processed`, etc.).
 * Aceita `FILIPE_REPO_ROOT` e tenta cwd comum (`web/`, raiz do repo ou um nível acima).
 */
export function getRepoRoot(): string {
  const env = process.env.FILIPE_REPO_ROOT;
  if (env) {
    const r = path.resolve(env);
    if (fs.existsSync(path.join(r, "data", "processed"))) return r;
  }
  const cwd = path.resolve(process.cwd());
  // Build deploy: dados em web/data (Vercel Root = web). Só exigimos processed aqui para o trace
  // não puxar data/assets inteiro para serverless — assets vão em public/data/assets.
  if (fs.existsSync(path.join(cwd, "data", "processed"))) {
    return cwd;
  }
  const candidates = [path.resolve(cwd, ".."), cwd, path.resolve(cwd, "..", "..")];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "data", "processed"))) return root;
  }
  return path.resolve(cwd, "..");
}
