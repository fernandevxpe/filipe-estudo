/**
 * Credenciais Supabase em runtime (Node, Edge, rotas).
 * Aceita NEXT_PUBLIC_* ou SUPABASE_URL + SUPABASE_ANON_KEY.
 *
 * Importante na Vercel: acesso com chave dinâmica em `process.env[k]` evita o bundler
 * substituir por `undefined` no build quando as variáveis só existem em runtime no painel.
 */
const URL_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"] as const;
const ANON_KEYS = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"] as const;

function readEnvAny(keys: readonly string[]): string {
  const env = process.env as Record<string, string | undefined>;
  for (const k of keys) {
    const v = env[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export function getSupabaseCredentials(): { url: string; key: string } | null {
  const url = readEnvAny(URL_KEYS);
  const key = readEnvAny(ANON_KEYS);
  if (!url || !key) return null;
  return { url, key };
}
