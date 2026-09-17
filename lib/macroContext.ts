// Pure types and heuristics for the Performance macro context. This module has
// no provider, Next.js, or React imports so the interpretation rules stay easy
// to test and the client bundle does not pull in server-only code.

export type MacroRange = "1Y" | "5Y" | "10Y";
export type MacroSeriesId = "us3m" | "us5y" | "us10y" | "us30y";
export type MacroTrend = "rising" | "falling" | "range-bound" | "unavailable";
export type MacroRating = "low" | "moderate" | "high" | "unavailable";
export type MacroConfidence = "low" | "medium" | "high";
export type CurveStatus = "normal" | "flat" | "inverted" | "unavailable";
export type SignalStatus = "supportive" | "caution" | "neutral" | "unavailable";

export interface MacroBar {
  date: string;
  value: number;
}

export interface MacroSeries {
  id: MacroSeriesId;
  label: string;
  unit: string;
  color: string;
  bars: MacroBar[];
  error?: string;
}

export interface MacroCurveAssessment {
  shortId: MacroSeriesId;
  longId: MacroSeriesId;
  shortLabel: string;
  longLabel: string;
  spreadPct: number | null;
  spreadBp: number | null;
  status: CurveStatus;
  explanation: string;
}

export interface MacroSignal {
  label: string;
  status: SignalStatus;
  detail: string;
}

export type ShortCyclePhase =
  | "early expansion / recovery"
  | "mid-cycle expansion"
  | "late-cycle tightening"
  | "contraction / recession risk"
  | "easing / renewed recovery";

export interface ShortCycleAssessment {
  phase: ShortCyclePhase;
  phaseIndex: number;
  confidence: MacroConfidence;
  explanation: string;
  signals: MacroSignal[];
}

export interface MacroRegimeAssessment {
  inflationPressure: MacroRating;
  inflationExplanation: string;
  recessionRisk: MacroRating;
  recessionExplanation: string;
  growthMomentum: MacroRating;
  growthExplanation: string;
  monetaryPolicy: "easing" | "neutral" | "tightening" | "unavailable";
  monetaryPolicyExplanation: string;
  yieldCurve: CurveStatus;
}

export interface MacroAssessment {
  latestDate: string | null;
  rateTrend: MacroTrend;
  rateTrendExplanation: string;
  curve: MacroCurveAssessment;
  regime: MacroRegimeAssessment;
  shortCycle: ShortCycleAssessment;
  longCycle: {
    dataBacked: false;
    title: string;
    explanation: string;
  };
}

export interface MacroContextResponse {
  fetchedAt: string;
  range: MacroRange;
  source: string;
  sourceNote: string;
  outlook: {
    status: "unavailable";
    explanation: string;
  };
  series: MacroSeries[];
  assessment: MacroAssessment;
}

export const MACRO_SERIES_DEFINITIONS: Record<MacroSeriesId, Omit<MacroSeries, "bars" | "error">> = {
  us3m: { id: "us3m", label: "US 3M Treasury", unit: "Yield (%)", color: "#4f46e5" },
  us5y: { id: "us5y", label: "US 5Y Treasury", unit: "Yield (%)", color: "#0ea5e9" },
  us10y: { id: "us10y", label: "US 10Y Treasury", unit: "Yield (%)", color: "#f59e0b" },
  us30y: { id: "us30y", label: "US 30Y Treasury", unit: "Yield (%)", color: "#10b981" },
};

const SERIES_ORDER: MacroSeriesId[] = ["us3m", "us5y", "us10y", "us30y"];

function latestBar(series: MacroSeries | undefined): MacroBar | null {
  return series?.bars.at(-1) ?? null;
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function finiteValues(bars: MacroBar[]): number[] {
  return bars.map((bar) => bar.value).filter((value) => Number.isFinite(value));
}

export function calculateMacroTrend(series: MacroSeries | undefined): MacroTrend {
  const values = finiteValues(series?.bars ?? []);
  if (values.length < 42) return "unavailable";

  const recent = average(values.slice(-21));
  const previous = average(values.slice(-42, -21));
  if (recent == null || previous == null) return "unavailable";
  const difference = recent - previous;
  if (difference > 0.04) return "rising";
  if (difference < -0.04) return "falling";
  return "range-bound";
}

export function calculateCurveAssessment(series: MacroSeries[]): MacroCurveAssessment {
  const byId = new Map(series.map((item) => [item.id, item]));
  const short = latestBar(byId.get("us3m"));
  const long = latestBar(byId.get("us10y"));

  if (!short || !long) {
    return {
      shortId: "us3m", longId: "us10y", shortLabel: "3M", longLabel: "10Y",
      spreadPct: null, spreadBp: null, status: "unavailable",
      explanation: "The 3M–10Y spread cannot be calculated from the available observations.",
    };
  }

  const spreadPct = long.value - short.value;
  const spreadBp = spreadPct * 100;
  const status: CurveStatus = spreadPct < -0.1 ? "inverted" : spreadPct > 0.1 ? "normal" : "flat";
  const direction = spreadBp >= 0 ? "+" : "";
  const explanation = `${short.date}: ${short.value.toFixed(2)}% 3M versus ${long.value.toFixed(2)}% 10Y (${direction}${spreadBp.toFixed(0)} bp). ${status === "inverted" ? "Short rates are above long rates." : status === "flat" ? "The gap is narrow." : "Long rates are above short rates."}`;

  return {
    shortId: "us3m", longId: "us10y", shortLabel: "3M", longLabel: "10Y",
    spreadPct, spreadBp, status, explanation,
  };
}

function ratingForCurve(curve: MacroCurveAssessment): MacroRating {
  if (curve.status === "unavailable") return "unavailable";
  if (curve.status === "inverted") return curve.spreadPct != null && curve.spreadPct < -0.25 ? "high" : "moderate";
  if (curve.status === "flat") return "moderate";
  return "low";
}

function curveSignal(curve: MacroCurveAssessment): MacroSignal {
  if (curve.status === "unavailable") {
    return { label: "3M–10Y curve", status: "unavailable", detail: "Not enough rate observations." };
  }
  return {
    label: "3M–10Y curve",
    status: curve.status === "normal" ? "supportive" : "caution",
    detail: curve.status === "inverted" ? `${curve.spreadBp?.toFixed(0)} bp inverted — recession risk signal, not a forecast.` : curve.status === "flat" ? `${curve.spreadBp?.toFixed(0)} bp — curve is close to flat.` : `${curve.spreadBp?.toFixed(0)} bp positive — no inversion signal from this curve.`,
  };
}

export function buildMacroAssessment(series: MacroSeries[]): MacroAssessment {
  const curve = calculateCurveAssessment(series);
  const primaryRateSeries = series.find((item) => item.id === "us10y") ?? series.find((item) => item.id === "us5y");
  const rateTrend = calculateMacroTrend(primaryRateSeries);
  const latestDate = series
    .flatMap((item) => item.bars.map((bar) => bar.date))
    .sort()
    .at(-1) ?? null;
  const trendDetail = rateTrend === "unavailable"
    ? "Not enough daily observations to classify the recent market-rate trend."
    : `${primaryRateSeries?.label ?? "Treasury rates"} are ${rateTrend} over the latest comparison window. This describes market yields, not official Fed guidance.`;

  const recessionRisk = ratingForCurve(curve);
  const phase: ShortCyclePhase = curve.status === "inverted" && (curve.spreadPct ?? 0) < -0.25
    ? "contraction / recession risk"
    : curve.status === "inverted"
      ? "late-cycle tightening"
      : rateTrend === "falling"
        ? "easing / renewed recovery"
        : rateTrend === "rising"
          ? "late-cycle tightening"
          : "mid-cycle expansion";
  const phaseIndex: Record<ShortCyclePhase, number> = {
    "early expansion / recovery": 0,
    "mid-cycle expansion": 1,
    "late-cycle tightening": 2,
    "contraction / recession risk": 3,
    "easing / renewed recovery": 4,
  };
  const availableSignals = [curve.status !== "unavailable", rateTrend !== "unavailable"].filter(Boolean).length;
  const confidence: MacroConfidence = availableSignals >= 3 ? "high" : availableSignals >= 2 ? "low" : "low";
  const trendSignal: MacroSignal = rateTrend === "unavailable"
    ? { label: "10Y market-rate trend", status: "unavailable", detail: trendDetail }
    : { label: "10Y market-rate trend", status: rateTrend === "rising" ? "caution" : rateTrend === "falling" ? "supportive" : "neutral", detail: trendDetail };

  return {
    latestDate,
    rateTrend,
    rateTrendExplanation: trendDetail,
    curve,
    regime: {
      inflationPressure: "unavailable",
      inflationExplanation: "Inflation data is not connected yet; Treasury yields alone cannot establish current inflation pressure.",
      recessionRisk,
      recessionExplanation: curve.status === "unavailable" ? "Not enough curve data for a rate-based recession-risk read." : `${curve.status === "inverted" ? "The inverted " : "The available "}3M–10Y curve is a caution signal, but it is not a recession forecast. Labor, credit, and growth data are not included in this first pass.`,
      growthMomentum: "unavailable",
      growthExplanation: "Growth data is not connected yet.",
      monetaryPolicy: "unavailable",
      monetaryPolicyExplanation: "The current provider does not supply a reliable Federal Funds Rate series in this module.",
      yieldCurve: curve.status,
    },
    shortCycle: {
      phase,
      phaseIndex: phaseIndex[phase],
      confidence,
      explanation: "Educational heuristic based only on the available Treasury curve and recent market-rate trend. Add inflation, labor, credit, and growth series before treating the phase as a broader macro classification.",
      signals: [curveSignal(curve), trendSignal, { label: "Inflation, labor, credit, and growth", status: "unavailable", detail: "Not connected in this first pass; cycle confidence is intentionally limited." }],
    },
    longCycle: {
      dataBacked: false,
      title: "Conceptual long-term debt cycle",
      explanation: "This framework is educational only. The app does not yet have a historical debt, credit, or debt-service dataset capable of locating the current economy on a long-term cycle.",
    },
  };
}

export function sortMacroSeries(series: MacroSeries[]): MacroSeries[] {
  return SERIES_ORDER.map((id) => series.find((item) => item.id === id)).filter((item): item is MacroSeries => Boolean(item));
}
