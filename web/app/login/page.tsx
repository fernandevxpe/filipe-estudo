"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const errParam = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [msg, setMsg] = useState<string | null>(errParam === "auth" ? "Falha na autenticação. Tenta de novo." : null);
  const [loading, setLoading] = useState(false);

  if (!hasSupabaseEnv()) {
    return (
      <div className="max-w-md mx-auto space-y-4 text-slate-300">
        <h1 className="text-xl font-semibold text-white">Conta</h1>
        <p className="text-sm text-slate-400">
          Supabase não está configurado neste ambiente. Define{" "}
          <code className="text-slate-500">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
          <code className="text-slate-500">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> em{" "}
          <code className="text-slate-500">.env.local</code> (local) ou nas variáveis da Vercel.
        </p>
        <Link href="/" className="text-sky-400 hover:underline text-sm">
          ← Painel
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setMsg("Se a confirmação por email estiver ativa, verifica a caixa de entrada. Caso contrário, já podes entrar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (er: unknown) {
      setMsg(er instanceof Error ? er.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
      <p className="text-sm text-slate-400">
        O progresso (sessões e calendário) fica associado à tua conta quando o Supabase está ativo.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Palavra-passe</label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 text-sm"
          />
        </div>
        {msg ? <p className="text-sm text-amber-200/90">{msg}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium py-2 text-sm"
        >
          {loading ? "…" : mode === "login" ? "Entrar" : "Registar"}
        </button>
      </form>

      <div className="flex flex-wrap gap-3 text-sm">
        <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-sky-400 hover:underline">
          {mode === "login" ? "Criar conta" : "Já tenho conta"}
        </button>
        <span className="text-slate-600">·</span>
        <button type="button" onClick={() => void signOut()} className="text-slate-400 hover:text-slate-300 hover:underline">
          Sair (se já estiveres dentro)
        </button>
        <span className="text-slate-600">·</span>
        <Link href="/" className="text-slate-400 hover:text-slate-300 hover:underline">
          Painel
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto text-slate-500 text-sm" aria-busy>
          A carregar…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
