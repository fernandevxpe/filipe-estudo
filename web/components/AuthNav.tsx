"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function AuthNav() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );

  useEffect(() => {
    if (!configured) {
      setEmail(null);
      return;
    }
    const sb = getSupabaseBrowserClient();
    sb.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  if (!configured) return null;

  if (email === undefined) {
    return <span className="text-slate-500 text-xs tabular-nums">…</span>;
  }

  if (email) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="max-w-[140px] truncate" title={email}>
          {email}
        </span>
        <button
          type="button"
          onClick={async () => {
            const sb = getSupabaseBrowserClient();
            await sb.auth.signOut();
            router.refresh();
          }}
          className="text-sky-500 hover:text-sky-400 underline"
        >
          Sair
        </button>
      </div>
    );
  }

  return (
    <Link href="/login" className="text-xs text-sky-400 hover:text-sky-300 underline">
      Entrar
    </Link>
  );
}
