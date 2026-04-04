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
    if (fs.existsSync(path.join(r, "data", "assets"))) return r;
  }
  const candidates = [path.resolve(process.cwd(), ".."), path.resolve(process.cwd()), path.resolve(process.cwd(), "..", "..")];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "data", "assets"))) return root;
  }
  return path.resolve(process.cwd(), "..");
}
