import type { QuestionItem } from "./items";
import { filterImageRefsForServer } from "@/lib/imageRefsServer";
import {
  normalizeImageRefsForClient,
  stripKnownBadImageRefs,
} from "@/lib/imageRefs";

/** Filtro completo só no servidor (arquivo existe + PNG válido + anti-faixa). */
export function sanitizeImageRefsForApi(refs: string[]): string[] {
  const step1 = stripKnownBadImageRefs(refs || []);
  const step2 = filterImageRefsForServer(step1);
  return normalizeImageRefsForClient(step2);
}

/** Item enviado ao cliente (sem gabarito). */
export type PublicQuestionItem = {
  id: string;
  poolId: string;
  source: string;
  exam_id: string;
  question_number: number;
  area: string;
  study_topic?: string;
  stem: string;
  options: { key: string; text: string }[];
  image_refs: string[];
  lingua_estrangeira?: string;
};

export function toPublicItem(poolId: string, it: QuestionItem): PublicQuestionItem {
  const study_topic = (it as QuestionItem & { study_topic?: string }).study_topic;
  return {
    id: it.id,
    poolId,
    source: it.source,
    exam_id: it.exam_id,
    question_number: it.question_number,
    area: it.area,
    ...(study_topic ? { study_topic } : {}),
    stem: it.stem,
    options: it.options,
    image_refs: sanitizeImageRefsForApi(it.image_refs || []),
    ...(it.lingua_estrangeira ? { lingua_estrangeira: it.lingua_estrangeira } : {}),
  };
}

// Re-export para APIs que só precisam dos tipos utilitários de imagem no servidor
export { normalizeImageRefsForClient, stripKnownBadImageRefs } from "@/lib/imageRefs";
