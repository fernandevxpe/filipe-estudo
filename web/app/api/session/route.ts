import { NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { loadItemsIndex, loadPoolItems, type QuestionItem } from "@/lib/items";
import { runAudit } from "@/lib/audit";
import { resolveStudyTopic } from "@/lib/studyTopics";
import { readPlanDailyQuestionTarget } from "@/lib/planMeta";
import { tierFromCumulative } from "@/lib/dayTier";
import { parseLogDayParam } from "@/lib/logDay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EntryIn = {
  itemId: string;
  poolId: string;
  choice?: string;
  timeMs: number;
  skipped?: boolean;
};

function stemPreview(stem: string, n = 72): string {
  const t = stem.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

export async function POST(req: Request) {
  let body: {
    sessionKind?: string;
    poolId?: string;
    /** Dia do calendário (YYYY-MM-DD) para gravar daily_log; senão usa a data UTC do envio. */
    forDay?: string;
    answers?: { itemId: string; choice: string; timeMs: number }[];
    entries?: EntryIn[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const idx = loadItemsIndex();
  const poolById = new Map(idx.pools.map((p) => [p.id, p]));

  const resolveItem = (poolId: string, itemId: string): QuestionItem | null => {
    const pool = poolById.get(poolId);
    if (!pool) return null;
    const items = loadPoolItems(pool.path);
    return items.find((i) => i.id === itemId) ?? null;
  };

  let entries: EntryIn[] = [];
  let sessionKind = body.sessionKind || "single";
  let displayPoolId = body.poolId || "mixed";

  if (body.entries && body.entries.length > 0) {
    entries = body.entries;
  } else if (body.poolId && body.answers && body.answers.length > 0) {
    sessionKind = "single";
    displayPoolId = body.poolId;
    entries = body.answers.map((a) => ({
      itemId: a.itemId,
      poolId: body.poolId!,
      choice: a.choice,
      timeMs: a.timeMs,
      skipped: false,
    }));
  } else {
    return NextResponse.json({ error: "entries ou (poolId + answers) obrigatórios" }, { status: 400 });
  }

  const sessionId = crypto.randomUUID();
  const endedAt = new Date().toISOString();
  const startedAt = endedAt;

  let correct = 0;
  let wrong = 0;
  let graded = 0;
  let skipped = 0;
  const auditRows: { time_ms: number; is_correct: number }[] = [];
  const byQuestion: {
    itemId: string;
    poolId: string;
    stemPreview: string;
    choice: string | null;
    correctLetter: string | null;
    isCorrect: boolean | null;
    timeMs: number;
    skipped: boolean;
    study_topic: string;
    area: string;
  }[] = [];
  const wrongTopicCount = new Map<string, number>();

  const db = getDb();
  const insAns = db.prepare(
    `INSERT INTO session_answers (session_id, item_id, choice, correct_letter, is_correct, time_ms, evidence_type, area, study_topic, skipped, source_pool_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insFlag = db.prepare(
    `INSERT INTO audit_flags (session_id, kind, detail, created_at) VALUES (?, ?, ?, ?)`
  );

  for (const e of entries) {
    const it = resolveItem(e.poolId, e.itemId);
    if (!it || it.annulled) continue;

    const isSkip = Boolean(e.skipped) || !(e.choice && String(e.choice).trim());
    const topic = resolveStudyTopic(it);
    const area = it.area || "";

    if (isSkip) {
      skipped += 1;
      insAns.run(
        sessionId,
        e.itemId,
        null,
        (it.correct || "").toUpperCase() || null,
        null,
        e.timeMs ?? 0,
        "objective",
        area || null,
        topic,
        1,
        e.poolId
      );
      byQuestion.push({
        itemId: e.itemId,
        poolId: e.poolId,
        stemPreview: stemPreview(it.stem),
        choice: null,
        correctLetter: it.correct ? String(it.correct).toUpperCase() : null,
        isCorrect: null,
        timeMs: e.timeMs ?? 0,
        skipped: true,
        study_topic: topic,
        area,
      });
      continue;
    }

    const chosen = (e.choice || "").toUpperCase().trim();
    const letter = (it.correct || "").toUpperCase();
    const hasKey = Boolean(letter);
    const isCorrect = hasKey && chosen === letter ? 1 : 0;

    if (hasKey) {
      graded += 1;
      if (isCorrect) correct += 1;
      else {
        wrong += 1;
        wrongTopicCount.set(topic, (wrongTopicCount.get(topic) ?? 0) + 1);
      }
      auditRows.push({ time_ms: e.timeMs, is_correct: isCorrect });
    }

    insAns.run(
      sessionId,
      e.itemId,
      chosen || null,
      letter || null,
      hasKey ? isCorrect : null,
      e.timeMs,
      "objective",
      area || null,
      topic,
      0,
      e.poolId
    );

    byQuestion.push({
      itemId: e.itemId,
      poolId: e.poolId,
      stemPreview: stemPreview(it.stem),
      choice: chosen,
      correctLetter: letter || null,
      isCorrect: hasKey ? isCorrect === 1 : null,
      timeMs: e.timeMs,
      skipped: false,
      study_topic: topic,
      area,
    });
  }

  const score = graded > 0 ? correct / graded : 0;

  db.prepare(
    `INSERT INTO study_sessions (id, pool_id, started_at, ended_at, score, total, correct, session_kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(sessionId, displayPoolId, startedAt, endedAt, score, graded, correct, sessionKind);

  for (const f of runAudit(sessionId, auditRows)) {
    insFlag.run(sessionId, f.kind, f.detail, endedAt);
  }

  const day = parseLogDayParam(body.forDay) ?? endedAt.slice(0, 10);
  const answeredCount = entries.filter((e) => !e.skipped && e.choice && String(e.choice).trim()).length;
  const planTarget = readPlanDailyQuestionTarget();
  const row = db.prepare(`SELECT done_questions, target_questions, correct_cum, graded_cum FROM daily_log WHERE day = ?`).get(
    day
  ) as
    | { done_questions: number; target_questions: number; correct_cum: number | null; graded_cum: number | null }
    | undefined;
  const prev = row?.done_questions ?? 0;
  const newDone = prev + answeredCount;
  const prevC = row?.correct_cum ?? 0;
  const prevG = row?.graded_cum ?? 0;
  const newC = prevC + correct;
  const newG = prevG + graded;

  /** Calendário: ≥70% verde, 30–70% amarelo, &lt;30% ou sem correções vermelho (status espelha o tier). */
  const tier = tierFromCumulative(newC, newG);
  const dayStatus = tier === "green" ? "feito" : tier === "yellow" ? "parcial" : "perdido";

  db.prepare(
    `INSERT INTO daily_log (day, status, done_questions, target_questions, correct_cum, graded_cum)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       status = excluded.status,
       done_questions = excluded.done_questions,
       target_questions = COALESCE(NULLIF(daily_log.target_questions, 0), excluded.target_questions),
       correct_cum = excluded.correct_cum,
       graded_cum = excluded.graded_cum`
  ).run(day, dayStatus, newDone, planTarget, newC, newG);

  const studyGaps = Array.from(wrongTopicCount.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    sessionId,
    correct,
    wrong,
    graded,
    skipped,
    answeredCount,
    score,
    byQuestion,
    studyGaps,
    wrongRefs: byQuestion
      .filter((q) => q.isCorrect === false)
      .map((q) => ({ poolId: q.poolId, itemId: q.itemId })),
  });
}
