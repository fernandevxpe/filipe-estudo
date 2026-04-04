/** Cores do calendário com base no desempenho acumulado do dia (questões corrigidas no app). */
export type DayTier = "green" | "yellow" | "red";

export function tierFromCumulative(correctCum: number, gradedCum: number): DayTier {
  const g = gradedCum || 0;
  const c = correctCum || 0;
  if (g <= 0) return "red";
  const pct = (c / g) * 100;
  if (pct >= 70) return "green";
  if (pct >= 30) return "yellow";
  return "red";
}

export function dayPctLabel(correctCum: number, gradedCum: number): string | null {
  const g = gradedCum || 0;
  if (g <= 0) return null;
  return `${Math.round(((correctCum || 0) / g) * 100)}%`;
}
