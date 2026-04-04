import fs from "fs";
import path from "path";
import { getRepoRoot } from "@/lib/repoRoot";
import { loadItemsIndex, loadPoolItems, type PoolInfo, type QuestionItem } from "@/lib/items";
import { toPublicItem, type PublicQuestionItem } from "@/lib/itemPublic";

export type DiagnosticConfigFile = {
  anchorDate: string;
  poolRotation: string[];
  weekdayQuestionSpans: Record<string, [number, number]>;
  saturday?: { count: number; useOnlyWeekPool?: boolean };
  queueChunkSize?: number;
};

const WD_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function loadConfig(): DiagnosticConfigFile {
  const p = path.join(getRepoRoot(), "data", "diagnostic_config.json");
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw) as DiagnosticConfigFile;
}

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  const u = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const v = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((v - u) / 86400000);
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleDeterministic<T>(arr: T[], seedStr: string): T[] {
  const out = [...arr];
  const rnd = mulberry32(hashSeed(seedStr));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function poolById(idx: { pools: PoolInfo[] }, id: string): PoolInfo | undefined {
  return idx.pools.find((p) => p.id === id);
}

function itemsInRange(poolPath: string, qFrom: number, qTo: number): QuestionItem[] {
  const all = loadPoolItems(poolPath);
  return all.filter((it) => it.question_number >= qFrom && it.question_number <= qTo && !it.annulled);
}

export type DiagnosticDayPayload = {
  mode: "calendar";
  date: string;
  weekday: number;
  weekdayName: string;
  weekIndex: number;
  poolId: string | null;
  poolLabel: string | null;
  note: string | null;
  items: PublicQuestionItem[];
};

export function buildDiagnosticDayForDate(isoDate: string): DiagnosticDayPayload {
  const cfg = loadConfig();
  const idx = loadItemsIndex();
  const anchor = parseIsoLocal(cfg.anchorDate);
  const day = parseIsoLocal(isoDate);
  const wd = day.getDay();
  const weekIndex = Math.floor(Math.max(0, daysBetween(anchor, day)) / 7);
  const poolIds = cfg.poolRotation.length ? cfg.poolRotation : idx.pools.map((p) => p.id);
  const weekPoolId = poolIds[weekIndex % poolIds.length];
  const weekPool = poolById(idx, weekPoolId);

  if (wd === 0) {
    return {
      mode: "calendar",
      date: isoDate,
      weekday: wd,
      weekdayName: WD_NAMES[wd],
      weekIndex,
      poolId: null,
      poolLabel: null,
      note: "Domingo sem bloco de questões no plano — avance para outro dia.",
      items: [],
    };
  }

  if (wd === 6) {
    const count = cfg.saturday?.count ?? 24;
    const useWeekOnly = cfg.saturday?.useOnlyWeekPool === true;
    const byItemId = new Map<string, { pool: PoolInfo; item: QuestionItem }>();
    const poolsToScan = useWeekOnly && weekPool ? [weekPool] : idx.pools.filter((p) => p.kind === "enem");
    for (const p of poolsToScan) {
      for (const it of loadPoolItems(p.path)) {
        if (it.annulled) continue;
        if (!byItemId.has(it.id)) byItemId.set(it.id, { pool: p, item: it });
      }
    }
    const candidates = Array.from(byItemId.values());
    const shuffled = shuffleDeterministic(candidates, `sat-${isoDate}`);
    const picked = shuffled.slice(0, count);
    const items = picked.map(({ pool, item }) => toPublicItem(pool.id, item));
    return {
      mode: "calendar",
      date: isoDate,
      weekday: wd,
      weekdayName: WD_NAMES[wd],
      weekIndex,
      poolId: weekPoolId,
      poolLabel: weekPool?.label ?? null,
      note: `Sábado: amostra de ${count} questões (ordem fixa para esta data).`,
      items,
    };
  }

  const span = cfg.weekdayQuestionSpans[String(wd)];
  if (!span || !weekPool) {
    return {
      mode: "calendar",
      date: isoDate,
      weekday: wd,
      weekdayName: WD_NAMES[wd],
      weekIndex,
      poolId: weekPoolId,
      poolLabel: weekPool?.label ?? null,
      note: "Configuração incompleta ou pool da semana não encontrado.",
      items: [],
    };
  }
  const [qFrom, qTo] = span;
  const raw = itemsInRange(weekPool.path, qFrom, qTo).sort((a, b) => a.question_number - b.question_number);
  const items = raw.map((it) => toPublicItem(weekPool.id, it));
  return {
    mode: "calendar",
    date: isoDate,
    weekday: wd,
    weekdayName: WD_NAMES[wd],
    weekIndex,
    poolId: weekPool.id,
    poolLabel: weekPool.label,
    note: `Semana ${weekIndex + 1} · ${weekPool.label} · questões ${qFrom}–${qTo}.`,
    items,
  };
}

export type DiagnosticQueuePayload = {
  mode: "queue";
  dayIndex: number;
  chunkSize: number;
  totalItems: number;
  totalDays: number;
  items: PublicQuestionItem[];
  note: string | null;
};

export function buildDiagnosticQueueDay(dayIndex: number): DiagnosticQueuePayload {
  const cfg = loadConfig();
  const chunk = Math.max(1, cfg.queueChunkSize ?? 10);
  const idx = loadItemsIndex();
  const flat: { pool: PoolInfo; item: QuestionItem }[] = [];
  const sortedPools = [...idx.pools].sort((a, b) => a.id.localeCompare(b.id));
  for (const pool of sortedPools) {
    const items = loadPoolItems(pool.path).filter((it) => !it.annulled);
    items.sort((a, b) => a.question_number - b.question_number);
    for (const item of items) flat.push({ pool, item });
  }
  const totalItems = flat.length;
  const totalDays = Math.max(1, Math.ceil(totalItems / chunk));
  const safeIndex = Math.max(0, Math.min(dayIndex, totalDays - 1));
  const start = safeIndex * chunk;
  const slice = flat.slice(start, start + chunk);
  const items = slice.map(({ pool, item }) => toPublicItem(pool.id, item));
  return {
    mode: "queue",
    dayIndex: safeIndex,
    chunkSize: chunk,
    totalItems,
    totalDays,
    items,
    note: `Fila completa do acervo · dia ${safeIndex + 1} de ${totalDays} · ${chunk} questões por dia.`,
  };
}
