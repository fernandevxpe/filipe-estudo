import fs from "fs";
import path from "path";
import { getRepoRoot } from "./repoRoot";

export type PoolInfo = {
  id: string;
  path: string;
  label: string;
  area?: string;
  /** enem | ssa | extra — usado na rodada mista do plano */
  kind?: string;
};

export type QuestionItem = {
  id: string;
  source: string;
  exam_id: string;
  question_number: number;
  area: string;
  /** Tópico sugerido para revisão após erro (SSA/extras; ENEM pode omitir). */
  study_topic?: string;
  stem: string;
  options: { key: string; text: string }[];
  correct: string | null;
  status: string;
  annulled: boolean;
  image_refs: string[];
  lingua_estrangeira?: string;
};

export function loadItemsIndex(): { pools: PoolInfo[] } {
  const p = path.join(getRepoRoot(), "data", "processed", "items_index.json");
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw) as { pools: PoolInfo[] };
}

export function loadPoolItems(relPath: string): QuestionItem[] {
  const p = path.join(getRepoRoot(), "data", "processed", relPath);
  const raw = fs.readFileSync(p, "utf-8");
  const data = JSON.parse(raw) as { items: QuestionItem[] };
  return data.items;
}
