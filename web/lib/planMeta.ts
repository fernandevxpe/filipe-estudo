import fs from "fs";
import path from "path";
import { getRepoRoot } from "./repoRoot";

/** Meta diária de questões respondidas (cronograma); fallback 15. */
export function readPlanDailyQuestionTarget(): number {
  try {
    const raw = fs.readFileSync(path.join(getRepoRoot(), "data", "plano_estudo.json"), "utf-8");
    const j = JSON.parse(raw) as { metas?: { sessao_app_padrao?: number; questoes_novas_seg_sex?: number } };
    const n = Number(j.metas?.sessao_app_padrao ?? j.metas?.questoes_novas_seg_sex);
    if (Number.isFinite(n) && n > 0) return Math.min(120, Math.floor(n));
  } catch {
    /* ignore */
  }
  return 15;
}
