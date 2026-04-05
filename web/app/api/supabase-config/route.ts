import { NextResponse } from "next/server";
import { getSupabaseCredentials } from "@/lib/supabase/credentials";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Credenciais “públicas” do Supabase (anon) para o browser.
 * Evita depender do HTML estático da /login gerado no build sem env.
 */
export async function GET() {
  const creds = getSupabaseCredentials();
  if (!creds) {
    return NextResponse.json({ ok: false as const });
  }
  return NextResponse.json({
    ok: true as const,
    url: creds.url,
    anonKey: creds.key,
  });
}
