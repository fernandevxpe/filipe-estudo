#!/usr/bin/env node
/**
 * Remove image_refs lixo: sufixos conhecidos + PNGs em disco com faixa horizontal/vertical típica de bug (alinhado a web/lib/imageRefsServer.ts).
 * Percorre recursivamente todos os .json em data/processed (exceto items_index se não existir lógica).
 *
 * Uso: node scripts/strip-bad-image-refs.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const processed = path.join(root, "data", "processed");

const BAD_SUFFIXES = ["_p1_img32.png", "_p2_img3.png"];
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isBadRef(ref) {
  if (typeof ref !== "string") return false;
  if (BAD_SUFFIXES.some((s) => ref.endsWith(s))) return true;
  if (!ref.toLowerCase().endsWith(".png") || ref.includes("..")) return false;
  const full = path.resolve(root, ref.replace(/^\/+/, ""));
  const allow = path.resolve(root, "data", "assets");
  if (!full.startsWith(allow) || !fs.existsSync(full)) return false;
  const st = fs.statSync(full);
  if (st.size < 24) return false;
  const head = Buffer.allocUnsafe(24);
  const fd = fs.openSync(full, "r");
  try {
    fs.readSync(fd, head, 0, 24, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (!head.subarray(0, 8).equals(PNG_SIG)) return false;
  const w = head.readUInt32BE(16);
  const h = head.readUInt32BE(20);
  if (h > 0 && w > 0 && h <= 120 && w >= 600 && st.size < 25_000) return true;
  if (h > 0 && w > 0 && w <= 80 && h >= 400 && st.size < 50_000) return true;
  return false;
}

function stripRefs(arr) {
  if (!Array.isArray(arr)) return 0;
  const before = arr.length;
  const next = arr.filter((r) => !isBadRef(r));
  arr.length = 0;
  arr.push(...next);
  return before - next.length;
}

function walk(obj, stats) {
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) {
    for (const el of obj) walk(el, stats);
    return;
  }
  if (typeof obj !== "object") return;
  if (Array.isArray(obj.image_refs)) {
    const removed = stripRefs(obj.image_refs);
    if (removed) stats.refsRemoved += removed;
  }
  for (const k of Object.keys(obj)) walk(obj[k], stats);
}

function main() {
  const stats = { files: 0, refsRemoved: 0 };
  function scanDir(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) scanDir(full);
      else if (name.endsWith(".json")) {
        const raw = fs.readFileSync(full, "utf8");
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          console.warn("JSON inválido, ignorado:", full);
          continue;
        }
        walk(data, stats);
        const out = JSON.stringify(data, null, 2) + "\n";
        if (out !== raw) {
          fs.writeFileSync(full, out, "utf8");
          stats.files += 1;
        }
      }
    }
  }
  scanDir(processed);
  console.log(
    stats.files
      ? `Atualizados ${stats.files} ficheiro(s); removidas ${stats.refsRemoved} referência(s) lixo.`
      : "Nada a alterar — referências lixo já ausentes ou inexistentes."
  );
}

main();
