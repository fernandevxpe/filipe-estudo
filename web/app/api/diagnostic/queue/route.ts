import { NextResponse } from "next/server";
import { buildDiagnosticQueueDay } from "@/lib/diagnosticDay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("dayIndex");
  const dayIndex = Math.max(0, parseInt(raw || "0", 10) || 0);
  try {
    const payload = buildDiagnosticQueueDay(dayIndex);
    return NextResponse.json(payload);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao montar a fila diagnóstica" }, { status: 500 });
  }
}
