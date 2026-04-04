import type { QuestionItem } from "./items";

const AREA_LABEL: Record<string, string> = {
  linguagens: "Linguagens (Português, estrangeiras, interpretação)",
  matematica: "Matemática e suas tecnologias",
  natureza: "Ciências da Natureza",
  humanas: "Ciências Humanas",
  mista: "Misto / interdisciplinar",
};

/** Rótulo para estudo após erro — prioriza study_topic do item. */
export function resolveStudyTopic(it: QuestionItem): string {
  const st = (it as QuestionItem & { study_topic?: string }).study_topic;
  if (st) return st;
  const a = (it.area || "").toLowerCase();
  return AREA_LABEL[a] || it.area || "Geral / revisar enunciado";
}

export function areaLabel(area: string): string {
  return AREA_LABEL[area.toLowerCase()] || area;
}
