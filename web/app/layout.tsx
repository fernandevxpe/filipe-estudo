import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Link from "next/link";
import ClientErrorReporter from "@/components/ClientErrorReporter";
import AuthNav from "@/components/AuthNav";
import SupabaseRuntimeInit from "@/components/SupabaseRuntimeInit";
import { getSupabaseCredentials } from "@/lib/supabase/credentials";
import { DEPLOY_MARK } from "@/lib/deployMark";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Filipe — Estudo ENEM + SSA UPE",
  description: "Questões reais, pontuação e acompanhamento — Filipe Monteiro",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Filipe Estudo" },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

/** Garante que o layout lê env em runtime na Vercel (não cache estático sem Supabase). */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabaseCreds = getSupabaseCredentials();
  const supabaseConfigured = !!supabaseCreds;

  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} font-sans min-h-screen flex flex-col`}>
        {supabaseCreds ? (
          <SupabaseRuntimeInit url={supabaseCreds.url} key={supabaseCreds.key} />
        ) : null}
        <ClientErrorReporter />
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <Link href="/" className="text-lg font-semibold text-sky-300 hover:text-sky-200">
              Filipe · Estudo
            </Link>
            <div className="flex flex-wrap items-center gap-4 justify-end flex-1 min-w-0">
              <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
                <Link href="/" className="hover:text-white">
                  Painel
                </Link>
                <Link href="/guia" className="hover:text-white">
                  Estudo do dia
                </Link>
                <Link href="/study" className="hover:text-white">
                  Atividades
                </Link>
                <Link href="/diagnostico" className="hover:text-amber-200/90">
                  Diagnóstico
                </Link>
                <Link href="/login" className="hover:text-sky-300 text-slate-400">
                  Conta
                </Link>
                <Link href="/test" className="hover:text-slate-400 text-slate-500">
                  Teste
                </Link>
              </nav>
              <AuthNav supabaseConfigured={supabaseConfigured} />
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8 w-full min-w-0 flex-1">{children}</main>
        <footer className="border-t border-slate-800/80 mt-auto">
          <div className="max-w-5xl mx-auto px-4 py-3 text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Deploy mark: <code className="text-slate-400">{DEPLOY_MARK}</code>
            </span>
            <a
              href="/api/deploy-check"
              className="text-sky-600 hover:text-sky-400 underline"
              target="_blank"
              rel="noreferrer"
            >
              JSON do deploy
            </a>
            <a
              href="/api/deploy-check?verbose=1"
              className="text-slate-500 hover:text-slate-400 underline"
              target="_blank"
              rel="noreferrer"
            >
              deploy (verbose)
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
