export interface TotalReturnPoint { date: string; value: number }

const yearsBetween = (a: string, b: string) =>
  (new Date(b).getTime() - new Date(a).getTime()) / (365.2425 * 86_400_000);

export function cagr(start: number | null, end: number | null, years: number): number | null {
  if (start == null || end == null || start <= 0 || end <= 0 || years <= 0) return null;
  return Math.pow(end / start, 1 / years) - 1;
}

export function trailingCagr(points: TotalReturnPoint[], years: number): number | null {
  if (points.length < 2) return null;
  const end = points.at(-1)!;
  const target = new Date(end.date); target.setUTCFullYear(target.getUTCFullYear() - years);
  const start = points.find((p) => new Date(p.date) >= target);
  if (!start || yearsBetween(start.date, end.date) < years * 0.9) return null;
  return cagr(start.value, end.value, yearsBetween(start.date, end.date));
}

export function rollingCagrs(points: TotalReturnPoint[], years = 5): { start: string; end: string; value: number }[] {
  const months = years * 12;
  const out: { start: string; end: string; value: number }[] = [];
  for (let i = months; i < points.length; i++) {
    const start = points[i - months], end = points[i];
    const elapsed = yearsBetween(start.date, end.date);
    const value = cagr(start.value, end.value, elapsed);
    if (value != null && elapsed >= years * 0.9) out.push({ start: start.date, end: end.date, value });
  }
  return out;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function drawdownStats(points: TotalReturnPoint[]) {
  let peak = -Infinity, peakDate = "", max = 0, start = "", bottom = "", recovery: string | null = null;
  let activePeakDate = "", activeBottomDate = "", activeBottom = 0;
  let longestDays = 0, longestStart = "", longestEnd: string | null = null;
  for (const p of points) {
    if (p.value >= peak) {
      if (activePeakDate) {
        const days = (new Date(p.date).getTime() - new Date(activePeakDate).getTime()) / 86_400_000;
        if (days > longestDays) { longestDays = days; longestStart = activePeakDate; longestEnd = p.date; }
        if (activeBottomDate === bottom && recovery == null) recovery = p.date;
      }
      peak = p.value; peakDate = p.date; activePeakDate = p.date; activeBottomDate = ""; activeBottom = 0;
    } else if (peak > 0) {
      const dd = p.value / peak - 1;
      if (dd < activeBottom) { activeBottom = dd; activeBottomDate = p.date; }
      if (dd < max) { max = dd; start = peakDate; bottom = p.date; recovery = null; }
    }
  }
  if (activePeakDate && points.length) {
    const last = points.at(-1)!.date;
    const days = (new Date(last).getTime() - new Date(activePeakDate).getTime()) / 86_400_000;
    if (days > longestDays) { longestDays = days; longestStart = activePeakDate; longestEnd = null; }
  }
  const recoveryDays = recovery && bottom ? Math.round((new Date(recovery).getTime() - new Date(bottom).getTime()) / 86_400_000) : null;
  return { maximumDrawdown: max || null, maximumDrawdownPeriod: start && bottom ? `${start} to ${bottom}` : null, recoveryDays, recovered: recovery != null, longestUnderwaterDays: longestDays || null, longestUnderwaterPeriod: longestStart ? `${longestStart} to ${longestEnd ?? "present"}` : null };
}

export function expectedReturn(growth: number | null, dividendYield: number | null, buybackYield: number | null, currentMultiple: number | null, year5Multiple: number | null) {
  const valuation = currentMultiple && year5Multiple && currentMultiple > 0 && year5Multiple > 0 ? Math.pow(year5Multiple / currentMultiple, 1 / 5) - 1 : null;
  const parts = [growth, dividendYield, buybackYield, valuation];
  return { fundamentalGrowthContribution: growth, dividendContribution: dividendYield, buybackContribution: buybackYield, valuationChangeContribution: valuation, expectedAnnualizedReturn: parts.every((v) => v != null) ? parts.reduce<number>((s, v) => s + (v ?? 0), 0) : null };
}

export const SCORE_WEIGHTS = { businessQualityScore: .25, fundamentalCompoundingScore: .25, financialResilienceScore: .10, historicalReturnQualityScore: .15, valuationScore: .20, managementCapitalAllocationScore: .05 } as const;

export function compounderScore(scores: Partial<Record<keyof typeof SCORE_WEIGHTS, number | null>>) {
  const available = Object.entries(SCORE_WEIGHTS).filter(([key]) => scores[key as keyof typeof SCORE_WEIGHTS] != null);
  const weight = available.reduce((s, [, w]) => s + w, 0);
  const score = weight ? available.reduce((s, [key, w]) => s + (scores[key as keyof typeof SCORE_WEIGHTS]! / 10) * w, 0) / weight * 100 : null;
  const missing = Object.keys(SCORE_WEIGHTS).filter((key) => scores[key as keyof typeof SCORE_WEIGHTS] == null);
  return { score, completeness: weight, missing };
}
