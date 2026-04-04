"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DashboardCharts,
  type DailySeriesRow,
  type VolumeDayRow,
  type VolumeStackCategory,
} from "@/components/DashboardCharts";

type DayTier = "green" | "yellow" | "red";
type DayRow = {
  day: string;
  status: string;
  target_questions: number;
  done_questions: number;
  correct_cum?: number;
  graded_cum?: number;
  tier?: DayTier;
  dayPct?: string | null;
};
type SessionRow = { id: string; pool_id: string; ended_at: string; score: number; correct: number; total: number };
type FlagRow = { session_id: string; kind: string; detail: string; created_at: string };

type AreaRow = {
  key: string;
  label: string;
  answered: number;
  correct: number;
  wrong: number;
  pct: number;
};

type NeedsRow = {
  topic: string;
  areaLabel: string;
  wrong: number;
  answered: number;
  pct: number;
};

type StudyProgress = {
  totals: { answered: number; correct: number; wrong: number; pct: number };
  byArea: AreaRow[];
  needsWork: NeedsRow[];
  goingWell: { key: string; label: string; answered: number; pct: number }[];
};

export default function DashboardPage() {
  const [days, setDays] = useState<DayRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [study, setStudy] = useState<StudyProgress | null>(null);
  const [dailySeries, setDailySeries] = useState<DailySeriesRow[]>([]);
  const [volumeByDay, setVolumeByDay] = useState<VolumeDayRow[]>([]);
  const [volumeStackByDay, setVolumeStackByDay] = useState<Record<string, string | number>[]>([]);
  const [volumeStackCorrect, setVolumeStackCorrect] = useState<Record<string, string | number>[]>([]);
  const [volumeStackCategories, setVolumeStackCategories] = useState<VolumeStackCategory[]>([]);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => {
        setDays(d.days || []);
        setSessions(d.sessions || []);
        setFlags(d.auditFlags || []);
        setStudy(d.studyProgress ?? null);
        setDailySeries(d.dailySeries || []);
        setVolumeByDay(d.volumeByDay || []);
        setVolumeStackByDay(d.volumeStackByDay || []);
        setVolumeStackCorrect(d.volumeStackCorrect || []);
        setVolumeStackCategories(d.volumeStackCategories || []);
      })
      .catch(() => {});
  }, []);

  const monthDays = useMemo(() => {
    const real = new Date();
    const ty = real.getFullYear();
    const tm = real.getMonth();
    const td = real.getDate();
    const todayLocalIso = `${ty}-${String(tm + 1).padStart(2, "0")}-${String(td).padStart(2, "0")}`;

    const { y, m } = viewMonth;
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const pad = first.getDay();
    const cells: {
      date: string;
      iso?: string;
      isFuture?: boolean;
      isToday?: boolean;
      tier?: DayTier;
      dayPct?: string | null;
    }[] = [];
    for (let i = 0; i < pad; i++) cells.push({ date: "" });
    for (let d = 1; d <= last.getDate(); d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isFuture = iso > todayLocalIso;
      const isToday = iso === todayLocalIso;
      const hit = days.find((x) => x.day === iso);
      cells.push({
        date: String(d),
        iso,
        isFuture,
        isToday,
        tier: isFuture ? undefined : (hit?.tier ?? "red"),
        dayPct: isFuture ? null : (hit?.dayPct ?? null),
      });
    }
    return { title: first.toLocaleString("pt-BR", { month: "long", year: "numeric" }), cells };
  }, [days, viewMonth]);

  function tierCellClass(tier: DayTier) {
    switch (tier) {
      case "green":
        return "bg-emerald-600/35 border-emerald-600/50";
      case "yellow":
        return "bg-amber-600/20 border-amber-600/40";
      case "red":
        return "bg-rose-900/30 border-rose-700/50";
    }
  }

  const todayIso = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const todayLog = days.find((x) => x.day === todayIso);

  const isViewingCurrentMonth =
    viewMonth.y === new Date().getFullYear() && viewMonth.m === new Date().getMonth();

  function goPrevMonth() {
    setViewMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  }

  function goNextMonth() {
    setViewMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));
  }

  function goThisMonth() {
    const d = new Date();
    setViewMonth({ y: d.getFullYear(), m: d.getMonth() });
  }

  function studyHrefForCalendarDay(iso: string) {
    return `/study?daily=1&forDay=${encodeURIComponent(iso)}`;
  }

  return (
    <div className="space-y-8 w-full min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Painel</h1>
          <p className="text-slate-500 text-sm mt-1">Seus dias, desempenho e calendário.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/guia"
            className="text-sm rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 px-3 py-2"
          >
            Estudo do dia
          </Link>
          <Link
            href={studyHrefForCalendarDay(todayIso)}
            className="text-sm rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 font-medium"
          >
            Rodada do dia
          </Link>
          <Link
            href="/study"
            className="text-sm rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-3 py-2 font-medium"
          >
            Atividades
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Como você está indo</h2>

        {!study || study.totals.answered === 0 ? (
          <p className="text-slate-500 text-sm">
            Quando você responder questões nas atividades, aqui aparecem acertos, erros e por matéria — e o que vale
            reforçar.
          </p>
        ) : (
          <>
          <div className="grid sm:grid-cols-3 gap-4 text-center sm:text-left">
            <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wide">Respondidas</p>
              <p className="text-2xl font-semibold text-white mt-1">{study.totals.answered}</p>
            </div>
            <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wide">Acertos</p>
              <p className="text-2xl font-semibold text-emerald-400 mt-1">{study.totals.correct}</p>
            </div>
            <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wide">Taxa geral</p>
              <p className="text-2xl font-semibold text-sky-300 mt-1">{study.totals.pct}%</p>
            </div>
          </div>

          {study.byArea.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-3">Por matéria</h3>
              <div className="space-y-3">
                {study.byArea.map((a) => (
                  <div key={a.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-200">{a.label}</span>
                      <span className="text-slate-500">
                        {a.pct}% · {a.correct}/{a.answered}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500/90 transition-all"
                        style={{ width: `${Math.min(100, a.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {study.needsWork.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-rose-300/90 mb-2">Vale reforçar</h3>
              <p className="text-slate-500 text-xs mb-3">Assuntos com mais erros nas últimas respostas.</p>
              <ul className="space-y-2 text-sm">
                {study.needsWork.map((n, i) => (
                  <li
                    key={`${n.topic}-${i}`}
                    className="flex flex-wrap justify-between gap-2 border-b border-slate-800/80 pb-2"
                  >
                    <span className="text-slate-300">
                      {n.topic}
                      <span className="text-slate-600"> · {n.areaLabel}</span>
                    </span>
                    <span className="text-rose-300/80 whitespace-nowrap">
                      {n.wrong} erro{n.wrong > 1 ? "s" : ""} ({n.pct}% acerto)
                    </span>
                  </li>
                ))}
              </ul>
              <Link href="/guia" className="inline-block mt-3 text-sm text-sky-400 hover:underline">
                Ver vídeos no Estudo do dia →
              </Link>
            </div>
          )}

          {study.goingWell.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-emerald-300/90 mb-2">Indo bem</h3>
              <ul className="flex flex-wrap gap-2">
                {study.goingWell.map((g) => (
                  <li
                    key={g.key}
                    className="text-xs rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-200 px-3 py-1"
                  >
                    {g.label} ({g.pct}%)
                  </li>
                ))}
              </ul>
            </div>
          )}
          </>
        )}
      </section>

      <DashboardCharts
        totals={study?.totals ?? null}
        byArea={study?.byArea ?? []}
        dailySeries={dailySeries}
        volumeByDay={volumeByDay}
        volumeStackByDay={volumeStackByDay}
        volumeStackCorrect={volumeStackCorrect}
        volumeStackCategories={volumeStackCategories}
      />

      <p className="text-sm text-slate-500">
        {todayLog ? (
          <>
            Hoje: <strong className="text-slate-300">{todayLog.done_questions}</strong>/
            {todayLog.target_questions || "—"} questões na meta
            {todayLog.dayPct != null && (
              <>
                {" "}
                · acertos no dia: <strong className="text-slate-300">{todayLog.dayPct}</strong>
              </>
            )}
            {(todayLog.graded_cum ?? 0) === 0 && (
              <span className="text-rose-400/90"> · ainda sem questões corrigidas (vermelho no calendário)</span>
            )}
            {" · "}
            <Link href={studyHrefForCalendarDay(todayIso)} className="text-sky-400 hover:underline">
              abrir rodada do dia
            </Link>
          </>
        ) : (
          <>
            Hoje ainda sem registro no calendário —{" "}
            <Link href={studyHrefForCalendarDay(todayIso)} className="text-sky-400 hover:underline">
              fazer a rodada do dia
            </Link>
          </>
        )}
      </p>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-slate-200 capitalize">{monthDays.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={goPrevMonth}
              className="text-sm rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 px-3 py-1.5"
              aria-label="Mês anterior"
            >
              ← Anterior
            </button>
            <button
              type="button"
              onClick={goNextMonth}
              className="text-sm rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 px-3 py-1.5"
              aria-label="Próximo mês"
            >
              Próximo →
            </button>
            {!isViewingCurrentMonth && (
              <button
                type="button"
                onClick={goThisMonth}
                className="text-sm rounded-lg bg-slate-800 text-sky-300 hover:bg-slate-700 px-3 py-1.5 border border-slate-600"
              >
                Hoje
              </button>
            )}
          </div>
        </div>
        <p className="text-slate-500 text-xs mb-4">
          Navegue para ver meses passados (dados salvos) ou os próximos meses do plano; dias futuros aparecem neutros até
          a data chegar.
        </p>
        <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500 mb-2">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {monthDays.cells.map((c, i) => {
            if (!c.date || !c.iso) return <div key={`e-${i}`} />;
            if (c.isFuture) {
              return (
                <Link
                  key={c.iso}
                  href={studyHrefForCalendarDay(c.iso)}
                  className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 min-h-[60px] flex flex-col justify-end text-left transition hover:bg-slate-800/80 hover:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80"
                >
                  <span className="text-slate-500 text-sm font-medium">{c.date}</span>
                  <span className="text-[10px] text-slate-600 mt-0.5">abrir</span>
                </Link>
              );
            }
            const tier = c.tier ?? "red";
            const todayRing = c.isToday ? " ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-900" : "";
            return (
              <Link
                key={c.iso}
                href={studyHrefForCalendarDay(c.iso)}
                className={`rounded-lg border p-2 min-h-[60px] flex flex-col justify-between gap-0.5 text-left transition ${tierCellClass(
                  tier
                )} hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80${todayRing}`}
              >
                <span className="text-white text-sm font-medium">{c.date}</span>
                {c.dayPct ? (
                  <span className="text-[10px] text-slate-200/90 leading-tight">{c.dayPct}</span>
                ) : (
                  <span className="text-[10px] text-slate-500/90 leading-tight">—</span>
                )}
              </Link>
            );
          })}
        </div>
        <div className="text-slate-600 text-xs mt-3 space-y-1">
          <p>
            Ao clicar em um dia, você abre a rodada; o desempenho é registrado na <strong className="text-slate-500">data
            desse dia</strong> (útil para planejar semanas futuras ou refazer dias passados).
          </p>
          <p className="text-slate-500">
            Dias futuros ficam sem cor de desempenho até a data chegar; ainda assim você pode estudar e já ir preenchendo
            o plano.
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <span>
              <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500/80 align-middle mr-1" />
              verde: ≥70% de acertos (no dia)
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-sm bg-amber-500/70 align-middle mr-1" />
              amarelo: 30%–69%
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-sm bg-rose-600/70 align-middle mr-1" />
              vermelho: &lt;30% ou sem questão corrigida
            </span>
          </p>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white mb-3">Últimas atividades</h2>
          <ul className="space-y-2 text-sm text-slate-400">
            {sessions.length === 0 && <li className="text-slate-600">Nada registrado ainda.</li>}
            {sessions.map((s) => (
              <li key={s.id} className="flex justify-between gap-2 border-b border-slate-800/80 pb-2">
                <span className="truncate text-slate-500">{s.pool_id}</span>
                <span className="text-sky-400 whitespace-nowrap">
                  {(s.score * 100).toFixed(0)}% ({s.correct}/{s.total})
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-base font-semibold text-slate-400 mb-3">Avisos automáticos</h2>
          <ul className="space-y-2 text-xs text-slate-500">
            {flags.length === 0 && <li>Nenhum aviso.</li>}
            {flags.map((f) => (
              <li key={f.session_id + f.kind + f.created_at} className="border-b border-slate-800/80 pb-2">
                {f.detail}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
