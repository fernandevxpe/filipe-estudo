import { NextResponse } from "next/server";
import { toPublicItem } from "@/lib/itemPublic";
import { loadItemsIndex, loadPoolItems } from "@/lib/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { poolId: string } };

export async function GET(req: Request, { params }: Ctx) {
  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);
  const limit = Math.min(90, Math.max(1, parseInt(searchParams.get("limit") || "15", 10) || 15));

  try {
    const idx = loadItemsIndex();
    const pool = idx.pools.find((p) => p.id === params.poolId);
    if (!pool) {
      return NextResponse.json({ error: "Pool não encontrado" }, { status: 404 });
    }
    const all = loadPoolItems(pool.path);
    const slice = all.slice(offset, offset + limit).map((it) => toPublicItem(pool.id, it));
    return NextResponse.json({
      pool,
      offset,
      limit,
      total: all.length,
      items: slice,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao carregar itens" }, { status: 500 });
  }
}
