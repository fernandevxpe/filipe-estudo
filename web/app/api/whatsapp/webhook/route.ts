import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Placeholder para integração futura (Meta Cloud API ou provedor).
 * 1. Configure VERIFY_TOKEN no ambiente.
 * 2. Implemente verificação GET e eventos POST conforme documentação Meta.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verify = process.env.WHATSAPP_VERIFY_TOKEN || "filipe-dev-token";
  if (mode === "subscribe" && token === verify) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => ({}));
  console.info("[whatsapp webhook stub]", JSON.stringify(payload).slice(0, 500));
  return NextResponse.json({ received: true });
}
