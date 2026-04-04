import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getRepoRoot } from "@/lib/repoRoot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Bloco = { assunto: string; atividade: string; minutos: string };
type DiaPlano = { nome: string; resumo?: string; blocos: Bloco[] };
type PlanoFile = {
  aluno?: string;
  serie?: string;
  semana: Record<string, DiaPlano>;
  videos_politica?: string;
  metas?: Record<string, string | number>;
};
type MixConfig = { total_target?: number; from_kind?: Record<string, number> };
type Recurso = { titulo: string; youtube_query: string; canais?: string[] };
type MapaEntry = { match: string; recursos: Recurso[] };
type GuiaLinksFile = {
  intro?: string;
  sessao_mista?: { titulo?: string; linhas?: string[]; ajuste_em?: string };
  mapa_bloco?: MapaEntry[];
};

type CuradoriaFile = {
  topics: { topic_id: string; label: string; youtube_query: string; suggested_channels: string[] }[];
};

function ytUrl(q: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function recursosParaAssunto(assunto: string, mapa: MapaEntry[]): Recurso[] {
  const a = assunto.toLowerCase();
  const out: Recurso[] = [];
  const seen = new Set<string>();
  for (const m of mapa) {
    if (a.includes(m.match.toLowerCase()) || m.match.toLowerCase().includes(a)) {
      for (const r of m.recursos) {
        const k = r.titulo + r.youtube_query;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(r);
      }
    }
  }
  if (out.length === 0) {
    out.push({
      titulo: `Busca sugerida: ${assunto}`,
      youtube_query: `${assunto} ENEM vestibular aula`,
      canais: [],
    });
  }
  return out;
}

export async function GET() {
  const root = getRepoRoot();
  let plano: PlanoFile;
  let guiaExtra: GuiaLinksFile = {};
  let mix: MixConfig = {};
  let curadoria: CuradoriaFile = { topics: [] };

  try {
    plano = JSON.parse(fs.readFileSync(path.join(root, "data", "plano_estudo.json"), "utf-8")) as PlanoFile;
  } catch {
    return NextResponse.json({ error: "plano_estudo.json ausente" }, { status: 500 });
  }

  try {
    guiaExtra = JSON.parse(fs.readFileSync(path.join(root, "data", "guia_dia_links.json"), "utf-8")) as GuiaLinksFile;
  } catch {
    /* ok */
  }

  try {
    mix = JSON.parse(fs.readFileSync(path.join(root, "data", "daily_mix_config.json"), "utf-8")) as MixConfig;
  } catch {
    /* ok */
  }

  try {
    curadoria = JSON.parse(fs.readFileSync(path.join(root, "data", "curadoria_videos.json"), "utf-8")) as CuradoriaFile;
  } catch {
    /* ok */
  }

  const wd = new Date().getDay();
  const hoje = plano.semana[String(wd)] ?? { nome: "—", blocos: [] };
  const mapa = guiaExtra.mapa_bloco || [];

  const blocosComApoio = hoje.blocos.map((b) => {
    const recursos = recursosParaAssunto(b.assunto, mapa);
    return {
      ...b,
      aulas: recursos.map((r) => ({
        titulo: r.titulo,
        youtube_query: r.youtube_query,
        youtube_url: ytUrl(r.youtube_query),
        canais: r.canais || [],
      })),
    };
  });

  const curadoriaLinks = (curadoria.topics || []).map((t) => ({
    topic_id: t.topic_id,
    label: t.label,
    youtube_url: ytUrl(t.youtube_query),
    youtube_query: t.youtube_query,
    suggested_channels: t.suggested_channels || [],
  }));

  const totalMix = mix.total_target ?? 15;
  const fk = mix.from_kind || {};

  const metas = plano.metas || {};
  const metaDia = Number(metas.questoes_novas_seg_sex) || Number(metas.sessao_app_padrao) || 15;
  const rodada = mix.total_target ?? (Number(metas.sessao_app_padrao) || 15);

  return NextResponse.json({
    aluno: plano.aluno,
    serie: plano.serie,
    intro: guiaExtra.intro,
    hoje: {
      diaSemana: wd,
      nome: hoje.nome,
      resumo: hoje.resumo,
      blocos: blocosComApoio,
    },
    sessaoNoApp: {
      titulo: guiaExtra.sessao_mista?.titulo ?? "Rodada no app",
      linhas: guiaExtra.sessao_mista?.linhas ?? [],
      totalQuestoes: totalMix,
      composicao: {
        enem: fk.enem ?? 0,
        ssa: fk.ssa ?? 0,
        extra: fk.extra ?? 0,
      },
    },
    curadoria: curadoriaLinks,
    lembrete: {
      metaQuestoesDia: metaDia,
      rodadaQuestoes: rodada,
      revisao: String(metas.revisao_espacada ?? ""),
    },
  });
}
