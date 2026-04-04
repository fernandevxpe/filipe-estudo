/** Valida `YYYY-MM-DD` para uso em daily_log (calendário). */
export function parseLogDayParam(s: string | null | undefined): string | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return undefined;
  if (y < 2000 || y > 2100) return undefined;
  return s;
}
