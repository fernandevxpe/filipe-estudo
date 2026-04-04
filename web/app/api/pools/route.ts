import { NextResponse } from "next/server";
import { loadItemsIndex } from "@/lib/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const idx = loadItemsIndex();
    return NextResponse.json(idx);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao ler índice de provas" }, { status: 500 });
  }
}
