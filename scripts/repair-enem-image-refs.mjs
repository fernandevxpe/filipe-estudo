#!/usr/bin/env node
/**
 * Recalcula image_refs vazias a partir de prova.json (mesma lógica que build_enem_mcq_items.collect_images_for_question).
 * Corrige casos em que só existia recorte lixo (ex. p2_img3) removido pelo strip — ficam fullpages válidas.
 * Reconstrói data/processed/items_index.json com todos os pools ENEM dia1 + pools_static.json.
 *
 * Uso: node scripts/repair-enem-image-refs.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const processed = path.join(root, "data", "processed");

/** @param {unknown[]} pages */
function collectImagesForQuestion(pages, qn) {
  const byNum = Object.fromEntries(pages.map((p) => [p.page, p]));
  const pat = new RegExp(`quest(ão|ao)\\s*0*${qn}(?!\\d)`, "i");
  let hitPages = pages.filter((p) => pat.test(p.text || "")).map((p) => p.page);
  if (hitPages.length === 0) {
    const pat2 = new RegExp(`QUEST[ÃA]O\\s*0*${qn}(?!\\d)`, "i");
    hitPages = pages.filter((p) => pat2.test(p.text || "")).map((p) => p.page);
  }
  hitPages = [...new Set(hitPages)].sort((a, b) => a - b);
  if (qn <= 5 && hitPages.length) hitPages = [hitPages[0]];

  const seen = new Set();
  const out = [];
  const addList = (xs) => {
    for (const x of xs || []) {
      if (x && !seen.has(x)) {
        seen.add(x);
        out.push(x);
      }
    }
  };
  for (const pnum of hitPages) {
    const prev = byNum[pnum - 1];
    if (prev) {
      addList(prev.image_refs);
      if (prev.full_page_ref) addList([prev.full_page_ref]);
    }
    const cur = byNum[pnum];
    if (cur) {
      addList(cur.image_refs);
      if (cur.full_page_ref) addList([cur.full_page_ref]);
    }
  }
  return out;
}

const BAD_SUFFIXES = ["_p1_img32.png", "_p2_img3.png"];
function stripBad(refs) {
  return refs.filter((r) => !BAD_SUFFIXES.some((s) => r.endsWith(s)));
}

function main() {
  const itemsFiles = fs
    .readdirSync(processed)
    .filter((f) => /^items_enem_\d{4}_dia1_cd[1-4]_ingles\.json$/.test(f));

  let repairedItems = 0;
  let filesTouched = 0;

  for (const fn of itemsFiles) {
    const itemsPath = path.join(processed, fn);
    const raw = fs.readFileSync(itemsPath, "utf8");
    const data = JSON.parse(raw);
    const provaRel = data.generated_from?.prova;
    if (!provaRel) continue;
    const provaPath = path.join(root, provaRel);
    if (!fs.existsSync(provaPath)) {
      console.warn("prova.json ausente:", provaPath);
      continue;
    }
    const prova = JSON.parse(fs.readFileSync(provaPath, "utf8"));
    const pages = prova.pages || [];
    let changed = false;
    for (const it of data.items || []) {
      if (it.source !== "enem" || it.area !== "linguagens") continue;
      const qn = it.question_number;
      if (typeof qn !== "number") continue;
      const refs = it.image_refs || [];
      const cleaned = stripBad(refs);
      const collected = stripBad(collectImagesForQuestion(pages, qn));
      const next =
        cleaned.length === 0 && collected.length > 0
          ? collected
          : cleaned.length !== refs.length
            ? cleaned
            : refs;
      if (JSON.stringify(next) !== JSON.stringify(refs)) {
        it.image_refs = next;
        changed = true;
        repairedItems += 1;
      }
    }
    if (changed) {
      fs.writeFileSync(itemsPath, JSON.stringify(data, null, 2) + "\n", "utf8");
      filesTouched += 1;
    }
  }

  const pools = [];
  const color = { 1: "C1", 2: "C2", 3: "C3", 4: "C4" };
  for (const fn of itemsFiles.sort()) {
    const m = fn.match(/^items_enem_(\d{4})_dia1_cd([1-4])_ingles\.json$/);
    if (!m) continue;
    const y = m[1];
    const c = Number(m[2]);
    const data = JSON.parse(fs.readFileSync(path.join(processed, fn), "utf8"));
    const n = data.item_count ?? (data.items || []).length;
    pools.push({
      id: `enem_${y}_dia1_cd${c}_ingles`,
      path: fn,
      label: `ENEM ${y} — 1º dia — ${color[c]} — Inglês (${n} q)`,
      area: "linguagens",
      kind: "enem",
    });
  }

  const staticPath = path.join(processed, "pools_static.json");
  if (fs.existsSync(staticPath)) {
    const extra = JSON.parse(fs.readFileSync(staticPath, "utf8")).pools || [];
    const have = new Set(pools.map((p) => p.id));
    for (const p of extra) {
      const row = { ...p, kind: p.kind || "extra" };
      if (!have.has(row.id)) {
        pools.push(row);
        have.add(row.id);
      }
    }
  }
  pools.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(
    path.join(processed, "items_index.json"),
    JSON.stringify({ pools }, null, 2) + "\n",
    "utf8"
  );

  console.log(
    `Itens com image_refs corrigidas: ${repairedItems} (em ${filesTouched} ficheiro(s)). items_index: ${pools.length} pools.`
  );
}

main();
