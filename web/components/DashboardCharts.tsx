"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type AreaRow = {
  key: string;
  label: string;
  answered: number;
  correct: number;
  wrong: number;
  pct: number;
};

type StudyTotals = { answered: number; correct: number; wrong: number; pct: number };

export type DailySeriesRow = {
  day: string;
  label: string;
  graded: number;
  correct: number;
  pct: number | null;
  done_questions: number;
  target_questions: number;
};

export type VolumeDayRow = {
  d: string;
  sessions: number;
  questions: number;
  correct: number;
};

export type VolumeStackCategory = { key: string; label: string; color: string };

const AXIS = { fill: "#94a3b8", fontSize: 11 };
const GRID = "#334155";

type Props = {
  totals: StudyTotals | null;
  byArea: AreaRow[];
  dailySeries: DailySeriesRow[];
  volumeByDay: VolumeDayRow[];
  volumeStackByDay: Record<string, string | number>[];
  volumeStackCorrect: Record<string, string | number>[];
  volumeStackCategories: VolumeStackCategory[];
};

export function DashboardCharts({
  totals,
  byArea,
  dailySeries,
  volumeByDay,
  volumeStackByDay,
  volumeStackCorrect,
  volumeStackCategories,
}: Props) {
  const pieData =
    totals && totals.answered > 0
      ? [
          { name: "Acertos", value: totals.correct, color: "#34d399" },
          { name: "Erros", value: totals.wrong, color: "#f87171" },
        ]
      : [];

  const areaChartData = [...byArea].sort((a, b) => a.pct - b.pct);

  const dailyForLine = dailySeries.filter((r) => r.graded > 0 && r.pct != null);

  const volSlice = volumeByDay.slice(-28).map((r) => ({
    ...r,
    short: `${r.d.slice(8, 10)}/${r.d.slice(5, 7)}`,
  }));

  const correctByDayMap = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const row of volumeStackCorrect) {
      const d = String(row.d);
      const nums: Record<string, number> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === "d") continue;
        nums[k] = typeof v === "number" ? v : Number(v) || 0;
      }
      m.set(d, nums);
    }
    return m;
  }, [volumeStackCorrect]);

  const volByCategoryStack = [...byArea]
    .filter((a) => a.answered > 0)
    .sort((a, b) => b.answered - a.answered)
    .map((a) => ({
      label: a.label,
      Acertos: a.correct,
      Erros: a.wrong,
      Total: a.answered,
    }));

  const hasStackVolume =
    volumeStackByDay.length > 0 && volumeStackCategories.some((c) => volumeStackByDay.some((row) => Number(row[c.key]) > 0));

  const hasAnyChart =
    pieData.length > 0 ||
    areaChartData.length > 0 ||
    dailyForLine.length > 0 ||
    volSlice.length > 0 ||
    hasStackVolume ||
    volByCategoryStack.length > 0;

  if (!hasAnyChart) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Gráficos</h2>
        <p className="text-slate-500 text-sm">
          Quando você registrar sessões e respostas, aqui aparecem pizza de acertos/erros, desempenho por matéria, volume
          por dia e por categoria (com acertos).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white">Gráficos</h2>
        <p className="text-slate-500 text-sm mt-1">Indicadores de estudo e performance por matéria.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {pieData.length > 0 && (
          <div className="min-h-[260px] flex flex-col">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Acertos vs erros (total)</h3>
            <div className="flex-1 min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {pieData.map((e, i) => (
                      <Cell key={i} fill={e.color} stroke="#0f172a" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(v: number) => [`${v} questões`, ""]}
                  />
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {areaChartData.length > 0 && (
          <div className="min-h-[260px] flex flex-col">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Taxa de acerto por matéria</h3>
            <div className="flex-1 min-h-[220px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={areaChartData} margin={{ left: 4, right: 12, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={AXIS} tickFormatter={(v) => `${v}%`} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={108}
                    tick={AXIS}
                    interval={0}
                    tickFormatter={(v) => (String(v).length > 14 ? `${String(v).slice(0, 12)}…` : v)}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(v: number, _n, p) => {
                      const row = p?.payload as AreaRow;
                      return [`${v}% (${row?.correct ?? "—"}/${row?.answered ?? "—"})`, "Acerto"];
                    }}
                  />
                  <Bar dataKey="pct" fill="#38bdf8" radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {dailyForLine.length > 0 && (
          <div className="min-h-[260px] flex flex-col">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Evolução do % no dia (calendário)</h3>
            <p className="text-slate-600 text-xs mb-2">Cada ponto é um dia em que houve questão corrigida no app.</p>
            <div className="flex-1 min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyForLine} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="label" tick={AXIS} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis domain={[0, 100]} tick={AXIS} tickFormatter={(v) => `${v}%`} width={40} />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(v: number) => [`${v}%`, "Acertos no dia"]}
                    labelFormatter={(_, p) => (p?.[0]?.payload?.day as string) || ""}
                  />
                  <Line
                    type="monotone"
                    dataKey="pct"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#a78bfa" }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {volSlice.length > 0 && (
          <div className="min-h-[260px] flex flex-col">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Volume total por dia (sessão)</h3>
            <p className="text-slate-600 text-xs mb-2">Questões enviadas na sessão e acertos (todas as matérias).</p>
            <div className="flex-1 min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volSlice} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="short" tick={AXIS} interval="preserveStartEnd" minTickGap={8} />
                  <YAxis tick={AXIS} width={32} allowDecimals={false} />
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(v: number, name: string) => {
                      if (name === "Questões") return [v, "Questões (sessão)"];
                      if (name === "Acertos") return [v, "Acertos (sessão)"];
                      if (name === "sessions") return [v, "Sessões"];
                      return [v, name];
                    }}
                    labelFormatter={(_, p) => (p?.[0]?.payload?.d as string) || ""}
                  />
                  <Bar dataKey="questions" fill="#6366f1" radius={[2, 2, 0, 0]} name="Questões" />
                  <Bar dataKey="correct" fill="#34d399" radius={[2, 2, 0, 0]} name="Acertos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {(hasStackVolume || volByCategoryStack.length > 0) && (
        <div className="flex flex-col gap-10 pt-2 border-t border-slate-800/80">
          {hasStackVolume && (
            <div className="min-h-[280px] flex flex-col w-full">
              <h3 className="text-sm font-medium text-slate-400 mb-1">Volume por dia e por matéria</h3>
              <p className="text-slate-600 text-xs mb-3">
                Barras empilhadas: quantas questões você respondeu em cada área por dia. No tooltip: também os acertos
                daquela área naquele dia.
              </p>
              <div className="flex-1 min-h-[240px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeStackByDay} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                    <XAxis dataKey="short" tick={AXIS} interval="preserveStartEnd" minTickGap={6} />
                    <YAxis tick={AXIS} width={36} allowDecimals={false} />
                    <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                      labelStyle={{ color: "#e2e8f0" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const day = String(payload[0]?.payload?.d ?? "");
                        const corr = correctByDayMap.get(day);
                        return (
                          <div className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs shadow-lg">
                            <p className="font-medium text-slate-200 mb-1">{day}</p>
                            <ul className="space-y-0.5 text-slate-300">
                              {payload
                                .filter((p) => Number(p.value) > 0)
                                .map((p) => {
                                  const key = String(p.dataKey);
                                  const n = Number(p.value);
                                  const ac = corr?.[key] ?? 0;
                                  return (
                                    <li key={key}>
                                      <span style={{ color: p.color }}>{p.name}</span>: {n} questões · {ac} acertos
                                    </li>
                                  );
                                })}
                            </ul>
                          </div>
                        );
                      }}
                    />
                    {volumeStackCategories.map((c) => (
                      <Bar
                        key={c.key}
                        dataKey={c.key}
                        stackId="area"
                        fill={c.color}
                        name={c.label}
                        radius={[0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {volByCategoryStack.length > 0 && (
            <div className="min-h-[280px] flex flex-col w-full">
              <h3 className="text-sm font-medium text-slate-400 mb-1">Volume por matéria: acertos e erros</h3>
              <p className="text-slate-600 text-xs mb-3">
                Total de questões respondidas em cada área, separando o que acertou (verde) e errou (vermelho).
              </p>
              <div className="flex-1 min-h-[240px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={volByCategoryStack}
                    margin={{ left: 4, right: 16, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                    <XAxis type="number" tick={AXIS} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={112}
                      tick={AXIS}
                      interval={0}
                      tickFormatter={(v) => (String(v).length > 16 ? `${String(v).slice(0, 14)}…` : v)}
                    />
                    <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                      labelStyle={{ color: "#e2e8f0" }}
                      formatter={(v: number, name: string) => {
                        if (name === "Acertos") return [v, "Acertos"];
                        if (name === "Erros") return [v, "Erros"];
                        return [v, name];
                      }}
                    />
                    <Bar dataKey="Acertos" stackId="cat" fill="#34d399" name="Acertos" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Erros" stackId="cat" fill="#f87171" name="Erros" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
