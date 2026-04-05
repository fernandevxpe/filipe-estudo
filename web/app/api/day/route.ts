import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { readPlanDailyQuestionTarget } from "@/lib/planMeta";
import { useCloudProgress } from "@/lib/supabase/config";
import { getSupabaseUserId, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { day: string; status: string; notes?: string; target_questions?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { day, status, notes, target_questions } = body;
  if (!day || !status) {
    return NextResponse.json({ error: "day e status obrigatórios" }, { status: 400 });
  }

  const tgt = target_questions ?? readPlanDailyQuestionTarget();

  if (useCloudProgress()) {
    const uid = await getSupabaseUserId();
    if (!uid) {
      return NextResponse.json({ error: "Inicia sessão para atualizar o calendário." }, { status: 401 });
    }
    const supabase = createSupabaseServerClient();
    const { data: ex, error: eRead } = await supabase
      .from("daily_log")
      .select("notes, done_questions, correct_cum, graded_cum, target_questions")
      .eq("user_id", uid)
      .eq("day", day)
      .maybeSingle();
    if (eRead) {
      console.error("[api/day]", eRead);
      return NextResponse.json({ error: "Falha ao ler dia" }, { status: 500 });
    }
    const nextNotes = notes !== undefined && notes !== null ? notes : ex?.notes ?? null;
    const nextTarget =
      target_questions !== undefined && target_questions !== null
        ? tgt
        : ex?.target_questions && ex.target_questions > 0
          ? ex.target_questions
          : tgt;

    const { error: eUp } = await supabase.from("daily_log").upsert(
      {
        user_id: uid,
        day,
        status,
        notes: nextNotes,
        target_questions: nextTarget,
        done_questions: ex?.done_questions ?? 0,
        correct_cum: ex?.correct_cum ?? 0,
        graded_cum: ex?.graded_cum ?? 0,
      },
      { onConflict: "user_id,day" }
    );
    if (eUp) {
      console.error("[api/day]", eUp);
      return NextResponse.json({ error: "Falha ao gravar" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const db = getDb();
  db.prepare(
    `INSERT INTO daily_log (day, status, notes, target_questions, done_questions, correct_cum, graded_cum)
     VALUES (?, ?, ?, ?, 0, 0, 0)
     ON CONFLICT(day) DO UPDATE SET
       status = excluded.status,
       notes = COALESCE(excluded.notes, daily_log.notes),
       target_questions = COALESCE(excluded.target_questions, daily_log.target_questions)`
  ).run(day, status, notes ?? null, tgt);

  return NextResponse.json({ ok: true });
}
