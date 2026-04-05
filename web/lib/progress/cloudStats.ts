import type { SupabaseClient } from "@supabase/supabase-js";
import { dayPctLabel, tierFromCumulative, type DayTier } from "@/lib/dayTier";

function pct(c: number, a: number) {
  return a > 0 ? Math.round((c / a) * 1000) / 10 : 0;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function isoStartOfDay(day: string): string {
  return `${day}T00:00:00.000Z`;
}

const areaLabel: Record<string, string> = {
  geral: "Geral",
  linguagens: "Linguagens",
  matematica: "Matemática",
  humanas: "Ciências Humanas",
  natureza: "Ciências da Natureza",
  mista: "Misto",
  outros: "Outros",
};

export async function fetchCloudStatsPayload(supabase: SupabaseClient, userId: string) {
  const dayCut800 = daysAgoIso(800);
  const dayCut120 = daysAgoIso(120);
  const dayCut90 = daysAgoIso(90);

  const { data: sessionsRaw, error: e1 } = await supabase
    .from("study_sessions")
    .select("id, pool_id, started_at, ended_at, score, total, correct")
    .eq("user_id", userId)
    .order("ended_at", { ascending: false })
    .limit(50);
  if (e1) throw e1;

  const sessions = (sessionsRaw ?? []).map((s) => ({
    id: s.id,
    pool_id: s.pool_id ?? "",
    started_at: s.started_at ?? "",
    ended_at: s.ended_at ?? "",
    score: Number(s.score ?? 0),
    total: Number(s.total ?? 0),
    correct: Number(s.correct ?? 0),
  }));

  const { data: daysRaw, error: e2 } = await supabase
    .from("daily_log")
    .select("day, status, target_questions, done_questions, notes, correct_cum, graded_cum")
    .eq("user_id", userId)
    .gte("day", dayCut800)
    .order("day", { ascending: false });
  if (e2) throw e2;

  const days = (daysRaw ?? []).map((d) => {
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

  const { data: flagsRaw, error: e3 } = await supabase
    .from("audit_flags")
    .select("session_id, kind, detail, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (e3) throw e3;

  const auditFlags = flagsRaw ?? [];

  const allAnswers: {
    session_id: string;
    item_id: string;
    choice: string | null;
    correct_letter: string | null;
    is_correct: boolean | null;
    time_ms: number;
    area: string | null;
    study_topic: string | null;
    skipped: boolean | null;
  }[] = [];

  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data: page, error } = await supabase
      .from("session_answers")
      .select("session_id, item_id, choice, correct_letter, is_correct, time_ms, area, study_topic, skipped")
      .eq("user_id", userId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!page?.length) break;
    allAnswers.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

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

  try {
    let answered = 0;
    let correct = 0;
    let wrong = 0;
    for (const a of allAnswers) {
      const sk = a.skipped ? 1 : 0;
      if (sk !== 0 || a.is_correct === null) continue;
      answered += 1;
      if (a.is_correct === true) correct += 1;
      else wrong += 1;
    }

    const byAreaMap = new Map<string, { answered: number; correct: number; wrong: number }>();
    const byTopicMap = new Map<string, { cat: string; answered: number; correct: number; wrong: number }>();

    for (const a of allAnswers) {
      const sk = a.skipped ? 1 : 0;
      if (sk !== 0 || a.is_correct === null) continue;
      const cat = String(a.area || "geral")
        .trim()
        .toLowerCase() || "geral";
      const topic = String(a.study_topic || "Geral").trim() || "Geral";

      if (!byAreaMap.has(cat)) byAreaMap.set(cat, { answered: 0, correct: 0, wrong: 0 });
      const ar = byAreaMap.get(cat)!;
      ar.answered += 1;
      if (a.is_correct === true) ar.correct += 1;
      else ar.wrong += 1;

      const tk = `${topic}\0${cat}`;
      if (!byTopicMap.has(tk)) byTopicMap.set(tk, { cat, answered: 0, correct: 0, wrong: 0 });
      const tr = byTopicMap.get(tk)!;
      tr.answered += 1;
      if (a.is_correct === true) tr.correct += 1;
      else tr.wrong += 1;
    }

    const byArea = Array.from(byAreaMap.entries())
      .map(([key, r]) => ({
        key,
        label: areaLabel[key] || key.charAt(0).toUpperCase() + key.slice(1),
        answered: r.answered,
        correct: r.correct,
        wrong: r.wrong,
        pct: pct(r.correct, r.answered),
      }))
      .sort((a, b) => b.answered - a.answered);

    const needsWork = Array.from(byTopicMap.entries())
      .filter(([, r]) => r.wrong > 0)
      .map(([k, r]) => {
        const topic = k.split("\0")[0]!;
        return {
          topic,
          areaKey: r.cat,
          areaLabel: areaLabel[r.cat] || r.cat,
          wrong: r.wrong,
          answered: r.answered,
          pct: pct(r.correct, r.answered),
        };
      })
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
    /* ignora */
  }

  const { data: seriesRaw, error: e4 } = await supabase
    .from("daily_log")
    .select("day, correct_cum, graded_cum, done_questions, target_questions")
    .eq("user_id", userId)
    .gte("day", dayCut120)
    .order("day", { ascending: true });
  if (e4) throw e4;

  const dailySeries = (seriesRaw ?? []).map((r) => {
    const c = r.correct_cum ?? 0;
    const g = r.graded_cum ?? 0;
    return {
      day: r.day,
      label: r.day.slice(8, 10) + "/" + r.day.slice(5, 7),
      graded: g,
      correct: c,
      pct: g > 0 ? Math.round((c / g) * 1000) / 10 : (null as number | null),
      done_questions: r.done_questions ?? 0,
      target_questions: r.target_questions ?? 0,
    };
  });

  const { data: volSessions, error: e5 } = await supabase
    .from("study_sessions")
    .select("ended_at, total, correct")
    .eq("user_id", userId)
    .gte("ended_at", isoStartOfDay(dayCut90));
  if (e5) throw e5;

  const volMap = new Map<string, { sessions: number; questions: number; correct: number }>();
  for (const s of volSessions ?? []) {
    const e = s.ended_at;
    if (!e || e.length < 10) continue;
    const d = e.slice(0, 10);
    if (!volMap.has(d)) volMap.set(d, { sessions: 0, questions: 0, correct: 0 });
    const v = volMap.get(d)!;
    v.sessions += 1;
    v.questions += Number(s.total ?? 0);
    v.correct += Number(s.correct ?? 0);
  }
  const volumeByDay = Array.from(volMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, v]) => ({ d, sessions: v.sessions, questions: v.questions, correct: v.correct }));

  const { data: recentSess, error: e6 } = await supabase
    .from("study_sessions")
    .select("id, ended_at")
    .eq("user_id", userId)
    .gte("ended_at", isoStartOfDay(dayCut120));
  if (e6) throw e6;

  const sessionIds = (recentSess ?? []).filter((s) => s.ended_at && s.ended_at.length >= 10).map((s) => s.id);

  const sessionEndById = new Map<string, string>();
  for (const s of recentSess ?? []) {
    if (s.id && s.ended_at) sessionEndById.set(s.id, s.ended_at);
  }

  const stackAnswers = allAnswers.filter((a) => sessionIds.includes(a.session_id));

  const volumeDayCatRows: { d: string; cat: string; answered: number; correct: number }[] = [];
  const catSet = new Set<string>();
  for (const a of stackAnswers) {
    const ended = sessionEndById.get(a.session_id);
    if (!ended || ended.length < 10) continue;
    const d = ended.slice(0, 10);
    if (d < dayCut120) continue;
    const cat =
      String(a.area || "geral")
        .trim()
        .toLowerCase() || "geral";
    const sk = a.skipped ? 1 : 0;
    if (sk !== 0 || a.is_correct === null) continue;
    catSet.add(cat);
    volumeDayCatRows.push({
      d,
      cat,
      answered: 1,
      correct: a.is_correct === true ? 1 : 0,
    });
  }

  const merged = new Map<string, { answered: number; correct: number }>();
  for (const r of volumeDayCatRows) {
    const k = `${r.d}\0${r.cat}`;
    if (!merged.has(k)) merged.set(k, { answered: 0, correct: 0 });
    const m = merged.get(k)!;
    m.answered += r.answered;
    m.correct += r.correct;
  }

  const finalRows = Array.from(merged.entries()).map(([k, v]) => {
    const [d, cat] = k.split("\0") as [string, string];
    return { d, cat, answered: v.answered, correct: v.correct };
  });

  const catKeys = Array.from(catSet).sort((a, b) => a.localeCompare(b));
  const answeredByDay = new Map<string, Record<string, number>>();
  const correctByDay = new Map<string, Record<string, number>>();
  for (const r of finalRows) {
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

  return {
    sessions,
    days,
    auditFlags,
    studyProgress,
    dailySeries,
    volumeByDay,
    volumeStackByDay,
    volumeStackCorrect,
    volumeStackCategories,
  };
}
