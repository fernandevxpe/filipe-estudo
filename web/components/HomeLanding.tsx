import Link from "next/link";

/**
 * Tela inicial para visitantes (Supabase ligado e sem sessão).
 * Tom divertido: “Filipe o Estudioso” + brincadeira com domínio .com
 */
export default function HomeLanding() {
  return (
    <div className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-slate-950 via-indigo-950/80 to-slate-900 shadow-[0_0_80px_-20px_rgba(251,191,36,0.35)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative z-10 px-5 py-12 sm:px-10 sm:py-16 md:py-20 flex flex-col items-center text-center max-w-2xl mx-auto">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-amber-200/90">
          <span aria-hidden>📚</span>
          laboratório de estudo sério (às vezes)
        </p>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
          Filipe,{" "}
          <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-orange-300 bg-clip-text text-transparent">
            o Estudioso
          </span>
        </h1>

        <p className="mt-6 font-mono text-sm sm:text-base text-slate-400/95">
          <span className="text-sky-300/90">filipeoestudioso</span>
          <span className="mx-1 text-amber-500/80">·</span>
          <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-amber-300 ring-1 ring-amber-500/40">com</span>
          <span className="sr-only"> ponto com </span>
        </p>
        <p className="mt-2 text-xs text-slate-500 max-w-md">
          (domínio ainda em fase de “vou passar no ENEM primeiro” — mas a vibe já é .com)
        </p>

        <p className="mt-8 text-base sm:text-lg text-slate-300 leading-relaxed max-w-lg">
          Questões reais, calendário de estudo e estatísticas — com progresso na nuvem quando entrares. Sem promessa
          milagrosa; só organização, café e repetição esperta.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto sm:justify-center">
          <Link
            href="/login"
            className="inline-flex justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-base font-semibold text-slate-950 shadow-lg shadow-amber-900/40 hover:from-amber-400 hover:to-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition"
          >
            <span aria-hidden>🔐</span>
            Entrar no quartel-general
          </Link>
          <Link
            href="/login"
            className="inline-flex justify-center items-center rounded-xl border border-slate-600 bg-slate-900/60 px-6 py-3.5 text-sm font-medium text-slate-200 hover:bg-slate-800/80 hover:border-slate-500 transition"
          >
            Criar conta · 30 s
          </Link>
        </div>

        <ul className="mt-12 flex flex-wrap justify-center gap-2 text-xs text-slate-400">
          {["ENEM + SSA UPE", "Calendário", "Gráficos", "Estudo do dia"].map((label) => (
            <li
              key={label}
              className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-1.5 text-slate-300"
            >
              {label}
            </li>
          ))}
        </ul>

        <p className="mt-10 text-xs text-slate-600 max-w-sm leading-relaxed">
          Depois de entrares, o <strong className="text-slate-500">Painel</strong> desbloqueia com o teu progresso. Até
          lá, este ecrã existe só para impressionar visitantes e motivar o Filipe a abrir o livro.
        </p>
      </div>
    </div>
  );
}
