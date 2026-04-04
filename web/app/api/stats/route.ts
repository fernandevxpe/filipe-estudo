import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { dayPctLabel, tierFromCumulative, type DayTier } from "@/lib/dayTier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pct(c: number, a: number) {
  return a > 0 ? Math.round((c / a) * 1000) / 10 : 0;
}

export async function GET() {
  const db = getDb();
  const sessions = db
    .prepare(
      `SELECT id, pool_id, started_at, ended_at, score, total, correct FROM study_sessions ORDER BY ended_at DESC LIMIT 50`
    )
    .all() as {
    id: string;
    pool_id: string;
    started_at: string;
    ended_at: string;
    score: number;
    total: number;
    correct: number;
  }[];

  const daysRaw = db
    .prepare(
      `SELECT day, status, target_questions, done_questions, notes, correct_cum, graded_cum
       FROM daily_log
       WHERE day >= date('now', '-800 days')
       ORDER BY day DESC`
    )
    .all() as {
    day: string;
    status: string;
    target_questions: number;
    done_questions: number;
    notes: string | null;
    correct_cum: number | null;
    graded_cum: number | null;
  }[];

  const days = daysRaw.map((d) => {
    const c = d.correct_cum ?? 0;
    const g = d.graded_cum ?? 0;
    const tier: DayTier = tierFromCumulative(c, g);
    return {
      ...d,
      correct_cum: c,
      graded_cum: g,
      tier,
      dayPct: dayPctLabel(c, g),
    };
  });

  const flags = db
    .prepare(
      `SELECT id, session_id, kind, detail, created_at FROM audit_flags ORDER BY created_at DESC LIMIT 30`
    )
    .all();

  let studyProgress: {
    totals: { answered: number; correct: number; wrong: number; pct: number };
    byArea: { key: string; label: string; answered: number; correct: number; wrong: number; pct: number }[];
    needsWork: { topic: string; areaKey: string; areaLabel: string; wrong: number; answered: number; pct: number }[];
    goingWell: { key: string; label: string; answered: number; pct: number }[];
  } = {
    totals: { answered: 0, correct: 0, wrong: 0, pct: 0 },
    byArea: [],
    needsWork: [],
    goingWell: [],
  };

  const areaLabel: Record<string, string> = {
    geral: "Geral",
    linguagens: "Linguagens",
    matematica: "Matemática",
    humanas: "Ciências Humanas",
    natureza: "Ciências da Natureza",
    mista: "Misto",
    outros: "Outros",
  };

  try {
    const totalRow = db
      .prepare(
        `SELECT
          SUM(CASE WHEN COALESCE(skipped,0)=0 AND is_correct IS NOT NULL THEN 1 ELSE 0 END) AS answered,
          SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct,
          SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) AS wrong
        FROM session_answers`
      )
      .get() as { answered: number | null; correct: number | null; wrong: number | null };

    const answered = totalRow.answered ?? 0;
    const correct = totalRow.correct ?? 0;
    const wrong = totalRow.wrong ?? 0;

    const byAreaRaw = db
      .prepare(
        `SELECT
          LOWER(TRIM(COALESCE(NULLIF(area, ''), 'geral'))) AS cat,
          SUM(CASE WHEN COALESCE(skipped,0)=0 AND is_correct IS NOT NULL THEN 1 ELSE 0 END) AS answered,
          SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct,
          SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) AS wrong
        FROM session_answers
        GROUP BY cat
        HAVING answered > 0`
      )
      .all() as { cat: string; answered: number; correct: number; wrong: number }[];

    const byTopicRaw = db
      .prepare(
        `SELECT
          COALESCE(NULLIF(TRIM(study_topic), ''), 'Geral') AS topic,
          LOWER(TRIM(COALESCE(NULLIF(area, ''), 'geral'))) AS cat,
          SUM(CASE WHEN COALESCE(skipped,0)=0 AND is_correct IS NOT NULL THEN 1 ELSE 0 END) AS answered,
          SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct,
          SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) AS wrong
        FROM session_answers
        GROUP BY topic, cat
        HAVING answered > 0`
      )
      .all() as { topic: string; cat: string; answered: number; correct: number; wrong: number }[];

    const byArea = byAreaRaw
      .map((r) => ({
        key: r.cat,
        label: areaLabel[r.cat] || r.cat.charAt(0).toUpperCase() + r.cat.slice(1),
        answered: r.answered,
        correct: r.correct,
        wrong: r.wrong,
        pct: pct(r.correct, r.answered),
      }))
      .sort((a, b) => b.answered - a.answered);

    const needsWork = byTopicRaw
      .filter((r) => r.wrong > 0)
      .map((r) => ({
        topic: r.topic,
        areaKey: r.cat,
        areaLabel: areaLabel[r.cat] || r.cat,
        wrong: r.wrong,
        answered: r.answered,
        pct: pct(r.correct, r.answered),
      }))
      .sort((a, b) => b.wrong - a.wrong || a.pct - b.pct)
      .slice(0, 10);

    const goingWell = byArea
      .filter((r) => r.answered >= 3 && r.pct >= 65)
      .map((r) => ({ key: r.key, label: r.label, answered: r.answered, pct: r.pct }))
      .slice(0, 6);

    studyProgress = {
      totals: {
        answered,
        correct,
        wrong,
        pct: pct(correct, answered),
      },
      byArea,
      needsWork,
      goingWell,
    };
  } catch {
    /* colunas antigas: ignora bloco de progresso */
  }

  const dailySeriesRaw = db
    .prepare(
      `SELECT day, correct_cum, graded_cum, done_questions, target_questions
       FROM daily_log
       WHERE day >= date('now', '-120 days')
       ORDER BY day ASC`
    )
    .all() as {
    day: string;
    correct_cum: number | null;
    graded_cum: number | null;
    done_questions: number;
    target_questions: number;
  }[];

  const dailySeries = dailySeriesRaw.map((r) => {
    const c = r.correct_cum ?? 0;
    const g = r.graded_cum ?? 0;
    return {
      day: r.day,
      label: r.day.slice(8, 10) + "/" + r.day.slice(5, 7),
      graded: g,
      correct: c,
      pct: g > 0 ? Math.round((c / g) * 1000) / 10 : null as number | null,
      done_questions: r.done_questions,
      target_questions: r.target_questions,
    };
  });

  const volumeByDay = db
    .prepare(
      `SELECT
         substr(ended_at, 1, 10) AS d,
         COUNT(*) AS sessions,
         SUM(total) AS questions,
         SUM(correct) AS correct
       FROM study_sessions
       WHERE length(ended_at) >= 10 AND ended_at >= date('now', '-90 days')
       GROUP BY substr(ended_at, 1, 10)
       ORDER BY d ASC`
    )
    .all() as { d: string; sessions: number; questions: number; correct: number }[];

  const volumeDayCatRows = db
    .prepare(
      `SELECT
         substr(s.ended_at, 1, 10) AS d,
         LOWER(TRIM(COALESCE(NULLIF(a.area, ''), 'geral'))) AS cat,
         SUM(CASE WHEN COALESCE(a.skipped,0)=0 AND a.is_correct IS NOT NULL THEN 1 ELSE 0 END) AS answered,
         SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM session_answers a
       JOIN study_sessions s ON s.id = a.session_id
       WHERE length(s.ended_at) >= 10
         AND substr(s.ended_at, 1, 10) >= date('now', '-120 days')
       GROUP BY d, cat
       HAVING answered > 0
       ORDER BY d ASC, cat ASC`
    )
    .all() as { d: string; cat: string; answered: number; correct: number }[];

  const catKeys = Array.from(new Set(volumeDayCatRows.map((r) => r.cat))).sort((a, b) => a.localeCompare(b));
  const answeredByDay = new Map<string, Record<string, number>>();
  const correctByDay = new Map<string, Record<string, number>>();
  for (const r of volumeDayCatRows) {
    if (!answeredByDay.has(r.d)) {
      const z = Object.fromEntries(catKeys.map((c) => [c, 0])) as Record<string, number>;
      answeredByDay.set(r.d, { ...z });
      correctByDay.set(r.d, { ...z });
    }
    answeredByDay.get(r.d)![r.cat] = r.answered;
    correctByDay.get(r.d)![r.cat] = r.correct;
  }
  const allStackDays = Array.from(answeredByDay.keys()).sort();
  const stackSlice = allStackDays.slice(-28);
  const palette = ["#38bdf8", "#a78bfa", "#fbbf24", "#34d399", "#f472b6", "#818cf8", "#fb7185", "#94a3b8"];
  const volumeStackCategories = catKeys.map((key, i) => ({
    key,
    label: areaLabel[key] || key.charAt(0).toUpperCase() + key.slice(1),
    color: palette[i % palette.length]!,
  }));
  const volumeStackByDay = stackSlice.map((d) => {
    const a = answeredByDay.get(d)!;
    const row: Record<string, string | number> = {
      d,
      short: `${d.slice(8, 10)}/${d.slice(5, 7)}`,
    };
    for (const k of catKeys) row[k] = a[k] ?? 0;
    return row;
  });
  const volumeStackCorrect = stackSlice.map((d) => {
    const c = correctByDay.get(d)!;
    const row: Record<string, string | number> = { d };
    for (const k of catKeys) row[k] = c[k] ?? 0;
    return row;
  });

  return NextResponse.json({
    sessions,
    days,
    auditFlags: flags,
    studyProgress,
    dailySeries,
    volumeByDay,
    volumeStackByDay,
    volumeStackCorrect,
    volumeStackCategories,
  });
}
