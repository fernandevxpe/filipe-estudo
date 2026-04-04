"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAssetSrc } from "@/lib/assetUrl";
import { normalizeImageRefsForClient } from "@/lib/imageRefs";

const FLAGS_LS = "filipe-diagnostic-flags-v1";

type ClientItem = {
  id: string;
  poolId: string;
  source: string;
  exam_id: string;
  question_number: number;
  area: string;
  stem: string;
  options: { key: string; text: string }[];
  image_refs: string[];
};

type CalendarPayload = {
  mode: "calendar";
  date: string;
  weekdayName: string;
  weekIndex: number;
  poolId: string | null;
  poolLabel: string | null;
  note: string | null;
  items: ClientItem[];
};

type QueuePayload = {
  mode: "queue";
  dayIndex: number;
  chunkSize: number;
  totalItems: number;
  totalDays: number;
  items: ClientItem[];
  note: string | null;
};

function StudyAssetFigure({ refPath }: { refPath: string }) {
  const [failed, setFailed] = useState(false);
  const src = getAssetSrc(refPath);
  if (failed) {
    return (
      <div className="rounded-lg border border-rose-900/40 bg-rose-950/25 px-4 py-3 text-sm text-rose-200/90 space-y-1">
        <p className="font-medium text-rose-300">Figura não carregou</p>
        <p className="text-[11px] text-rose-200/70 break-all font-mono leading-snug">{refPath}</p>
      </div>
    );
  }
  return (
    <figure className="space-y-1 w-full min-w-0 max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={refPath.includes("fullpage") ? "Página da prova" : "Figura da questão"}
        className="block w-full max-w-full h-auto max-h-[min(85vh,36rem)] object-contain object-top rounded-lg border border-slate-700 bg-slate-950"
        onError={() => setFailed(true)}
        loading="lazy"
      />
    </figure>
  );
}

function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadFlagSet(): Set<string> {
  try {
    const raw = localStorage.getItem(FLAGS_LS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveFlagSet(s: Set<string>) {
  localStorage.setItem(FLAGS_LS, JSON.stringify(Array.from(s)));
}

export default function DiagnosticoPage() {
  const [view, setView] = useState<"calendar" | "queue">("queue");
  const [date, setDate] = useState(todayIso);
  const [dayIndex, setDayIndex] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [calPayload, setCalPayload] = useState<CalendarPayload | null>(null);
  const [queuePayload, setQueuePayload] = useState<QueuePayload | null>(null);
  const [flags, setFlags] = useState<Set<string>>(new Set());

  const items = view === "calendar" ? calPayload?.items ?? [] : queuePayload?.items ?? [];
  const current = items[qIdx];
  const sortedRefs = useMemo(
    () => normalizeImageRefsForClient(current?.image_refs ?? []),
    [current?.image_refs]
  );

  const flagKeyStr = useMemo(() => {
    if (!current) return "";
    if (view === "calendar") return `c|${date}|${current.poolId}|${current.id}`;
    return `q|${dayIndex}|${current.poolId}|${current.id}`;
  }, [current, view, date, dayIndex]);

  const isFlagged = Boolean(flagKeyStr && flags.has(flagKeyStr));

  useEffect(() => {
    setFlags(loadFlagSet());
  }, []);

  useEffect(() => {
    setQIdx(0);
    setLoading(true);
    const url =
      view === "calendar" ? `/api/diagnostic/day?date=${encodeURIComponent(date)}` : `/api/diagnostic/queue?dayIndex=${dayIndex}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (view === "calendar") setCalPayload(d as CalendarPayload);
        else setQueuePayload(d as QueuePayload);
      })
      .catch(() => {
        if (view === "calendar") setCalPayload(null);
        else setQueuePayload(null);
      })
      .finally(() => setLoading(false));
  }, [view, date, dayIndex]);

  const toggleFlag = () => {
    const k = flagKeyStr;
    if (!k) return;
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      saveFlagSet(next);
      return next;
    });
  };

  const exportFlags = () => {
    const list = Array.from(flags).map((k) => {
      const parts = k.split("|");
      if (parts[0] === "c") {
        return { modo: "calendario", date: parts[1], poolId: parts[2], itemId: parts[3] };
      }
      if (parts[0] === "q") {
        return { modo: "fila", dayIndex: Number(parts[1]), poolId: parts[2], itemId: parts[3] };
      }
      return { raw: k };
    });
    const blob = new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), marcadas: list }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `filipe-diagnostico-marcadas.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const clearAllFlags = () => {
    if (!confirm("Remover todas as marcações guardadas neste navegador?")) return;
    setFlags(new Set());
    saveFlagSet(new Set());
  };

  const flaggedCount = flags.size;

  return (
    <div className="space-y-6 text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Modo diagnóstico</h1>
          <p className="text-slate-400 text-sm mt-1 max-w-xl">
            Percorra questão a questão. Marque o checkbox se algo estiver errado (texto, figura, alternativas) para
            tratar depois. Os dados ficam só neste navegador até exportar.
          </p>
        </div>
        <Link href="/study" className="text-sm text-sky-400 hover:text-sky-300 shrink-0">
          ← Voltar às atividades
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView("queue")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${view === "queue" ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300"}`}
        >
          Fila completa (acervo)
        </button>
        <button
          type="button"
          onClick={() => setView("calendar")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${view === "calendar" ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300"}`}
        >
          Plano (calendário)
        </button>
      </div>

      {view === "calendar" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <label className="text-sm text-slate-400">
            Data
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="ml-2 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-slate-100"
            />
          </label>
          <button
            type="button"
            onClick={() => setDate((d) => addDaysIso(d, -1))}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
          >
            Dia anterior
          </button>
          <button
            type="button"
            onClick={() => setDate((d) => addDaysIso(d, 1))}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
          >
            Próximo dia
          </button>
        </div>
      )}

      {view === "queue" && queuePayload && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <span className="text-sm text-slate-300">
            Dia <strong className="text-white">{queuePayload.dayIndex + 1}</strong> de{" "}
            <strong className="text-white">{queuePayload.totalDays}</strong> · {queuePayload.totalItems} questões no total
          </span>
          <button
            type="button"
            disabled={dayIndex <= 0}
            onClick={() => setDayIndex((i) => Math.max(0, i - 1))}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700 disabled:opacity-40"
          >
            ← Bloco anterior
          </button>
          <button
            type="button"
            disabled={dayIndex >= queuePayload.totalDays - 1}
            onClick={() => setDayIndex((i) => i + 1)}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700 disabled:opacity-40"
          >
            Próximo bloco →
          </button>
        </div>
      )}

      {loading && <p className="text-slate-500 text-sm">A carregar…</p>}

      {!loading && (calPayload?.note || queuePayload?.note) && (
        <p className="text-sm text-slate-400 border-l-2 border-sky-600/50 pl-3">
          {view === "calendar" ? calPayload?.note : queuePayload?.note}
        </p>
      )}

      {!loading && items.length === 0 && (
        <p className="text-amber-200/90 text-sm">Nenhuma questão neste dia — mude de data ou de bloco.</p>
      )}

      {!loading && current && (
        <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/40 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-slate-400 space-y-1">
              <p>
                <span className="text-slate-500">Questão no dia:</span>{" "}
                <strong className="text-white">
                  {qIdx + 1} / {items.length}
                </strong>
              </p>
              <p className="font-mono text-xs break-all">
                {current.poolId} · {current.id} · Nº {current.question_number}
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-100 hover:bg-amber-950/50">
              <input
                type="checkbox"
                checked={isFlagged}
                onChange={toggleFlag}
                className="rounded border-amber-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
              />
              Marcar para corrigir depois
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={qIdx <= 0}
              onClick={() => setQIdx((i) => i - 1)}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm disabled:opacity-40"
            >
              ← Questão anterior
            </button>
            <button
              type="button"
              disabled={qIdx >= items.length - 1}
              onClick={() => setQIdx((i) => i + 1)}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm disabled:opacity-40"
            >
              Próxima questão →
            </button>
          </div>

          {sortedRefs.map((ref) => (
            <StudyAssetFigure key={ref} refPath={ref} />
          ))}

          <div lang="pt-BR" className="text-slate-100 text-base leading-relaxed whitespace-pre-wrap break-words">
            {current.stem}
          </div>

          <ul className="space-y-2 text-slate-200">
            {current.options.map((o) => (
              <li key={o.key} className="flex gap-2 text-sm">
                <span className="font-semibold text-sky-400 w-6 shrink-0">{o.key}</span>
                <span>{o.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 space-y-3">
        <h2 className="text-sm font-medium text-slate-300">Marcadas (neste dispositivo)</h2>
        <p className="text-2xl font-semibold text-white">{flaggedCount}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportFlags}
            disabled={flaggedCount === 0}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm text-white hover:bg-sky-600 disabled:opacity-40"
          >
            Exportar JSON
          </button>
          <button
            type="button"
            onClick={clearAllFlags}
            disabled={flaggedCount === 0}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            Limpar todas
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Edite <code className="text-slate-400">data/diagnostic_config.json</code> para mudar âncora, rotação de
          cadernos e tamanho dos blocos da fila.
        </p>
      </div>
    </div>
  );
}
