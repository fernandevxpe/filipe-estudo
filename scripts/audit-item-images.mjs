#!/usr/bin/env node
/**
 * Audita image_refs em data/processed/items_*.json:
 * - arquivo ausente, vazio, não-PNG onde esperado, faixas “lixo” (baixa altura + larga + arquivo pequeno).
 *
 * Uso: node scripts/audit-item-images.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const processed = path.join(root, "data", "processed");

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function scanRef(ref, ctx) {
  const issues = [];
  const full = path.resolve(path.join(root, ref.replace(/^\/+/, "")));
  const allow = path.resolve(path.join(root, "data", "assets"));
  if (!full.startsWith(allow)) {
    issues.push("fora de data/assets");
    return issues;
  }
  if (!fs.existsSync(full)) {
    issues.push("arquivo inexistente");
    return issues;
  }
  const st = fs.statSync(full);
  if (st.size === 0) issues.push("arquivo vazio");
  if (ref.toLowerCase().endsWith(".png")) {
    const head = Buffer.allocUnsafe(Math.min(st.size, 24));
    const fd = fs.openSync(full, "r");
    try {
      fs.readSync(fd, head, 0, head.length, 0);
    } finally {
      fs.closeSync(fd);
    }
    if (head.length < 8 || !head.subarray(0, 8).equals(PNG_SIG)) issues.push("não é PNG válido");
    else if (head.length >= 24) {
      const w = head.readUInt32BE(16);
      const h = head.readUInt32BE(20);
      if (h > 0 && w > 0 && h <= 120 && w >= 600 && st.size < 25_000) issues.push(`faixa horizontal suspeita ${w}x${h}`);
      if (h > 0 && w > 0 && w <= 80 && h >= 400 && st.size < 50_000) issues.push(`faixa vertical suspeita ${w}x${h}`);
    }
  }
  return issues;
}

const rows = [];
for (const fn of fs.readdirSync(processed)) {
  if (!fn.startsWith("items_") || !fn.endsWith(".json") || fn === "items_index.json") continue;
  const j = JSON.parse(fs.readFileSync(path.join(processed, fn), "utf8"));
  for (const it of j.items || []) {
    for (const ref of it.image_refs || []) {
      const issues = scanRef(ref, { item: it.id, file: fn });
      for (const msg of issues) {
        rows.push({ ref, item: it.id, file: fn, msg });
      }
    }
  }
}

if (rows.length === 0) {
  console.log("OK — nenhum problema encontrado nos items_*.json.");
  process.exit(0);
}

console.log("Problemas:", rows.length);
for (const r of rows) {
  console.log(`[${r.msg}] ${r.file} :: ${r.item}\n  ${r.ref}`);
}
process.exit(1);
