"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getAssetSrc } from "@/lib/assetUrl";
import { normalizeImageRefsForClient } from "@/lib/imageRefs";
import { parseLogDayParam } from "@/lib/logDay";
import { fetchApiJson } from "@/lib/clientApiLog";

type Option = { key: string; text: string };

type ClientItem = {
  id: string;
  poolId: string;
  source: string;
  exam_id: string;
  question_number: number;
  area: string;
  study_topic?: string;
  stem: string;
  options: Option[];
  image_refs: string[];
};

type EntryOut = { itemId: string; poolId: string; choice?: string; timeMs: number; skipped?: boolean };

type SessionResult = {
  correct: number;
  wrong: number;
  graded: number;
  skipped: number;
  answeredCount: number;
  score: number;
  byQuestion: {
    itemId: string;
    poolId: string;
    stemPreview: string;
    choice: string | null;
    correctLetter: string | null;
    isCorrect: boolean | null;
    timeMs: number;
    skipped: boolean;
    study_topic: string;
    area: string;
  }[];
  studyGaps: { topic: string; count: number }[];
  wrongRefs: { poolId: string; itemId: string }[];
};

const HINT_LS_KEY = "filipe-hide-enem-continuation-hint";
const DRAFT_KEY = "filipe-study-draft-v4";
const DEFAULT_LIMIT = 15;

function StudyAssetFigure({ refPath }: { refPath: string }) {
  const [failed, setFailed] = useState(false);
  const src = getAssetSrc(refPath);
  if (failed) {
    return (
      <div className="rounded-lg border border-rose-900/40 bg-rose-950/25 px-4 py-3 text-sm text-rose-200/90 space-y-1">
        <p className="font-medium text-rose-300">Figura não carregou</p>
        <p className="text-[11px] text-rose-200/70 break-all font-mono leading-snug">{refPath}</p>
        <p className="text-xs text-slate-500">Anote o id da questão (no topo) e este caminho para correção.</p>
      </div>
    );
  }
  return (
    <figure className="space-y-1 w-full min-w-0 max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={refPath.includes("fullpage") ? "Página da prova (figura / pôster)" : "Figura da questão"}
        className="block w-full max-w-full h-auto max-h-[min(85vh,36rem)] object-contain object-top rounded-lg border border-slate-700 bg-slate-950"
        onError={() => setFailed(true)}
        loading="lazy"
      />
      {refPath.includes("fullpage") && (
        <figcaption className="text-xs text-slate-500 px-1">
          Página original do caderno — inclui pôster ou ilustração vetorial.
        </figcaption>
      )}
    </figure>
  );
}

function stemSuggestsContinuation(stem: string): boolean {
  const lastLine = stem.trim().split(/\n+/).pop()?.trim() ?? "";
  if (lastLine.length < 10) return false;
  const lower = lastLine.toLowerCase();
  const phrases = [
    "é necessário",
    "é preciso",
    "necessidade de",
    "objetivo de",
    "finalidade de",
    "função de",
    "ato de",
    "ideia de",
    "de que",
    "para que",
    "crença de que",
    "reside na crença de que",
    "tem o propósito de",
    "faz referência ao ato de",
    "objetiva",
    "cumpre o propósito de",
  ];
  if (phrases.some((p) => lower.endsWith(p))) return true;
  const lastWord = lastLine.split(/\s+/).pop() ?? "";
  return /^(de|que|ao|à|a|o|em|com|por|no|na|do|da|dos|das)$/i.test(lastWord);
}

type DraftV3 = {
  v: 3;
  mode: "daily" | "single";
  poolId: string;
  area: string;
  items: ClientItem[];
  entries: EntryOut[];
  sessionKind: string;
};

function StudyPageContent() {
  const searchParams = useSearchParams();
  const logDay = useMemo(() => parseLogDayParam(searchParams.get("forDay")), [searchParams]);

  /** Data em que esta rodada entra no calendário (forDay ou hoje local). */
  const questionnaireMeta = useMemo(() => {
    const iso =
      logDay ??
      (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const long = dt.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const short = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
    return { iso, short, long, pickedOnCalendar: Boolean(logDay) };
  }, [logDay]);
  const autoDailyLaunch = useRef(false);
  const [mode, setMode] = useState<"daily" | "single">("daily");
  const [poolId, setPoolId] = useState<string>("");
  const [pools, setPools] = useState<{ id: string; label: string; area?: string; kind?: string }[]>([]);
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [items, setItems] = useState<ClientItem[]>([]);
  const [entries, setEntries] = useState<EntryOut[]>([]);
  const [sessionKind, setSessionKind] = useState<string>("daily_mixed");
  const [phase, setPhase] = useState<"idle" | "running" | "result">("idle");
  const [result, setResult] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [hideContinuationHint, setHideContinuationHint] = useState(false);
  const [diaResumo, setDiaResumo] = useState<{ hojeNome: string; metaDia: number } | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const startedRef = useRef<number>(0);
  const autoSubmitRef = useRef(false);
  const submitLockRef = useRef(false);

  const idx = entries.length;
  const current = items[idx];
  const total = items.length;
  const remaining = Math.max(0, total - idx);
  const answeredCount = entries.filter((e) => !e.skipped && e.choice).length;

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem(HINT_LS_KEY) === "1") {
        setHideContinuationHint(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchApiJson<{ pools?: { id: string; label: string; area?: string; kind?: string }[] }>(
      "/api/pools",
      undefined,
      "GET /api/pools"
    ).then((d) => {
      if (!d) return;
      const ps = d.pools || [];
      setPools(ps);
      if (ps[0]) setPoolId(ps[0].id);
    });
  }, []);

  useEffect(() => {
    fetchApiJson<{ error?: string; hoje?: { nome?: string }; lembrete?: { metaQuestoesDia?: number } }>(
      "/api/guia",
      undefined,
      "GET /api/guia (study)"
    ).then((p) => {
      if (!p || p.error) return;
      setDiaResumo({
        hojeNome: p.hoje?.nome ?? "—",
        metaDia: p.lembrete?.metaQuestoesDia ?? DEFAULT_LIMIT,
      });
    });
  }, []);

  const persistDraft = useCallback(
    (d: Partial<DraftV3> | null) => {
      try {
        if (!d || phase !== "running" || items.length === 0) {
          if (d === null) localStorage.removeItem(DRAFT_KEY);
          return;
        }
        const full: DraftV3 = {
          v: 3,
          mode: d.mode ?? mode,
          poolId: d.poolId ?? poolId,
          area: d.area ?? areaFilter,
          items: d.items ?? items,
          entries: d.entries ?? entries,
          sessionKind: d.sessionKind ?? sessionKind,
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(full));
      } catch {
        /* ignore */
      }
    },
    [phase, items, entries, mode, poolId, areaFilter, sessionKind]
  );

  useEffect(() => {
    if (phase === "running" && items.length > 0) {
      persistDraft({ mode, poolId, area: areaFilter, items, entries, sessionKind });
    }
  }, [phase, items, entries, mode, poolId, areaFilter, sessionKind, persistDraft]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as DraftV3;
      if (d.v !== 3 || !d.items?.length) return;
      setDraftNotice(`Rascunho: ${d.entries.length}/${d.items.length} questões — pode continuar.`);
    } catch {
      /* ignore */
    }
  }, []);

  const resumeDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as DraftV3;
      if (d.v !== 3 || !d.items?.length) return;
      autoSubmitRef.current = false;
      setMode(d.mode);
      setPoolId(d.poolId);
      setAreaFilter(d.area || "");
      setItems(d.items);
      setEntries(d.entries);
      setSessionKind(d.sessionKind || "daily_mixed");
      setPhase("running");
      setResult(null);
      startedRef.current = performance.now();
      setDraftNotice(null);
    } catch {
      /* ignore */
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setDraftNotice(null);
  };

  const startDaily = useCallback(() => {
    autoSubmitRef.current = false;
    setLoading(true);
    setResult(null);
    setEntries([]);
    fetchApiJson<{ error?: string; items?: ClientItem[]; mode?: string }>(
      "/api/daily-bundle",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: DEFAULT_LIMIT,
          area: areaFilter || null,
        }),
      },
      "POST /api/daily-bundle"
    )
      .then((d) => {
        if (!d) return;
        if (d.error) {
          console.warn("[Filipe:api] POST /api/daily-bundle", d.error);
          alert(d.error);
          return;
        }
        setItems(d.items || []);
        setSessionKind(d.mode === "retry_wrong" ? "retry_wrong" : "daily_mixed");
        setPhase("running");
        startedRef.current = performance.now();
        clearDraft();
      })
      .finally(() => setLoading(false));
  }, [areaFilter]);

  useEffect(() => {
    if (searchParams.get("daily") !== "1") return;
    setMode("daily");
    if (autoDailyLaunch.current) return;
    if (phase !== "idle") return;
    autoDailyLaunch.current = true;
    startDaily();
  }, [searchParams, phase, startDaily]);

  const startSinglePool = useCallback(() => {
    if (!poolId) return;
    autoSubmitRef.current = false;
    setLoading(true);
    setResult(null);
    setEntries([]);
    fetchApiJson<{ items?: (ClientItem & { id: string })[] }>(
      `/api/pool/${poolId}?offset=0&limit=${DEFAULT_LIMIT}`,
      undefined,
      `GET /api/pool/${poolId}`
    )
      .then((d) => {
        if (!d) return;
        const raw = d.items || [];
        const mapped: ClientItem[] = raw.map((it) => ({
          ...it,
          poolId: poolId,
        }));
        setItems(mapped);
        setSessionKind("single");
        setPhase("running");
        startedRef.current = performance.now();
        clearDraft();
      })
      .finally(() => setLoading(false));
  }, [poolId]);

  const startRetryWrong = useCallback((refs: { poolId: string; itemId: string }[]) => {
    if (!refs.length) return;
    autoSubmitRef.current = false;
    setLoading(true);
    setResult(null);
    setEntries([]);
    fetchApiJson<{ items?: ClientItem[]; error?: string }>(
      "/api/daily-bundle",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyRefs: refs, limit: DEFAULT_LIMIT }),
      },
      "POST /api/daily-bundle (retry_wrong)"
    )
      .then((d) => {
        if (!d) return;
        if (d.error) console.warn("[Filipe:api] retry_wrong", d.error);
        setItems(d.items || []);
        setSessionKind("retry_wrong");
        setPhase("running");
        startedRef.current = performance.now();
      })
      .finally(() => setLoading(false));
  }, []);

  const pushEntry = (e: EntryOut) => {
    setEntries((prev) => [...prev, e]);
    startedRef.current = performance.now();
  };

  const concludeSession = useCallback(() => {
    if (submitLockRef.current) return;
    if (entries.length === 0) {
      alert("Nenhuma resposta para enviar.");
      return;
    }
    submitLockRef.current = true;
    setLoading(true);
    fetchApiJson<SessionResult & { error?: string }>(
      "/api/session",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionKind,
          poolId: sessionKind === "single" ? poolId : "daily_mixed",
          entries,
          ...(logDay ? { forDay: logDay } : {}),
        }),
      },
      "POST /api/session"
    )
      .then((d) => {
        if (!d) return;
        if (d.error) {
          console.warn("[Filipe:api] POST /api/session", d.error);
          alert(d.error);
        } else {
          setResult(d as SessionResult);
          setPhase("result");
          clearDraft();
        }
      })
      .finally(() => {
        setLoading(false);
        submitLockRef.current = false;
      });
  }, [entries, sessionKind, poolId, logDay]);

  const showContinuationHint = useMemo(
    () => Boolean(current && !hideContinuationHint && stemSuggestsContinuation(current.stem)),
    [current, hideContinuationHint]
  );

  const sortedImageRefs = useMemo(
    () => normalizeImageRefsForClient(current?.image_refs ?? []),
    [current?.image_refs]
  );

  const progressPct = total ? (idx / total) * 100 : 0;

  const pick = (key: string) => {
    if (!current) return;
    const t = Math.round(performance.now() - startedRef.current);
    pushEntry({ itemId: current.id, poolId: current.poolId, choice: key, timeMs: t });
  };

  const skipQuestion = () => {
    if (!current) return;
    pushEntry({ itemId: current.id, poolId: current.poolId, timeMs: 0, skipped: true });
  };

  useEffect(() => {
    if (phase !== "running" || total === 0) return;
    if (idx < total) {
      autoSubmitRef.current = false;
      return;
    }
    if (autoSubmitRef.current) return;
    autoSubmitRef.current = true;
    concludeSession();
  }, [phase, idx, total, concludeSession]);

  const areaOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of pools) {
      if (p.area) s.add(p.area);
    }
    ["linguagens", "matematica", "humanas", "natureza"].forEach((a) => s.add(a));
    return Array.from(s).sort();
  }, [pools]);

  return (
    <div className="space-y-8 w-full min-w-0 max-w-full">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Atividades</h1>
        <p className="text-slate-400 text-sm">
          Até <strong className="text-emerald-300">{DEFAULT_LIMIT}</strong> questões por rodada. Você pode pular,
          encerrar antes e ver o resultado com tempo por questão.{" "}
          <Link href="/guia" className="text-sky-400 hover:underline whitespace-nowrap">
            Estudo do dia (vídeos)
          </Link>
        </p>
        {diaResumo && (
          <p className="mt-2 text-sm text-slate-500">
            Hoje é <strong className="text-slate-300">{diaResumo.hojeNome}</strong> · meta de cerca de{" "}
            <strong className="text-emerald-300/90">{diaResumo.metaDia}</strong> respostas no dia.
          </p>
        )}
        {phase !== "result" && (
          <p className="mt-2 text-sm rounded-lg border border-slate-700/80 bg-slate-950/70 text-slate-300 px-3 py-2 space-y-1">
            <span className="block">
              <strong className="text-white">Questionário</strong> · {questionnaireMeta.short}{" "}
              <span className="text-slate-500">·</span>{" "}
              <span className="capitalize text-slate-400">{questionnaireMeta.long}</span>
            </span>
            <span className="block text-xs text-slate-500">
              {questionnaireMeta.pickedOnCalendar
                ? "Desempenho registrado no dia escolhido no calendário."
                : "Desempenho registrado como hoje (data local)."}
              {questionnaireMeta.pickedOnCalendar && (
                <>
                  {" "}
                  <Link href="/study?daily=1" className="text-sky-400 hover:underline">
                    Contar como hoje
                  </Link>
                </>
              )}
            </span>
            <code className="block text-[11px] text-slate-600 font-mono select-all" title="Identificação para suporte / correção">
              {questionnaireMeta.iso}
            </code>
          </p>
        )}
        {draftNotice && phase === "idle" && (
          <div className="mt-2 flex flex-wrap gap-2 items-center text-sm text-amber-200/90">
            {draftNotice}
            <button type="button" onClick={resumeDraft} className="text-sky-400 hover:underline">
              Continuar
            </button>
            <button type="button" onClick={clearDraft} className="text-slate-500 hover:text-slate-400">
              Descartar
            </button>
          </div>
        )}
        {hideContinuationHint && (
          <button
            type="button"
            onClick={() => {
              setHideContinuationHint(false);
              try {
                localStorage.removeItem(HINT_LS_KEY);
              } catch {
                /* ignore */
              }
            }}
            className="text-sky-400/90 hover:text-sky-300 text-xs mt-2 underline underline-offset-2"
          >
            Reativar dica quando o enunciado continua na alternativa
          </button>
        )}
      </div>

      {phase === "idle" && (
        <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="radio"
                name="mode"
                checked={mode === "daily"}
                onChange={() => setMode("daily")}
                className="text-sky-500"
              />
              Rodada do dia (recomendada)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="radio"
                name="mode"
                checked={mode === "single"}
                onChange={() => setMode("single")}
                className="text-sky-500"
              />
              Um banco só ({DEFAULT_LIMIT} questões)
            </label>
          </div>

          {mode === "daily" && (
            <label className="flex flex-col gap-1 text-sm text-slate-300 max-w-xs">
              Começar por tema (área)
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="">Todas (mistura completa)</option>
                {areaOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">
                Filtra itens dentro de cada banca; pools só com outras áreas podem contribuir menos.
              </span>
            </label>
          )}

          {mode === "single" && (
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Banco
              <select
                value={poolId}
                onChange={(e) => setPoolId(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white min-w-[260px]"
              >
                {pools.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={() => (mode === "daily" ? startDaily() : startSinglePool())}
            disabled={loading || (mode === "single" && !poolId)}
            className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium"
          >
            Iniciar {DEFAULT_LIMIT} questões
          </button>
        </div>
      )}

      {phase === "running" && (
        <div className="space-y-4 w-full min-w-0 max-w-full">
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-amber-100/90"
            role="status"
          >
            <span className="font-medium text-amber-200">Progresso do dia</span>
            <span className="text-slate-400">|</span>
            <span>
              <strong className="text-white">{questionnaireMeta.short}</strong>
            </span>
            <span className="text-slate-500 capitalize truncate max-w-[min(100%,14rem)] sm:max-w-none">
              {questionnaireMeta.long}
            </span>
            <code className="ml-auto text-[10px] text-slate-500 font-mono hidden sm:inline">{questionnaireMeta.iso}</code>
          </div>
          <div className="flex flex-wrap gap-3 items-center justify-between text-sm text-slate-400">
            <span>
              Progresso: <strong className="text-white">{idx}</strong> / {total} · Respondidas:{" "}
              <strong className="text-emerald-300">{answeredCount}</strong> · Faltam:{" "}
              <strong className="text-amber-200">{remaining}</strong>
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={skipQuestion}
                disabled={!current || loading}
                className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm"
              >
                Pular questão
              </button>
              <button
                type="button"
                onClick={concludeSession}
                disabled={entries.length === 0 || loading}
                className="px-3 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-sm"
              >
                Concluir agora
              </button>
            </div>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>

          <details className="text-sm text-slate-500 bg-slate-900/50 border border-slate-800 rounded-lg p-3">
            <summary className="cursor-pointer text-slate-400">O que já fez nesta rodada</summary>
            <ol className="mt-2 space-y-1 list-decimal list-inside max-h-40 overflow-y-auto text-xs">
              {entries.map((e, i) => {
                const meta = items.find((it) => it.id === e.itemId && it.poolId === e.poolId);
                return (
                  <li key={`${e.itemId}-${i}`} className="text-slate-400">
                    {e.skipped ? (
                      <span className="text-amber-400">Pulada</span>
                    ) : (
                      <span className="text-slate-300">Resposta {e.choice}</span>
                    )}{" "}
                    · nº {meta?.question_number ?? "—"} · <span className="text-slate-500">{e.poolId}</span> ·{" "}
                    <code className="text-[10px] text-slate-600">{e.itemId}</code>
                  </li>
                );
              })}
            </ol>
          </details>

          {current && (
            <article className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-8 space-y-6 w-full min-w-0 max-w-3xl mx-auto overflow-x-hidden box-border">
              <div className="flex flex-wrap gap-2 text-sky-400 text-sm font-semibold min-w-0">
                <span>
                  #{idx + 1} de {total}
                </span>
                <span className="text-slate-500 font-normal">·</span>
                <span className="text-amber-200/90 font-medium" title={questionnaireMeta.iso}>
                  {questionnaireMeta.short}
                </span>
                <span className="text-slate-500 font-normal">·</span>
                <span className="text-slate-400 font-normal">{current.source}</span>
                <span className="text-slate-500 font-normal">·</span>
                <span className="text-violet-300 font-normal">{current.area}</span>
                {current.study_topic && (
                  <>
                    <span className="text-slate-500 font-normal">·</span>
                    <span className="text-slate-500 font-normal text-xs">{current.study_topic}</span>
                  </>
                )}
              </div>
              {sortedImageRefs.map((ref) => (
                <StudyAssetFigure key={ref} refPath={ref} />
              ))}
              <div
                lang="pt-BR"
                className="text-slate-100 text-base sm:text-lg leading-relaxed whitespace-pre-wrap break-words w-full min-w-0"
              >
                {current.stem}
              </div>
              {showContinuationHint && (
                <div className="text-slate-500 text-sm leading-snug border-l-2 border-sky-600/40 pl-3 -mt-2 space-y-2">
                  <p>
                    Este comando parece continuar na alternativa: leia o enunciado junto com A, B, C… (comum no
                    ENEM).
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
                    <input
                      type="checkbox"
                      className="rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setHideContinuationHint(true);
                          try {
                            localStorage.setItem(HINT_LS_KEY, "1");
                          } catch {
                            /* ignore */
                          }
                        }
                      }}
                    />
                    Não mostrar esta dica de novo
                  </label>
                </div>
              )}
              <div className="grid gap-3 pt-2 border-t border-slate-800 w-full min-w-0">
                {current.options.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => pick(o.key)}
                    className="text-left px-4 py-3.5 rounded-lg border border-slate-700 hover:border-sky-500 hover:bg-slate-800/80 transition-colors w-full min-w-0"
                  >
                    <span className="font-semibold text-sky-300 mr-2">{o.key})</span>
                    <span className="text-slate-200 text-base leading-relaxed break-words">{o.text}</span>
                  </button>
                ))}
              </div>
            </article>
          )}
        </div>
      )}

      {phase === "result" && result && (
        <div className="space-y-6">
          <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-6 space-y-3">
            <h2 className="text-xl font-semibold text-emerald-300">Resultado</h2>
            <p className="text-sm text-slate-400 border-b border-emerald-900/50 pb-3 mb-1">
              Questionário do dia <strong className="text-slate-200">{questionnaireMeta.short}</strong>
              <span className="text-slate-500"> · </span>
              <span className="capitalize">{questionnaireMeta.long}</span>
              <code className="ml-2 text-[11px] text-slate-500 font-mono align-middle">{questionnaireMeta.iso}</code>
            </p>
            <p className="text-slate-300">
              Acertos: <strong>{result.correct}</strong> · Erros: <strong>{result.wrong}</strong> · Corrigidas:{" "}
              <strong>{result.graded}</strong> · Puladas: <strong>{result.skipped}</strong> · Respostas que contam no
              cronograma: <strong>{result.answeredCount}</strong>
            </p>
            <p className="text-slate-300">
              Aproveitamento (sobre o que foi respondido):{" "}
              <strong>{(result.score * 100).toFixed(1)}%</strong>
            </p>
            <p className="text-slate-500 text-sm">
              Meta: ir bem na rodada (no painel, verde a partir de 70% de acertos no dia). Você pode refazer as
              erradas ou abrir de novo a rodada do dia pelo calendário até ficar confortável.
            </p>
          </div>

          {result.studyGaps.length > 0 && (
            <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-6 space-y-2">
              <h3 className="text-lg font-semibold text-rose-200">Revisar (por erro)</h3>
              <ul className="text-sm text-slate-300 list-disc list-inside space-y-1">
                {result.studyGaps.map((g) => (
                  <li key={g.topic}>
                    <strong>{g.topic}</strong> — {g.count} erro(s)
                  </li>
                ))}
              </ul>
              {result.wrongRefs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPhase("idle");
                    setResult(null);
                    setEntries([]);
                    startRetryWrong(result.wrongRefs);
                  }}
                  className="mt-2 text-sm text-sky-400 hover:underline"
                >
                  Refazer só as erradas (até {DEFAULT_LIMIT})
                </button>
              )}
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-x-auto">
            <h3 className="text-white font-medium">Tempo por questão</h3>
            <p className="text-xs text-slate-500 mt-1 mb-3">
              Dia do questionário: <strong className="text-slate-400">{questionnaireMeta.short}</strong> (
              <code className="text-slate-600">{questionnaireMeta.iso}</code>) · colunas <em>Banco</em> e{" "}
              <em>id</em> ajudam a achar a questão nos dados.
            </p>
            <table className="w-full text-xs text-left text-slate-400">
              <thead>
                <tr className="border-b border-slate-700 text-slate-500">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Banco</th>
                  <th className="py-2 pr-2">id</th>
                  <th className="py-2 pr-2">Trecho</th>
                  <th className="py-2 pr-2">Sua</th>
                  <th className="py-2 pr-2">Gabarito</th>
                  <th className="py-2 pr-2">Tempo</th>
                  <th className="py-2">Assunto</th>
                </tr>
              </thead>
              <tbody>
                {result.byQuestion.map((q, i) => (
                  <tr key={q.itemId + i} className="border-b border-slate-800/80">
                    <td className="py-2 pr-2 align-top">{i + 1}</td>
                    <td className="py-2 pr-2 align-top text-slate-500 whitespace-nowrap max-w-[120px] truncate" title={q.poolId}>
                      {q.poolId}
                    </td>
                    <td className="py-2 pr-2 align-top font-mono text-[10px] text-slate-600 max-w-[140px] break-all">
                      {q.itemId}
                    </td>
                    <td className="py-2 pr-2 align-top text-slate-300 max-w-[200px]">{q.stemPreview}</td>
                    <td className="py-2 pr-2 align-top">
                      {q.skipped ? "—" : q.choice}
                      {q.skipped && <span className="text-amber-500"> pulou</span>}
                    </td>
                    <td className="py-2 pr-2 align-top">{q.correctLetter ?? "—"}</td>
                    <td className="py-2 pr-2 align-top whitespace-nowrap">
                      {q.timeMs < 1000 ? `${q.timeMs} ms` : `${(q.timeMs / 1000).toFixed(1)} s`}
                    </td>
                    <td className="py-2 align-top text-slate-500">{q.study_topic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => {
              setPhase("idle");
              setResult(null);
              setItems([]);
              setEntries([]);
            }}
            className="text-sky-400 hover:underline text-sm"
          >
            Nova rodada
          </button>
        </div>
      )}

      {loading && <p className="text-slate-500 text-sm">Carregando…</p>}
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-8 text-slate-500">Carregando…</div>}>
      <StudyPageContent />
    </Suspense>
  );
}
