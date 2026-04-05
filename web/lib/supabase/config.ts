export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

/** Com Supabase configurado na Vercel, o progresso só persiste com login. */
export function useCloudProgress(): boolean {
  return isSupabaseConfigured();
}
