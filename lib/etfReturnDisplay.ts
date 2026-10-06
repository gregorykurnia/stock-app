import type { ETFMetricSnapshot } from "./etfCatalog";

export type ETFTableReturnMetric = "cagr5Y" | "cagr3Y" | "totalReturn1Y";

export interface ETFTableReturn {
  metricKey: ETFTableReturnMetric;
  periodLabel: string;
  valueOverride?: number;
  stateOverride?: string;
}

function hasNumericValue(snapshot: ETFMetricSnapshot | undefined, key: "cagr5Y" | "cagr3Y") {
  const value = snapshot?.values[key];
  return typeof value === "number" && Number.isFinite(value);
}

export function preferredETFTableReturn(
  snapshot?: ETFMetricSnapshot,
  identityWarning?: string | null,
): ETFTableReturn {
  if (identityWarning) return { metricKey: "cagr5Y", periodLabel: "Identity review" };
  if (hasNumericValue(snapshot, "cagr5Y")) return { metricKey: "cagr5Y", periodLabel: "5Y CAGR" };
  if (hasNumericValue(snapshot, "cagr3Y")) return { metricKey: "cagr3Y", periodLabel: "3Y CAGR" };

  const sinceInception = snapshot?.sinceInceptionReturn;
  if (sinceInception && Number.isFinite(sinceInception.value)) {
    return {
      metricKey: sinceInception.annualized ? "cagr5Y" : "totalReturn1Y",
      periodLabel: sinceInception.annualized ? "Since inception CAGR" : "Since inception total return",
      valueOverride: sinceInception.value,
      stateOverride: "Available",
    };
  }

  return { metricKey: "cagr5Y", periodLabel: "Return period unavailable" };
}
