"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchApiJson } from "@/lib/clientApiLog";

type Aula = {
  titulo: string;
  youtube_url: string;
  youtube_query: string;
  canais: string[];
};

type BlocoGuia = {
  assunto: string;
  atividade: string;
  minutos: string;
  aulas: Aula[];
};

type GuiaPayload = {
  aluno?: string;
  serie?: string;
  intro?: string;
  hoje: {
    nome: string;
    resumo?: string;
    blocos: BlocoGuia[];
  };
  sessaoNoApp: {
    titulo: string;
    linhas: string[];
    totalQuestoes: number;
  };
  curadoria: {
    topic_id: string;
    label: string;
    youtube_url: string;
    suggested_channels: string[];
  }[];
  lembrete?: {
    metaQuestoesDia: number;
    rodadaQuestoes: number;
    revisao: string;
  };
};

export default function EstudoDoDiaPage() {
  const [data, setData] = useState<GuiaPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchApiJson<GuiaPayload>("/api/guia", undefined, "GET /api/guia").then((d) => {
      if (d) setData(d);
      else setErr("Não foi possível carregar — ver Consola (F12) [Filipe:api].");
    });
  }, []);

  if (err || !data) {
    return (
      <div className="text-slate-400 w-full min-w-0">
        {err || "Carregando…"}
        <p className="mt-4">
          <Link href="/" className="text-sky-400 hover:underline">
            Painel
          </Link>
        </p>
      </div>
    );
  }

  const { hoje, sessaoNoApp, curadoria, intro, lembrete } = data;

  return (
    <div className="space-y-8 w-full min-w-0 max-w-full">
      <header className="space-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Estudo do dia</h1>
        <p className="text-slate-400 text-sm max-w-2xl">{intro}</p>
        {lembrete && (
          <p className="text-slate-300 text-sm">
            Meta do dia: cerca de <strong className="text-emerald-300">{lembrete.metaQuestoesDia}</strong> questões
            respondidas
            {lembrete.revisao ? (
              <>
                {" "}
                · revisão: <span className="text-slate-400">{lembrete.revisao}</span>
              </>
            ) : null}
            . Na rodada do app: <strong className="text-white">{lembrete.rodadaQuestoes}</strong> por vez.
          </p>
        )}
        <Link
          href="/study"
          className="inline-flex rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-4 py-2.5 text-sm font-medium"
        >
          Ir às atividades
        </Link>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-white mb-1">Hoje — {hoje.nome}</h2>
        {hoje.resumo && <p className="text-slate-500 text-sm mb-4">{hoje.resumo}</p>}
        {hoje.blocos.length === 0 ? (
          <p className="text-slate-500 text-sm">Dia de descanso ou leitura leve.</p>
        ) : (
          <ul className="space-y-5">
            {hoje.blocos.map((b, i) => (
              <li key={i} className="border-t border-slate-800/80 pt-4 first:border-0 first:pt-0">
                <p className="text-white font-medium">
                  {b.assunto}{" "}
                  <span className="text-slate-500 font-normal text-sm">· ~{b.minutos}</span>
                </p>
                <p className="text-slate-400 text-sm mt-1">{b.atividade}</p>
                <ul className="mt-3 space-y-2">
                  {b.aulas.map((a, j) => (
                    <li key={j}>
                      <a
                        href={a.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:text-sky-300 text-sm font-medium"
                      >
                        ▶ {a.titulo}
                      </a>
                      {a.canais.length > 0 && (
                        <span className="text-slate-600 text-xs block mt-0.5">{a.canais.join(" · ")}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-base font-semibold text-white mb-2">{sessaoNoApp.titulo}</h2>
        <p className="text-slate-400 text-sm mb-2">
          Cerca de <strong className="text-slate-200">{sessaoNoApp.totalQuestoes}</strong> questões por rodada.
        </p>
        <ul className="text-sm text-slate-500 space-y-1 list-disc list-inside">
          {sessaoNoApp.linhas.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </section>

      {curadoria.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-base font-semibold text-white mb-3">Outros temas úteis</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {curadoria.map((c) => (
              <a
                key={c.topic_id}
                href={c.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-slate-700/80 bg-slate-950/40 px-3 py-3 hover:border-sky-600/50 transition-colors"
              >
                <span className="text-sky-400 text-sm font-medium">{c.label}</span>
                {c.suggested_channels.length > 0 && (
                  <span className="text-slate-600 text-xs block mt-1">{c.suggested_channels.join(", ")}</span>
                )}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
