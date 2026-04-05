#!/usr/bin/env node
/**
 * Smoke test do site já deployado (Vercel ou outro).
 *
 * Uso local:
 *   SITE_URL=https://filipe-estudo-tau.vercel.app node scripts/verify-remote.mjs
 *   node scripts/verify-remote.mjs https://filipe-estudo-tau.vercel.app
 *
 * CI: define o secret PRODUCTION_SITE_URL no GitHub com a mesma URL.
 */
const baseRaw = process.env.SITE_URL || process.argv[2];
if (!baseRaw?.trim()) {
  console.error(
    "Defina SITE_URL ou passe a URL como argumento.\n" +
      "  Ex.: SITE_URL=https://filipe-estudo-tau.vercel.app node scripts/verify-remote.mjs"
  );
  process.exit(2);
}
const base = baseRaw.replace(/\/$/, "");

async function get(path) {
  const url = `${base}${path}`;
  const res = await fetch(url, { redirect: "follow" });
  const text = await res.text();
  return { url, res, text };
}

async function main() {
  const home = await get("/");
  console.log(`home: ${home.res.status} ${home.url}`);
  if (!home.res.ok) {
    console.error("A página inicial não devolveu 200 (verifica Deployment Protection / URL).");
    process.exit(1);
  }
  if (!home.text.includes("Filipe") && !home.text.includes("Painel")) {
    console.error("HTML da home não parece ser a app Filipe (conteúdo inesperado).");
    process.exit(1);
  }

  const testPage = await get("/test");
  console.log(`test: ${testPage.res.status} ${testPage.url}`);
  if (!testPage.res.ok) process.exit(1);
  if (!testPage.text.includes("Hello world")) {
    console.error("/test devia conter «Hello world».");
    process.exit(1);
  }

  const dc = await get("/api/deploy-check");
  console.log(`deploy-check: ${dc.res.status} ${dc.url}`);
  if (!dc.res.ok) process.exit(1);
  let j;
  try {
    j = JSON.parse(dc.text);
  } catch {
    console.error("/api/deploy-check não devolveu JSON.");
    process.exit(1);
  }
  if (typeof j.deployMark !== "string") {
    console.error("JSON sem deployMark:", j);
    process.exit(1);
  }
  const sha = j.vercelGitCommitSha || "(vazio — normal fora da Vercel)";
  console.log(`OK — deployMark=${j.deployMark} commit=${sha}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
