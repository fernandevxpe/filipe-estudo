import { NextResponse } from "next/server";
import { buildDiagnosticDayForDate } from "@/lib/diagnosticDay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Parâmetro date=YYYY-MM-DD obrigatório" }, { status: 400 });
  }
  try {
    const payload = buildDiagnosticDayForDate(date);
    return NextResponse.json(payload);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao montar o dia diagnóstico" }, { status: 500 });
  }
}
