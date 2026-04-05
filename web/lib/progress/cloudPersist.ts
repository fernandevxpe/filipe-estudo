import type { SupabaseClient } from "@supabase/supabase-js";

export type CloudAnswerRow = {
  item_id: string;
  choice: string | null;
  correct_letter: string | null;
  is_correct: boolean | null;
  time_ms: number;
  evidence_type: string;
  area: string | null;
  study_topic: string;
  skipped: boolean;
  source_pool_id: string;
};

export type CloudAuditRow = {
  kind: string;
  detail: string;
};

const CHUNK = 400;

function chunkInsert<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export async function cloudPersistFullSession(
  supabase: SupabaseClient,
  userId: string,
  p: {
    sessionId: string;
    displayPoolId: string;
    startedAt: string;
    endedAt: string;
    score: number;
    graded: number;
    correct: number;
    sessionKind: string;
    answers: CloudAnswerRow[];
    audits: CloudAuditRow[];
    day: string;
    dayStatus: string;
    newDone: number;
    planTarget: number;
    newC: number;
    newG: number;
  }
): Promise<void> {
  const { error: e0 } = await supabase.from("study_sessions").insert({
    id: p.sessionId,
    user_id: userId,
    pool_id: p.displayPoolId,
    started_at: p.startedAt,
    ended_at: p.endedAt,
    score: p.score,
    total: p.graded,
    correct: p.correct,
    session_kind: p.sessionKind,
  });
  if (e0) throw e0;

  const answerPayload = p.answers.map((a) => ({
    user_id: userId,
    session_id: p.sessionId,
    item_id: a.item_id,
    choice: a.choice,
    correct_letter: a.correct_letter,
    is_correct: a.is_correct,
    time_ms: a.time_ms,
    evidence_type: a.evidence_type,
    area: a.area,
    study_topic: a.study_topic,
    skipped: a.skipped,
    source_pool_id: a.source_pool_id,
  }));

  for (const part of chunkInsert(answerPayload, CHUNK)) {
    const { error } = await supabase.from("session_answers").insert(part);
    if (error) throw error;
  }

  if (p.audits.length > 0) {
    const flagPayload = p.audits.map((f) => ({
      user_id: userId,
      session_id: p.sessionId,
      kind: f.kind,
      detail: f.detail,
      created_at: p.endedAt,
    }));
    const { error: e2 } = await supabase.from("audit_flags").insert(flagPayload);
    if (e2) throw e2;
  }

  const { data: existing, error: eRead } = await supabase
    .from("daily_log")
    .select("target_questions, notes")
    .eq("user_id", userId)
    .eq("day", p.day)
    .maybeSingle();

  if (eRead) throw eRead;

  const target =
    existing?.target_questions && existing.target_questions > 0 ? existing.target_questions : p.planTarget;

  const { error: e3 } = await supabase.from("daily_log").upsert(
    {
      user_id: userId,
      day: p.day,
      status: p.dayStatus,
      notes: existing?.notes ?? null,
      done_questions: p.newDone,
      target_questions: target,
      correct_cum: p.newC,
      graded_cum: p.newG,
    },
    { onConflict: "user_id,day" }
  );
  if (e3) throw e3;
}

export async function cloudFetchDailyPrevious(
  supabase: SupabaseClient,
  userId: string,
  day: string
): Promise<{ done_questions: number; target_questions: number; correct_cum: number; graded_cum: number } | null> {
  const { data, error } = await supabase
    .from("daily_log")
    .select("done_questions, target_questions, correct_cum, graded_cum")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    done_questions: data.done_questions ?? 0,
    target_questions: data.target_questions ?? 0,
    correct_cum: data.correct_cum ?? 0,
    graded_cum: data.graded_cum ?? 0,
  };
}
