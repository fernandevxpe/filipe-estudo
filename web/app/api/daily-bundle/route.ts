import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getRepoRoot } from "@/lib/repoRoot";
import { loadItemsIndex, loadPoolItems, type PoolInfo, type QuestionItem } from "@/lib/items";
import { toPublicItem } from "@/lib/itemPublic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MixConfig = {
  total_target?: number;
  from_kind?: Record<string, number>;
};

type RefIn = { poolId: string; itemId: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function poolKind(p: PoolInfo): string {
  if (p.kind) return p.kind;
  if (p.id.startsWith("enem_")) return "enem";
  return "extra";
}

function poolsByKind(idx: ReturnType<typeof loadItemsIndex>): Record<string, PoolInfo[]> {
  const out: Record<string, PoolInfo[]> = { enem: [], ssa: [], extra: [] };
  for (const p of idx.pools) {
    const k = poolKind(p);
    if (out[k]) out[k].push(p);
    else out.extra.push(p);
  }
  return out;
}

function pickFromPool(
  pool: PoolInfo,
  n: number,
  taken: Set<string>,
  area?: string | null
): QuestionItem[] {
  let all = loadPoolItems(pool.path).filter((i) => !i.annulled && !taken.has(i.id));
  if (area) all = all.filter((i) => (i.area || "").toLowerCase() === area.toLowerCase());
  return shuffle(all).slice(0, n);
}

function loadMixConfig(): MixConfig {
  try {
    const raw = fs.readFileSync(path.join(getRepoRoot(), "data", "daily_mix_config.json"), "utf-8");
    return JSON.parse(raw) as MixConfig;
  } catch {
    return { total_target: 15, from_kind: { enem: 10, ssa: 3, extra: 2 } };
  }
}

function tryKind(
  kind: string,
  want: number,
  pools: PoolInfo[],
  taken: Set<string>,
  picked: { poolId: string; item: QuestionItem; kind: string }[],
  summary: { enem: number; ssa: number; extra: number },
  area?: string | null
) {
  if (want <= 0 || pools.length === 0) return;
  let need = want;
  const pls = shuffle([...pools]);
  while (need > 0) {
    let progressed = false;
    for (const pool of pls) {
      if (need <= 0) break;
      const batch = pickFromPool(pool, 1, taken, area);
      if (batch.length === 0) continue;
      progressed = true;
      const it = batch[0];
      taken.add(it.id);
      picked.push({ poolId: pool.id, item: it, kind });
      if (kind === "enem") summary.enem++;
      else if (kind === "ssa") summary.ssa++;
      else summary.extra++;
      need--;
    }
    if (!progressed) break;
  }
}

export async function POST(req: Request) {
  let body: {
    limit?: number;
    area?: string | null;
    onlyRefs?: RefIn[];
  } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const idx = loadItemsIndex();
  const byId = new Map(idx.pools.map((p) => [p.id, p]));

  if (body.onlyRefs && body.onlyRefs.length > 0) {
    const items: ReturnType<typeof toPublicItem>[] = [];
    const taken = new Set<string>();
    for (const r of body.onlyRefs) {
      const pool = byId.get(r.poolId);
      if (!pool) continue;
      const all = loadPoolItems(pool.path);
      const it = all.find((i) => i.id === r.itemId);
      if (!it || it.annulled) continue;
      if (taken.has(it.id)) continue;
      taken.add(it.id);
      items.push(toPublicItem(pool.id, it));
    }
    shuffle(items);
    const lim = Math.min(body.limit ?? items.length, items.length, 90);
    return NextResponse.json({
      mode: "retry_wrong",
      mixSummary: { enem: 0, ssa: 0, extra: 0, total: Math.min(lim, items.length) },
      items: items.slice(0, lim),
    });
  }

  const mix = loadMixConfig();
  const fromKind = { enem: mix.from_kind?.enem ?? 10, ssa: mix.from_kind?.ssa ?? 3, extra: mix.from_kind?.extra ?? 2 };
  let total = mix.total_target ?? 15;
  if (body.limit && body.limit > 0) total = Math.min(90, body.limit);

  const sumPlanned = fromKind.enem + fromKind.ssa + fromKind.extra;
  if (sumPlanned > 0 && sumPlanned !== total) {
    const scale = total / sumPlanned;
    fromKind.enem = Math.max(0, Math.round(fromKind.enem * scale));
    fromKind.ssa = Math.max(0, Math.round(fromKind.ssa * scale));
    fromKind.extra = Math.max(0, Math.round(fromKind.extra * scale));
  }

  const grouped = poolsByKind(idx);
  const taken = new Set<string>();
  const picked: { poolId: string; item: QuestionItem; kind: string }[] = [];
  const summary = { enem: 0, ssa: 0, extra: 0 };

  tryKind("enem", fromKind.enem, grouped.enem, taken, picked, summary, body.area ?? null);
  tryKind("ssa", fromKind.ssa, grouped.ssa, taken, picked, summary, body.area ?? null);
  tryKind("extra", fromKind.extra, grouped.extra, taken, picked, summary, body.area ?? null);

  let deficit = total - picked.length;
  const fallback: { k: string; pools: PoolInfo[] }[] = [
    { k: "enem", pools: grouped.enem },
    { k: "ssa", pools: grouped.ssa },
    { k: "extra", pools: grouped.extra },
  ];
  while (deficit > 0) {
    const before = picked.length;
    for (const { k, pools } of shuffle(fallback)) {
      if (picked.length >= total) break;
      tryKind(k, 1, pools, taken, picked, summary, body.area ?? null);
    }
    if (picked.length === before) break;
    deficit = total - picked.length;
  }

  shuffle(picked);

  return NextResponse.json({
    mode: "daily_mixed",
    mixSummary: { ...summary, total: picked.length },
    items: picked.map((p) => toPublicItem(p.poolId, p.item)),
  });
}
