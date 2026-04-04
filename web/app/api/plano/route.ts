import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { loadItemsIndex } from "@/lib/items";
import { getRepoRoot } from "@/lib/repoRoot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiaPlano = {
  nome: string;
  resumo?: string;
  blocos: { assunto: string; atividade: string; minutos: string }[];
};

type PlanoFile = {
  aluno: string;
  serie: string;
  escopo?: Record<string, string>;
  metas: Record<string, string | number>;
  semana: Record<string, DiaPlano>;
  videos_politica?: string;
  documentacao_repo?: { titulo: string; caminho: string }[];
};

type VideoTopic = {
  topic_id: string;
  label: string;
  youtube_query: string;
  suggested_channels: string[];
};

function parseQuestoesNoLabel(label: string): number {
  const m = label.match(/\((\d+)\s*q\)/i);
  return m ? parseInt(m[1], 10) : 0;
}

export async function GET() {
  const root = getRepoRoot();
  let plano: PlanoFile;
  try {
    const raw = fs.readFileSync(path.join(root, "data", "plano_estudo.json"), "utf-8");
    plano = JSON.parse(raw) as PlanoFile;
  } catch {
    return NextResponse.json({ error: "plano_estudo.json não encontrado" }, { status: 500 });
  }

  let videos: { topics: VideoTopic[] } = { topics: [] };
  try {
    const vraw = fs.readFileSync(path.join(root, "data", "curadoria_videos.json"), "utf-8");
    videos = JSON.parse(vraw) as { topics: VideoTopic[] };
  } catch {
    /* opcional */
  }

  const idx = loadItemsIndex();
  let totalQuestoes = 0;
  const porArea: Record<string, number> = {};
  for (const p of idx.pools) {
    const n = parseQuestoesNoLabel(p.label);
    totalQuestoes += n;
    const a = p.area || "outros";
    porArea[a] = (porArea[a] || 0) + n;
  }

  const wd = new Date().getDay();
  const chave = String(wd);
  const dia = plano.semana[chave] ?? {
    nome: "—",
    blocos: [],
  };

  const videoLinks = (videos.topics || []).map((t) => ({
    topic_id: t.topic_id,
    label: t.label,
    youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(t.youtube_query)}`,
    youtube_query: t.youtube_query,
    suggested_channels: t.suggested_channels || [],
  }));

  return NextResponse.json({
    aluno: plano.aluno,
    serie: plano.serie,
    escopo: plano.escopo ?? null,
    metas: plano.metas,
    hoje: {
      diaSemana: wd,
      chave,
      ...dia,
    },
    acervo: {
      totalQuestoes,
      numPools: idx.pools.length,
      porArea,
      pools: idx.pools.map((p) => ({
        id: p.id,
        label: p.label,
        questoes: parseQuestoesNoLabel(p.label),
        area: p.area,
      })),
    },
    videos: videoLinks,
    videos_politica: plano.videos_politica,
    documentacao_repo: plano.documentacao_repo ?? [],
  });
}
