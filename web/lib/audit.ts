/**
 * Heurísticas leves para marcar sessões para revisão humana (não pune automaticamente).
 */

export type AnswerRow = { time_ms: number; is_correct: number };

export function runAudit(sessionId: string, answers: AnswerRow[]): { kind: string; detail: string }[] {
  const flags: { kind: string; detail: string }[] = [];
  if (answers.length === 0) return flags;

  const times = answers.map((a) => a.time_ms).sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const acc = answers.filter((a) => a.is_correct).length / answers.length;

  if (median < 4000 && answers.length >= 8) {
    flags.push({
      kind: "fast_median",
      detail: `Mediana de tempo ${median}ms abaixo de 4s em bloco longo (session=${sessionId}).`,
    });
  }

  if (acc === 1 && answers.length >= 10 && median < 8000) {
    flags.push({
      kind: "perfect_fast",
      detail: "100% de acertos com tempos baixos — conferir se não houve gabarito visível.",
    });
  }

  return flags;
}
