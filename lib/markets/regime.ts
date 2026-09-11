// Market regime classification for the four summary cards on /markets.
//
// These are deliberately simple, deterministic, fully transparent rules — every
// signal and its contribution is surfaced in the UI so the classification can be
// audited, not just trusted. They are market indicators, not investment advice.
//
// Sign convention (consistent across all four cards): a POSITIVE score is
// supportive for risk assets, a NEGATIVE score is a headwind for risk assets.
//   Risk sentiment     positive = risk-on          negative = risk-off
//   Inflation pressure positive = inflation cooling negative = inflation heating up
//   Rates pressure     positive = rates easing      negative = rates tightening
//   Commodity trend    positive = broad strength    negative = broad weakness

import { COMMODITY_IDS } from "./instruments";
import { median } from "./calc";
import type { MarketInstrument, RegimeState } from "./types";

export type RegimeCardKey = "risk-sentiment" | "inflation-pressure" | "rates-pressure" | "commodity-trend";

export interface RegimeSignal {
  label: string;       // e.g. "VIX level"
  reading: string;     // e.g. "17.8 — contained"
  contribution: number; // -2..+2
}

export interface RegimeCard {
  key: RegimeCardKey;
  title: string;
  state: RegimeState;
  label: string;       // reader-friendly state label
  explanation: string; // one sentence, template-generated from the data
  signals: RegimeSignal[];
  unavailableReason?: string;
}

type InstrumentMap = Record<string, MarketInstrument>;

function fmt(value: number | null | undefined, digits = 1, suffix = ""): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(digits)}${suffix}`;
}

function fmtLevel(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

function trendReading(trend: string): string {
  return trend === "unavailable" ? "insufficient data" : trend;
}

// score → state mapping shared by all cards (thresholds tuned per card below).
function stateFromScore(score: number, positiveThreshold: number, strongThreshold: number): RegimeState {
  if (score >= strongThreshold) return "strong-positive";
  if (score >= positiveThreshold) return "positive";
  if (score <= -strongThreshold) return "strong-negative";
  if (score <= -positiveThreshold) return "negative";
  return "neutral";
}

// ---------------------------------------------------------------- risk sentiment

function riskSentimentCard(map: InstrumentMap): RegimeCard {
  const spx = map.sp500;
  const rut = map.russell2000;
  const vix = map.vix;
  const dxy = map.dxy;
  const hyg = map.hyg;
  const lqd = map.lqd;

  const signals: RegimeSignal[] = [];

  // 1. S&P 500 trend
  if (spx && !spx.error) {
    const contribution = spx.trend === "rising" ? 1 : spx.trend === "falling" ? -1 : 0;
    signals.push({ label: "S&P 500 trend", reading: `${trendReading(spx.trend)} (${fmt(spx.return1m)} 1M)`, contribution });
  }

  // 2. Russell 2000 vs S&P 500, 1M relative performance (normalized comparison)
  if (rut && spx && rut.return1m != null && spx.return1m != null && !rut.error && !spx.error) {
    const relative = rut.return1m - spx.return1m;
    const contribution = relative > 1 ? 1 : relative < -1 ? -1 : 0;
    signals.push({ label: "Russell 2000 vs S&P 500 (1M)", reading: `${fmt(relative)} pp relative`, contribution });
  }

  // 3. VIX level
  let vixLevel: number | null = null;
  if (vix && vix.price != null && !vix.error) {
    vixLevel = vix.price;
    const contribution = vixLevel < 15 ? 1 : vixLevel < 20 ? 0 : vixLevel < 25 ? -1 : -2;
    const band = vixLevel < 15 ? "low" : vixLevel < 20 ? "moderate" : vixLevel < 25 ? "elevated" : "high";
    signals.push({ label: "VIX level", reading: `${fmtLevel(vixLevel)} — ${band}`, contribution });
  }

  // 4. VIX 1-week direction
  if (vix && vix.return1w != null && !vix.error) {
    const contribution = vix.return1w <= -5 ? 1 : vix.return1w >= 5 ? -1 : 0;
    signals.push({ label: "VIX 1-week change", reading: `${fmt(vix.return1w, 1, "%")}`, contribution });
  }

  // 5. HYG/LQD credit-risk ratio, 1-month direction
  const creditRatio1m = ratioChangePct(hyg, lqd, "return1m");
  if (creditRatio1m != null) {
    const contribution = creditRatio1m > 0.5 ? 1 : creditRatio1m < -0.5 ? -1 : 0;
    signals.push({ label: "HYG/LQD ratio (1M)", reading: `${fmt(creditRatio1m)}% — ${creditRatio1m > 0.5 ? "reaching for yield" : creditRatio1m < -0.5 ? "credit caution" : "steady"}`, contribution });
  }

  // 6. US Dollar Index 1-month trend
  if (dxy && dxy.return1m != null && !dxy.error) {
    const contribution = dxy.return1m < -0.5 ? 1 : dxy.return1m > 0.5 ? -1 : 0;
    signals.push({ label: "US Dollar Index (1M)", reading: `${fmt(dxy.return1m, 1, "%")} — ${dxy.return1m < -0.5 ? "softer dollar" : dxy.return1m > 0.5 ? "firmer dollar" : "flat"}`, contribution });
  }

  const available = signals.length;
  if (available < 3 || vixLevel == null) {
    return {
      key: "risk-sentiment", title: "Risk Sentiment", state: "unavailable", label: "Not enough data",
      explanation: "Core risk inputs (S&P 500, VIX) are unavailable right now.",
      signals, unavailableReason: "Needs at least 3 signals including VIX.",
    };
  }

  const score = signals.reduce((sum, signal) => sum + signal.contribution, 0);
  const state = stateFromScore(score, 1, 3);
  const label = state === "strong-positive" ? "Risk-on" : state === "positive" ? "Mostly risk-on"
    : state === "neutral" ? "Neutral" : state === "negative" ? "Mostly risk-off" : "Risk-off";
  const vixWord = vixLevel >= 20 ? "elevated volatility" : vixLevel >= 15 ? "contained volatility" : "low volatility";
  const explanation = `S&P 500 ${trendReading(spx?.trend ?? "unavailable")} with VIX at ${fmtLevel(vixLevel)} and ${creditRatio1m == null ? "credit ratios unavailable" : creditRatio1m > 0 ? "credit ratios improving" : "credit ratios deteriorating"} — ${label.toLowerCase()} conditions.`;

  return { key: "risk-sentiment", title: "Risk Sentiment", state, label, explanation, signals };
}

// ------------------------------------------------------------ inflation pressure

function inflationPressureCard(map: InstrumentMap): RegimeCard {
  const wti = map.wti;
  const natgas = map.natgas;
  const gold = map.gold;
  const copper = map.copper;

  const signals: RegimeSignal[] = [];

  if (wti && wti.return1m != null && !wti.error) {
    const contribution = wti.return1m < -5 ? 1 : wti.return1m > 5 ? -1 : 0;
    signals.push({ label: "WTI crude (1M)", reading: `${fmt(wti.return1m, 1, "%")}`, contribution });
  }
  if (natgas && natgas.return1m != null && !natgas.error) {
    const contribution = natgas.return1m < -10 ? 1 : natgas.return1m > 10 ? -1 : 0;
    signals.push({ label: "Natural gas (1M)", reading: `${fmt(natgas.return1m, 1, "%")}`, contribution });
  }

  const commodityReturns = COMMODITY_IDS
    .map((id) => map[id]?.return1m)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const commodityMedian = median(commodityReturns);
  if (commodityMedian != null) {
    const contribution = commodityMedian < -3 ? 1 : commodityMedian > 3 ? -1 : 0;
    signals.push({ label: "Median commodity (1M)", reading: `${fmt(commodityMedian, 1, "%")} across ${commodityReturns.length} commodities`, contribution });
  }

  for (const [instrument, label] of [[gold, "Gold trend"], [copper, "Copper trend"]] as const) {
    if (instrument && !instrument.error && instrument.trend !== "unavailable") {
      const contribution = instrument.trend === "falling" ? 1 : instrument.trend === "rising" ? -1 : 0;
      signals.push({ label, reading: trendReading(instrument.trend), contribution });
    }
  }

  if (signals.length < 3) {
    return {
      key: "inflation-pressure", title: "Inflation Pressure", state: "unavailable", label: "Not enough data",
      explanation: "Commodity inputs are unavailable right now.",
      signals, unavailableReason: "Needs at least 3 commodity signals.",
    };
  }

  const score = signals.reduce((sum, signal) => sum + signal.contribution, 0);
  const state = stateFromScore(score, 1, 3);
  const label = state === "strong-positive" ? "Cooling" : state === "positive" ? "Mostly cooling"
    : state === "neutral" ? "Mixed" : state === "negative" ? "Heating up" : "Heating up sharply";
  const energyWord = wti?.return1m != null ? (wti.return1m > 5 ? "rising" : wti.return1m < -5 ? "falling" : "steady") : "unavailable";
  const explanation = `Energy is ${energyWord}${commodityMedian != null ? ` with the median commodity ${fmt(commodityMedian, 1, "%")} over 1M` : ""} — commodity-price pressure reads ${label.toLowerCase()}.`;

  return { key: "inflation-pressure", title: "Inflation Pressure", state, label, explanation, signals };
}

// --------------------------------------------------------------- rates pressure

function ratesPressureCard(map: InstrumentMap): RegimeCard {
  const tlt = map.tlt;
  const yields: Array<[MarketInstrument | undefined, string]> = [
    [map.us5y, "US 5Y yield (1M)"],
    [map.us10y, "US 10Y yield (1M)"],
    [map.us30y, "US 30Y yield (1M)"],
  ];

  const signals: RegimeSignal[] = [];
  for (const [instrument, label] of yields) {
    if (instrument && instrument.return1m != null && !instrument.error) {
      // return1m of a yield is a relative change; convert to an absolute bp move
      // by reconstructing the comparison yield from the return.
      const before = instrument.price != null && instrument.return1m !== -100
        ? instrument.price / (1 + instrument.return1m / 100)
        : null;
      const bpMove = instrument.price != null && before != null ? (instrument.price - before) * 100 : null;
      if (bpMove != null) {
        const contribution = bpMove < -15 ? 1 : bpMove > 15 ? -1 : 0;
        signals.push({ label, reading: `${fmt(bpMove, 0, " bp")}`, contribution });
      }
    }
  }

  if (tlt && tlt.return1m != null && !tlt.error) {
    const contribution = tlt.return1m > 2 ? 1 : tlt.return1m < -2 ? -1 : 0;
    signals.push({ label: "Long Treasuries TLT (1M)", reading: `${fmt(tlt.return1m, 1, "%")}`, contribution });
  }

  if (signals.length < 2) {
    return {
      key: "rates-pressure", title: "Rates Pressure", state: "unavailable", label: "Not enough data",
      explanation: "Treasury yield inputs are unavailable right now.",
      signals, unavailableReason: "Needs at least 2 rate signals. (2Y yield is unavailable from this provider, so the 2Y–10Y spread is not used.)",
    };
  }

  const score = signals.reduce((sum, signal) => sum + signal.contribution, 0);
  const state = stateFromScore(score, 2, 3);
  const label = state === "strong-positive" ? "Easing sharply" : state === "positive" ? "Easing"
    : state === "neutral" ? "Stable" : state === "negative" ? "Tightening" : "Tightening sharply";
  const tenY = map.us10y?.price;
  const explanation = `US 10Y at ${fmtLevel(tenY)}%${tlt?.return1m != null ? `, long Treasuries ${fmt(tlt.return1m, 1, "%")} over 1M` : ""} — rate conditions read ${label.toLowerCase()}. (2Y–10Y spread unavailable: no reliable 2Y yield from this provider.)`;

  return { key: "rates-pressure", title: "Rates Pressure", state, label, explanation, signals };
}

// -------------------------------------------------------------- commodity trend

function commodityTrendCard(map: InstrumentMap): RegimeCard {
  const signals: RegimeSignal[] = [];

  const tracked = COMMODITY_IDS.map((id) => map[id]).filter((instrument): instrument is MarketInstrument => Boolean(instrument) && !instrument.error);
  const withMa20 = tracked.filter((instrument) => instrument.ma20 != null && instrument.price != null);
  const aboveCount = withMa20.filter((instrument) => (instrument.price as number) > (instrument.ma20 as number)).length;

  if (withMa20.length >= 5) {
    const pctAbove = (aboveCount / withMa20.length) * 100;
    const contribution = pctAbove >= 70 ? 2 : pctAbove >= 55 ? 1 : pctAbove >= 30 ? 0 : pctAbove >= 15 ? -1 : -2;
    signals.push({ label: "Commodities above 20-day MA", reading: `${aboveCount} of ${withMa20.length} (${pctAbove.toFixed(0)}%)`, contribution });
  }

  const returns = tracked.map((instrument) => instrument.return1m).filter((value): value is number => value != null && Number.isFinite(value));
  const median1m = median(returns);
  if (returns.length >= 5 && median1m != null) {
    const contribution = median1m > 3 ? 1 : median1m < -3 ? -1 : 0;
    signals.push({ label: "Median 1-month return", reading: `${fmt(median1m, 1, "%")} across ${returns.length} commodities`, contribution });
  }

  if (signals.length < 2) {
    return {
      key: "commodity-trend", title: "Commodity Trend", state: "unavailable", label: "Not enough data",
      explanation: "Commodity inputs are unavailable right now.",
      signals, unavailableReason: "Needs at least 5 commodities with moving averages.",
    };
  }

  const score = signals.reduce((sum, signal) => sum + signal.contribution, 0);
  const state = stateFromScore(score, 2, 3);
  const label = state === "strong-positive" ? "Broad strength" : state === "positive" ? "Broad strength"
    : state === "neutral" ? "Mixed" : state === "negative" ? "Broad weakness" : "Broad weakness";
  const explanation = withMa20.length >= 5
    ? `${aboveCount} of ${withMa20.length} tracked commodities trade above their 20-day average${median1m != null ? `, median 1M ${fmt(median1m, 1, "%")}` : ""}.`
    : "Not enough commodity data to classify.";

  return { key: "commodity-trend", title: "Commodity Trend", state, label, explanation, signals };
}

// 1-month percentage change of a price ratio (a/b), reconstructed from each leg's
// price and 1M return — exact algebra, no extra history needed.
export function ratioChangePct(a: MarketInstrument | undefined, b: MarketInstrument | undefined, field: "return1m" | "return1w"): number | null {
  if (!a || !b || a.price == null || b.price == null) return null;
  if (a.error || b.error) return null;
  const aReturn = a[field];
  const bReturn = b[field];
  if (aReturn == null || bReturn == null) return null;
  const aBefore = a.price / (1 + aReturn / 100);
  const bBefore = b.price / (1 + bReturn / 100);
  if (!Number.isFinite(aBefore) || !Number.isFinite(bBefore) || bBefore === 0) return null;
  const ratioNow = a.price / b.price;
  const ratioBefore = aBefore / bBefore;
  if (ratioBefore === 0) return null;
  return (ratioNow / ratioBefore - 1) * 100;
}

export function classifyRegimes(map: InstrumentMap): RegimeCard[] {
  return [
    riskSentimentCard(map),
    inflationPressureCard(map),
    ratesPressureCard(map),
    commodityTrendCard(map),
  ];
}
