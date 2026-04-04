#!/usr/bin/env node
/**
 * Copia `data/assets` (raiz do monorepo) → `web/public/data/assets` para servir como estático (Vercel CDN).
 * Executado antes de `next build`.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const repoRoot = path.join(webRoot, "..");
const src = path.join(repoRoot, "data", "assets");
const dest = path.join(webRoot, "public", "data", "assets");

if (!fs.existsSync(src)) {
  console.warn("prepare-public-assets: ../data/assets não encontrado — skip.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log("prepare-public-assets: OK → public/data/assets");
