import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { readPlanDailyQuestionTarget } from "@/lib/planMeta";

export const runtime = "nodejs";

/** Atualiza ou cria registro de dia (status manual: feito | parcial | perdido). */
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
