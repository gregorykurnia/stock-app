"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { downloadCsv } from "@/lib/exportCsv";
import { scoreCoilingRows, type CoilingLabel, type CoilingSubScores } from "@/lib/coilingScore";
import { scoreProximity, type ProximityLabel, type ProximitySubScores } from "@/lib/proximityScore";
import { scoreUpside, type UpsideLabel, type UpsideSubScores, type UpsideInput } from "@/lib/upsideScore";
import { computeMasterScore, type MasterLabel } from "@/lib/masterScore";

export interface CoilingStock {
  ticker: string;
  name: string | null;
  industry: string | null;
  addedAt?: string | null;
}

type SortKey =
  | "ticker" | "industry" | "price" | "grandScore" | "distFrom2yHigh" | "distFrom6moLow" | "roc1mo" | "roc3mo"
  | "ma30wk" | "priceVsMa30wk" | "ma30wkSlope" | "volRatio10_90" | "upDownVolRatio" | "bbw"
  | "atrPct" | "atrTrend" | "weeklyRsi" | "rsiFloor6mo" | "rsiDivergence" | "maStackScore" | "lowerHighs" | "rsVsSpy3mo"
  | "proximityScore" | "upsideScore" | "masterScore";
type SortDir = "asc" | "desc";

const LABEL_STYLES: Record<CoilingLabel, string> = {
  "High Conviction": "bg-green-100 text-green-700 border border-green-300",
  "Interesting": "bg-blue-100 text-blue-700 border border-blue-300",
  "Early / Incomplete": "bg-yellow-100 text-yellow-700 border border-yellow-300",
  "Weak": "bg-orange-100 text-orange-700 border border-orange-300",
  "Poor": "bg-red-100 text-red-700 border border-red-300",
};

const PROXIMITY_LABEL_STYLES: Record<ProximityLabel, string> = {
  "Imminent": "bg-green-100 text-green-700 border border-green-300",
  "Developing": "bg-blue-100 text-blue-700 border border-blue-300",
  "Early": "bg-yellow-100 text-yellow-700 border border-yellow-300",
  "Not Ready": "bg-red-100 text-red-700 border border-red-300",
};

const UPSIDE_LABEL_STYLES: Record<UpsideLabel, string> = {
  "High Upside Potential": "bg-green-100 text-green-700 border border-green-300",
  "Moderate Upside": "bg-blue-100 text-blue-700 border border-blue-300",
  "Speculative": "bg-yellow-100 text-yellow-700 border border-yellow-300",
  "Low Conviction": "bg-red-100 text-red-700 border border-red-300",
};

const MASTER_LABEL_STYLES: Record<MasterLabel, string> = {
  "Tier 1: High Conviction Entry": "bg-green-100 text-green-700 border border-green-300",
  "Tier 2: Strong Candidate": "bg-blue-100 text-blue-700 border border-blue-300",
  "Tier 3: Watch Closely": "bg-yellow-100 text-yellow-700 border border-yellow-300",
  "Tier 4: Too Early": "bg-orange-100 text-orange-700 border border-orange-300",
  "Tier 5: Avoid": "bg-red-100 text-red-700 border border-red-300",
};

const PROXIMITY_ROW_LABELS: [keyof ProximitySubScores, string][] = [
  ["slopeVelocity", "Slope Velocity"],
  ["maTouchCount", "MA Touch Count"],
  ["rangeContraction", "Range Contraction"],
  ["rsLineDirection", "RS Line Direction"],
  ["volumeGreenDays", "Volume on Green Days"],
];

const UPSIDE_ROW_LABELS: [keyof UpsideSubScores, string][] = [
  ["grossMarginTrend", "Gross Margin Trend"],
  ["revenueDeceleration", "Revenue Deceleration"],
  ["cashRunway", "Cash Runway"],
  ["epsRevision", "EPS Revision"],
  ["shortInterest", "Short Interest"],
  ["insiderBuyCount", "Insider Buy Count"],
];

interface Props {
  stocks: CoilingStock[];
  prices: Record<string, number | null>;
  distFrom2yHigh: Record<string, number | null>;
  distFrom6moLow: Record<string, number | null>;
  roc1mo: Record<string, number | null>;
  roc3mo: Record<string, number | null>;
  ma30wk: Record<string, number | null>;
  priceVsMa30wk: Record<string, number | null>;
  ma30wkSlope: Record<string, number | null>;
  volRatio10_90: Record<string, number | null>;
  upDownVolRatio: Record<string, number | null>;
  bbw: Record<string, number | null>;
  atrPct: Record<string, number | null>;
  atrTrend: Record<string, number | null>;
  weeklyRsi: Record<string, number | null>;
  rsiFloor6mo: Record<string, number | null>;
  rsiDivergence: Record<string, number | null>;
  maStackScore: Record<string, number | null>;
  lowerHighs: Record<string, boolean | null>;
  rsVsSpy3mo: Record<string, number | null>;
  slopeNow: Record<string, number | null>;
  slope4wk: Record<string, number | null>;
  slope8wk: Record<string, number | null>;
  maTouchCount: Record<string, number | null>;
  rangeContractionRatio: Record<string, number | null>;
  rsLineDiffPct: Record<string, number | null>;
  volGreenRatio: Record<string, number | null>;
  upside: Record<string, UpsideInput>;
  loading?: boolean;
  addTicker: string;
  addLoading: boolean;
  addError: string;
  onAddTickerChange: (v: string) => void;
  onAdd: (e: FormEvent) => void;
  onRemove: (ticker: string) => void;
  onMoveToExcluded: (ticker: string) => void;
}

const dash = <span className="text-gray-400">—</span>;

// Colors a metric cell by its own tiered sub-score (0-3), not just its raw sign, so the
// column color always agrees with how many points it actually contributed to Grand Score.
const TIER_TEXT: Record<number, string> = {
  3: "text-green-600 font-semibold",
  2: "text-blue-600 font-medium",
  1: "text-yellow-600 font-medium",
  0: "text-red-500 font-medium",
};
const tierColor = (score: number | undefined) => (score == null ? "text-gray-400" : TIER_TEXT[score] ?? "text-gray-400");

const pctCell = (v: number | null, score: number | undefined, dec = 1) => {
  if (v == null) return dash;
  return <span className={tierColor(score)}>{v >= 0 ? "+" : ""}{v.toFixed(dec)}%</span>;
};

const SCORE_ROW_LABELS: [keyof CoilingSubScores, string][] = [
  ["distFrom6moLow", "% from 6mo Low"],
  ["distFrom2yHigh", "% from 2Y High"],
  ["roc1mo", "ROC 1mo"],
  ["priceVsMa30wk", "Price vs 30wk MA"],
  ["ma30wkSlope", "30wk MA Slope"],
  ["volRatio10_90", "Vol Ratio 10d/90d"],
  ["weeklyRsi", "Weekly RSI"],
  ["bbw", "BBW"],
  ["atrPct", "ATR%"],
  ["rsVsSpy3mo", "RS vs SPY 3mo"],
  ["upDownVolRatio", "Up/Down Vol Ratio"],
];

interface TierRange { range: string; color: keyof typeof TIER_DOT; meaning: string }
interface ColumnTip { definition: string; ranges: TierRange[] }

const TIER_DOT: Record<string, string> = {
  green: "bg-green-600", blue: "bg-blue-500", yellow: "bg-yellow-500", red: "bg-red-500", gray: "bg-gray-400",
};

// One entry per header that carries a tiered scoring rule (or an eliminator flag), shown as a
// hover popover on the column title — same ranges/colors the cells below are actually shaded by.
const COLUMN_TIPS: Partial<Record<SortKey, ColumnTip>> = {
  grandScore: {
    definition: "Sum of 11 tiered sub-scores (0-3 each, max 33). A row that trips a ⚑ flag rule still gets scored for transparency, but its Label is capped at Weak so it can never read as promising.",
    ranges: [
      { range: "27–33", color: "green", meaning: "High Conviction" },
      { range: "20–26", color: "blue", meaning: "Interesting" },
      { range: "13–19", color: "yellow", meaning: "Early / Incomplete" },
      { range: "7–12", color: "gray", meaning: "Weak" },
      { range: "0–6", color: "red", meaning: "Poor" },
    ],
  },
  distFrom6moLow: {
    definition: "Distance above the 6-month closing low — how far the recovery has already run.",
    ranges: [
      { range: "< 15%", color: "green", meaning: "3 pts — still early in the base" },
      { range: "15–25%", color: "blue", meaning: "2 pts" },
      { range: "25–35%", color: "yellow", meaning: "1 pt" },
      { range: "> 35%", color: "red", meaning: "0 pts — already extended off the low" },
    ],
  },
  distFrom2yHigh: {
    definition: "Distance below the trailing 2-year high. Sweet spot is a deep-but-not-crushed drawdown. ⚑ Flag: > -15% (barely off its high at all — not a beaten-down setup regardless of how calm the other metrics look).",
    ranges: [
      { range: "-85% to -65%", color: "green", meaning: "3 pts" },
      { range: "-65% to -50%", color: "blue", meaning: "2 pts" },
      { range: "-50% to -40%", color: "yellow", meaning: "1 pt" },
      { range: "> -40%", color: "red", meaning: "0 pts — not enough of a drawdown left to coil" },
    ],
  },
  roc1mo: {
    definition: "1-month rate of change. ⚑ Flag: outside -15% to +20% (too violent a move either way).",
    ranges: [
      { range: "-3% to +5%", color: "green", meaning: "3 pts — quiet, coiling" },
      { range: "-8 to -3% or +5 to +8%", color: "blue", meaning: "2 pts" },
      { range: "-12 to -8% or +8 to +12%", color: "yellow", meaning: "1 pt" },
      { range: "outside that", color: "red", meaning: "0 pts" },
    ],
  },
  roc3mo: {
    definition: "3-month rate of change. ⚑ Flag: outside -30% to +30% (not scored directly, only used as an eliminator flag).",
    ranges: [],
  },
  priceVsMa30wk: {
    definition: "Price ÷ 30-week (150d) moving average. 1.00 = sitting right on the MA.",
    ranges: [
      { range: "0.95–1.02", color: "green", meaning: "3 pts" },
      { range: "0.90–0.95 or 1.02–1.08", color: "blue", meaning: "2 pts" },
      { range: "0.85–0.90 or 1.08–1.15", color: "yellow", meaning: "1 pt" },
      { range: "outside that", color: "red", meaning: "0 pts" },
    ],
  },
  ma30wkSlope: {
    definition: "30-week MA now vs 20 sessions ago — is the base flattening out. ⚑ Flag: < -0.5 (still rolling over hard).",
    ranges: [
      { range: "-0.1 to +0.1", color: "green", meaning: "3 pts — flat, basing" },
      { range: "-0.2 to -0.1 or +0.1 to +0.2", color: "blue", meaning: "2 pts" },
      { range: "-0.3 to -0.2", color: "yellow", meaning: "1 pt" },
      { range: "< -0.3", color: "red", meaning: "0 pts — still trending down" },
    ],
  },
  volRatio10_90: {
    definition: "10-day avg volume ÷ 90-day avg volume. Low = volume drying up (coiling). ⚑ Flag: > 1.2 (volume expanding, not coiling).",
    ranges: [
      { range: "< 0.55", color: "green", meaning: "3 pts" },
      { range: "0.55–0.70", color: "blue", meaning: "2 pts" },
      { range: "0.70–0.80", color: "yellow", meaning: "1 pt" },
      { range: "> 0.80", color: "red", meaning: "0 pts" },
    ],
  },
  upDownVolRatio: {
    definition: "Volume on up days ÷ volume on down days, last 20 sessions.",
    ranges: [
      { range: "1.3–1.8", color: "green", meaning: "3 pts — accumulation" },
      { range: "1.1–1.3 or 1.8–2.0", color: "blue", meaning: "2 pts" },
      { range: "1.0–1.1", color: "yellow", meaning: "1 pt" },
      { range: "< 1.0", color: "red", meaning: "0 pts — distribution" },
    ],
  },
  bbw: {
    definition: "Bollinger Band Width (20d, 2σ) — tighter bands = tighter coil. Scored against this list's own percentile spread, not fixed thresholds.",
    ranges: [
      { range: "Bottom 10th %ile", color: "green", meaning: "3 pts — tightest in the list" },
      { range: "10th–20th %ile", color: "blue", meaning: "2 pts" },
      { range: "20th–35th %ile", color: "yellow", meaning: "1 pt" },
      { range: "> 35th %ile", color: "red", meaning: "0 pts" },
    ],
  },
  atrPct: {
    definition: "ATR(14) as a % of price — daily volatility.",
    ranges: [
      { range: "< 2.5%", color: "green", meaning: "3 pts" },
      { range: "2.5–3.5%", color: "blue", meaning: "2 pts" },
      { range: "3.5–4.5%", color: "yellow", meaning: "1 pt" },
      { range: "> 4.5%", color: "red", meaning: "0 pts" },
    ],
  },
  atrTrend: {
    definition: "ATR(14) now vs 20 sessions ago. Negative = volatility contracting (coiling); positive = expanding. Not part of Grand Score.",
    ranges: [],
  },
  weeklyRsi: {
    definition: "RSI(14) on weekly closes. ⚑ Flag: outside 35–65 (overbought/oversold, not neutral basing).",
    ranges: [
      { range: "45–55", color: "green", meaning: "3 pts — neutral" },
      { range: "40–45 or 55–58", color: "blue", meaning: "2 pts" },
      { range: "37–40 or 58–62", color: "yellow", meaning: "1 pt" },
      { range: "outside that", color: "red", meaning: "0 pts" },
    ],
  },
  rsiFloor6mo: {
    definition: "Lowest weekly RSI over the trailing 26 weeks — how oversold the stock got at worst. Not part of Grand Score.",
    ranges: [],
  },
  rsiDivergence: {
    definition: "Daily RSI(14, Wilder) at the 20-day low minus RSI at the 40-20-day-ago low. Positive = bullish divergence (price made a lower low but RSI made a higher low) — bigger is stronger. Not part of Grand Score.",
    ranges: [
      { range: "> 0", color: "green", meaning: "Bullish divergence" },
      { range: "≤ 0", color: "red", meaning: "No divergence / bearish" },
    ],
  },
  maStackScore: {
    definition: "0–3: +1 EMA20 > EMA50, +1 EMA50 > EMA200, +1 Price > EMA200. A trend-structure check, not part of Grand Score.",
    ranges: [],
  },
  lowerHighs: {
    definition: "Last 3 swing highs over the trailing 20 weeks, each lower than the one before. ⚑ Flag: Yes (still in a downtrend).",
    ranges: [
      { range: "No", color: "green", meaning: "Structure not breaking down" },
      { range: "Yes", color: "red", meaning: "Flagged — still making lower highs" },
    ],
  },
  rsVsSpy3mo: {
    definition: "Stock's 3-month return ÷ SPY's 3-month return. 1.0 = matching the market.",
    ranges: [
      { range: "1.0–1.2", color: "green", meaning: "3 pts — leading the market" },
      { range: "0.9–1.0 or 1.2–1.3", color: "blue", meaning: "2 pts" },
      { range: "0.8–0.9", color: "yellow", meaning: "1 pt" },
      { range: "outside that", color: "red", meaning: "0 pts" },
    ],
  },
};

function HeaderTip({ tip }: { tip: ColumnTip }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  function show() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (iconRef.current) {
      const r = iconRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 320) });
    }
  }
  function hide() {
    timerRef.current = setTimeout(() => setPos(null), 120);
  }

  return (
    <span className="inline-flex items-center">
      <span
        ref={iconRef}
        onClick={(e) => { e.stopPropagation(); pos ? setPos(null) : show(); }}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-300 text-gray-600 text-[9px] font-bold cursor-default leading-none"
      >
        i
      </span>
      {pos && (
        <div
          className="fixed z-[9999] w-[300px] bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-left normal-case tracking-normal font-normal"
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
          onMouseLeave={hide}
        >
          <p className="text-[11px] text-gray-500 leading-snug mb-2 whitespace-normal">{tip.definition}</p>
          {tip.ranges.length > 0 && (
            <table className="w-full text-[11px] border-collapse">
              <tbody>
                {tip.ranges.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-0.5 pr-2 align-top">
                      <span className={`inline-block w-2 h-2 rounded-full ${TIER_DOT[row.color]} mr-1.5 align-middle`} />
                    </td>
                    <td className="py-0.5 pr-2 text-gray-700 font-mono whitespace-nowrap align-top">{row.range}</td>
                    <td className="py-0.5 text-gray-500 leading-snug whitespace-normal break-words align-top">{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </span>
  );
}

// Native `title` tooltips are unreliable across browsers/embedded webviews (can show the
// help cursor with no text bubble), so the score breakdown uses the same custom
// hover-popover pattern as the Bandar score tooltips elsewhere in this app.
function ScoreBadge({ score, label, subScores, flagged, flagReasons }: {
  score: number; label: CoilingLabel; subScores: CoilingSubScores; flagged: boolean; flagReasons: string[];
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  function show() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 260) });
    }
  }
  function hide() {
    timerRef.current = setTimeout(() => setPos(null), 120);
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        ref={anchorRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={() => (pos ? setPos(null) : show())}
        className="font-semibold text-gray-900 cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2"
      >
        {score}
      </span>
      <span className={`inline-flex items-center rounded-full ${LABEL_STYLES[label]} text-xs font-semibold px-2 py-0.5 whitespace-nowrap`}>
        {label}
      </span>
      {flagged && (
        <span title={flagReasons.join("; ")} className="inline-flex items-center rounded-full bg-gray-100 text-gray-500 border border-gray-300 text-xs font-semibold px-1.5 py-0.5 whitespace-nowrap cursor-help">
          ⚑
        </span>
      )}
      {pos && (
        <div
          className="fixed z-[9999] w-60 bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-left normal-case font-normal"
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
          onMouseLeave={hide}
        >
          <div className="text-xs font-semibold text-gray-900 mb-1.5">Score breakdown</div>
          <table className="w-full text-[11px]">
            <tbody>
              {SCORE_ROW_LABELS.map(([key, rowLabel]) => (
                <tr key={key} className="border-b border-gray-50 last:border-0">
                  <td className="py-0.5 text-gray-500">{rowLabel}</td>
                  <td className="py-0.5 text-right font-mono text-gray-800">{subScores[key]}/3</td>
                </tr>
              ))}
              <tr className="border-t border-gray-200">
                <td className="py-1 font-semibold text-gray-900">Total</td>
                <td className="py-1 text-right font-mono font-semibold text-gray-900">{score}/33</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Generic composite-score badge (score + label + hover breakdown), reused for Proximity,
// Upside and Master scores the same way ScoreBadge does for Grand Score.
function CompositeBadge<K extends string>({
  score, max, label, labelStyle, rows, subScores, extraNote,
}: {
  score: number; max: number; label: string; labelStyle: string;
  rows: [K, string][]; subScores: Record<K, number>; extraNote?: string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  function show() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 260) });
    }
  }
  function hide() {
    timerRef.current = setTimeout(() => setPos(null), 120);
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        ref={anchorRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={() => (pos ? setPos(null) : show())}
        className="font-semibold text-gray-900 cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2"
      >
        {score}
      </span>
      <span className={`inline-flex items-center rounded-full ${labelStyle} text-xs font-semibold px-2 py-0.5 whitespace-nowrap`}>
        {label}
      </span>
      {pos && (
        <div
          className="fixed z-[9999] w-60 bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-left normal-case font-normal"
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
          onMouseLeave={hide}
        >
          <div className="text-xs font-semibold text-gray-900 mb-1.5">Score breakdown</div>
          <table className="w-full text-[11px]">
            <tbody>
              {rows.map(([key, rowLabel]) => (
                <tr key={key} className="border-b border-gray-50 last:border-0">
                  <td className="py-0.5 text-gray-500">{rowLabel}</td>
                  <td className="py-0.5 text-right font-mono text-gray-800">{subScores[key]}/3</td>
                </tr>
              ))}
              <tr className="border-t border-gray-200">
                <td className="py-1 font-semibold text-gray-900">Total</td>
                <td className="py-1 text-right font-mono font-semibold text-gray-900">{score}/{max}</td>
              </tr>
            </tbody>
          </table>
          {extraNote && <div className="text-[10px] text-gray-400 mt-1.5 leading-snug">{extraNote}</div>}
        </div>
      )}
    </div>
  );
}

export default function CoilingReversalTable({
  stocks, prices, distFrom2yHigh, distFrom6moLow, roc1mo, roc3mo,
  ma30wk, priceVsMa30wk, ma30wkSlope, volRatio10_90, upDownVolRatio, bbw,
  atrPct, atrTrend, weeklyRsi, rsiFloor6mo, rsiDivergence, maStackScore, lowerHighs, rsVsSpy3mo,
  slopeNow, slope4wk, slope8wk, maTouchCount, rangeContractionRatio, rsLineDiffPct, volGreenRatio, upside,
  loading, addTicker, addLoading, addError, onAddTickerChange, onAdd, onRemove, onMoveToExcluded,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const rows = useMemo(() => {
    const base = stocks.map((s) => ({
      ...s,
      price: prices[s.ticker] ?? null,
      distFrom2yHigh: distFrom2yHigh[s.ticker] ?? null,
      distFrom6moLow: distFrom6moLow[s.ticker] ?? null,
      roc1mo: roc1mo[s.ticker] ?? null,
      roc3mo: roc3mo[s.ticker] ?? null,
      ma30wk: ma30wk[s.ticker] ?? null,
      priceVsMa30wk: priceVsMa30wk[s.ticker] ?? null,
      ma30wkSlope: ma30wkSlope[s.ticker] ?? null,
      volRatio10_90: volRatio10_90[s.ticker] ?? null,
      upDownVolRatio: upDownVolRatio[s.ticker] ?? null,
      bbw: bbw[s.ticker] ?? null,
      atrPct: atrPct[s.ticker] ?? null,
      atrTrend: atrTrend[s.ticker] ?? null,
      weeklyRsi: weeklyRsi[s.ticker] ?? null,
      rsiFloor6mo: rsiFloor6mo[s.ticker] ?? null,
      rsiDivergence: rsiDivergence[s.ticker] ?? null,
      maStackScore: maStackScore[s.ticker] ?? null,
      lowerHighs: lowerHighs[s.ticker] ?? null,
      rsVsSpy3mo: rsVsSpy3mo[s.ticker] ?? null,
      slopeNow: slopeNow[s.ticker] ?? null,
      slope4wk: slope4wk[s.ticker] ?? null,
      slope8wk: slope8wk[s.ticker] ?? null,
      maTouchCount: maTouchCount[s.ticker] ?? null,
      rangeContractionRatio: rangeContractionRatio[s.ticker] ?? null,
      rsLineDiffPct: rsLineDiffPct[s.ticker] ?? null,
      volGreenRatio: volGreenRatio[s.ticker] ?? null,
      upsideRaw: upside[s.ticker],
    }));
    const scores = scoreCoilingRows(base);
    const arr = base.map((r, i) => {
      const grandScore = scores[i].totalScore;
      const prox = scoreProximity({
        slopeNow: r.slopeNow, slope4wk: r.slope4wk, slope8wk: r.slope8wk,
        maTouchCount: r.maTouchCount, rangeContractionRatio: r.rangeContractionRatio,
        rsLineDiffPct: r.rsLineDiffPct, volGreenRatio: r.volGreenRatio,
      });
      const up = scoreUpside(r.upsideRaw ?? {
        gmChanges: null, revenueGrowth: null, cash: null, avgQuarterlyFcf: null,
        epsCurrent: null, epsNinetyDaysAgo: null, shortPercentOfFloat: null, insiderBuyCount: null,
      });
      const master = computeMasterScore(grandScore, prox.totalScore, up.totalScore);
      return {
        ...r, ...scores[i], grandScore,
        proximity: prox, proximityScore: prox.totalScore,
        upsideResult: up, upsideScore: up.totalScore,
        master, masterScore: master.masterScore,
      };
    });
    arr.sort((a, b) => {
      let av: string | number | boolean | null = null, bv: string | number | boolean | null = null;
      if (sortKey === "ticker" || sortKey === "industry") { av = a[sortKey] ?? ""; bv = b[sortKey] ?? ""; }
      else { av = a[sortKey as keyof typeof a] as string | number | boolean | null; bv = b[sortKey as keyof typeof b] as string | number | boolean | null; }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      const an = Number(av), bn = Number(bv);
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return arr;
  }, [stocks, prices, distFrom2yHigh, distFrom6moLow, roc1mo, roc3mo, ma30wk, priceVsMa30wk, ma30wkSlope,
      volRatio10_90, upDownVolRatio, bbw, atrPct, atrTrend, weeklyRsi, rsiFloor6mo, rsiDivergence, maStackScore, lowerHighs, rsVsSpy3mo,
      slopeNow, slope4wk, slope8wk, maTouchCount, rangeContractionRatio, rsLineDiffPct, volGreenRatio, upside, sortKey, sortDir]);

  function exportCsv() {
    const date = new Date().toISOString().slice(0, 10);
    const headers = [
      "Ticker", "Industry", "Price", "Grand Score", "Label", "Flag Reasons",
      "% from 2Y High", "% from 6mo Low", "ROC 1mo", "ROC 3mo",
      "30wk MA", "Price vs 30wk MA", "30wk MA Slope", "Vol Ratio 10d/90d", "Up/Down Vol Ratio",
      "BBW", "ATR%", "ATR Trend", "Weekly RSI", "RSI Floor 6mo", "RSI Divergence", "MA Stack Score", "Lower Highs", "RS vs SPY 3mo",
      "Proximity Score", "Proximity Label", "Upside Score", "Upside Label", "Data Gaps", "Data Gap Count",
      "Master Score", "Master Label",
    ];
    const data = rows.map((r) => [
      r.ticker,
      r.industry ?? "",
      r.price?.toFixed(2) ?? "",
      r.totalScore ?? "",
      r.label ?? "",
      r.flagReasons.join("; "),
      r.distFrom2yHigh?.toFixed(1) ?? "",
      r.distFrom6moLow?.toFixed(1) ?? "",
      r.roc1mo?.toFixed(1) ?? "",
      r.roc3mo?.toFixed(1) ?? "",
      r.ma30wk?.toFixed(2) ?? "",
      r.priceVsMa30wk?.toFixed(2) ?? "",
      r.ma30wkSlope?.toFixed(2) ?? "",
      r.volRatio10_90?.toFixed(2) ?? "",
      r.upDownVolRatio?.toFixed(2) ?? "",
      r.bbw?.toFixed(3) ?? "",
      r.atrPct?.toFixed(1) ?? "",
      r.atrTrend?.toFixed(2) ?? "",
      r.weeklyRsi?.toFixed(1) ?? "",
      r.rsiFloor6mo?.toFixed(1) ?? "",
      r.rsiDivergence?.toFixed(1) ?? "",
      r.maStackScore ?? "",
      r.lowerHighs == null ? "" : r.lowerHighs ? "Yes" : "No",
      r.rsVsSpy3mo?.toFixed(2) ?? "",
      r.proximityScore,
      r.proximity.label,
      r.upsideScore,
      r.upsideResult.label,
      r.upsideResult.dataGaps.join(", "),
      r.upsideResult.dataGapCount,
      r.masterScore,
      r.master.masterLabel,
    ]);
    downloadCsv(`coiling-reversal-${date}.csv`, headers, data);
  }

  const th = (label: string, k: SortKey, extraClass = "") => {
    const tip = COLUMN_TIPS[k];
    const sticky = k === "ticker";
    return (
      <th
        key={k}
        onClick={() => handleSort(k)}
        className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 whitespace-nowrap select-none ${sticky ? "sticky left-0 z-20 bg-gray-100 border-r border-gray-200" : ""} ${extraClass}`}
      >
        <span className="inline-flex items-center">
          {label} {sortKey === k && (sortDir === "asc" ? "▲" : "▼")}
          {tip && <HeaderTip tip={tip} />}
        </span>
      </th>
    );
  };

  return (
    <div className="space-y-3">
      <form onSubmit={onAdd} className="flex items-center gap-2">
        <input
          value={addTicker}
          onChange={(e) => onAddTickerChange(e.target.value.toUpperCase())}
          placeholder="Add ticker (e.g. AAPL)"
          className="border rounded px-2 py-1 text-sm w-48"
        />
        <button type="submit" disabled={addLoading} className="text-sm bg-blue-600 text-white rounded px-3 py-1 disabled:opacity-50">
          {addLoading ? "Adding..." : "Add"}
        </button>
        {addError && <span className="text-xs text-red-500">{addError}</span>}
        {stocks.length > 0 && (
          <button
            onClick={exportCsv}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm font-semibold ml-auto"
          >
            Export CSV
          </button>
        )}
      </form>

      {loading && <div className="text-sm text-gray-400">Loading...</div>}
      {!loading && stocks.length === 0 && (
        <div className="text-sm text-gray-400">No tickers yet — add one above to start tracking Coiling Reversal setups.</div>
      )}

      {stocks.length > 0 && (
        <div className="overflow-x-auto overflow-y-auto max-h-[72vh] rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
              <tr className="text-[10px] text-gray-400 uppercase tracking-wide">
                <th colSpan={22} />
                <th colSpan={1} className="px-3 py-1 text-left border-l border-gray-200">Group 1: Breakout Proximity</th>
                <th colSpan={1} className="px-3 py-1 text-left border-l border-gray-200">Group 2: Upside Potential</th>
                <th colSpan={1} className="px-3 py-1 text-left border-l border-gray-200">Group 3: Master</th>
                <th />
              </tr>
              <tr>
                {th("Ticker", "ticker")}
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Industry</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Price</th>
                {th("Grand Score", "grandScore")}
                {th("% from 2Y High", "distFrom2yHigh")}
                {th("% from 6mo Low", "distFrom6moLow")}
                {th("ROC 1mo", "roc1mo")}
                {th("ROC 3mo", "roc3mo")}
                {th("30wk MA", "ma30wk")}
                {th("Price vs 30wk MA", "priceVsMa30wk")}
                {th("30wk MA Slope", "ma30wkSlope")}
                {th("Vol Ratio 10d/90d", "volRatio10_90")}
                {th("Up/Down Vol Ratio", "upDownVolRatio")}
                {th("BBW", "bbw")}
                {th("ATR%", "atrPct")}
                {th("ATR Trend", "atrTrend")}
                {th("Weekly RSI", "weeklyRsi")}
                {th("RSI Floor 6mo", "rsiFloor6mo")}
                {th("RSI Divergence", "rsiDivergence")}
                {th("MA Stack", "maStackScore")}
                {th("Lower Highs", "lowerHighs")}
                {th("RS vs SPY 3mo", "rsVsSpy3mo")}
                {th("Proximity", "proximityScore", "border-l border-gray-200")}
                {th("Upside", "upsideScore")}
                {th("Master", "masterScore")}
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.ticker} className="hover:bg-gray-50 group">
                  <td className="px-3 py-2 font-semibold text-gray-900 sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r border-gray-200">
                    {r.ticker}
                    {r.name && <div className="text-xs text-gray-400 font-normal">{r.name}</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.industry}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.price != null ? `$${r.price.toFixed(2)}` : dash}</td>
                  <td className="px-3 py-2">
                    <ScoreBadge score={r.totalScore} label={r.label} subScores={r.subScores} flagged={r.flagged} flagReasons={r.flagReasons} />
                  </td>
                  <td className="px-3 py-2">{pctCell(r.distFrom2yHigh, r.subScores.distFrom2yHigh)}</td>
                  <td className="px-3 py-2">{pctCell(r.distFrom6moLow, r.subScores.distFrom6moLow)}</td>
                  <td className="px-3 py-2">{pctCell(r.roc1mo, r.subScores.roc1mo)}</td>
                  <td className="px-3 py-2">{pctCell(r.roc3mo, undefined)}</td>
                  <td className="px-3 py-2 text-gray-700">{r.ma30wk != null ? `$${r.ma30wk.toFixed(2)}` : dash}</td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.priceVsMa30wk)}`}>
                    {r.priceVsMa30wk != null ? r.priceVsMa30wk.toFixed(2) : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.ma30wkSlope)}`}>
                    {r.ma30wkSlope != null ? r.ma30wkSlope.toFixed(2) : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.volRatio10_90)}`}>
                    {r.volRatio10_90 != null ? `${r.volRatio10_90.toFixed(2)}x` : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.upDownVolRatio)}`}>
                    {r.upDownVolRatio != null ? r.upDownVolRatio.toFixed(2) : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.bbw)}`}>
                    {r.bbw != null ? r.bbw.toFixed(3) : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.atrPct)}`}>
                    {r.atrPct != null ? `${r.atrPct.toFixed(1)}%` : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${r.atrTrend == null ? "text-gray-400" : r.atrTrend < 0 ? "text-green-600" : "text-red-500"}`}>
                    {r.atrTrend != null ? r.atrTrend.toFixed(2) : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.weeklyRsi)}`}>
                    {r.weeklyRsi != null ? r.weeklyRsi.toFixed(1) : dash}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{r.rsiFloor6mo != null ? r.rsiFloor6mo.toFixed(1) : dash}</td>
                  <td className={`px-3 py-2 font-medium ${r.rsiDivergence == null ? "text-gray-400" : r.rsiDivergence > 0 ? "text-green-600" : "text-red-500"}`}>
                    {r.rsiDivergence != null ? `${r.rsiDivergence >= 0 ? "+" : ""}${r.rsiDivergence.toFixed(1)}` : dash}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{r.maStackScore != null ? `${r.maStackScore}/3` : dash}</td>
                  <td className="px-3 py-2">
                    {r.lowerHighs == null ? dash : r.lowerHighs
                      ? <span className="text-red-500 font-medium">Yes</span>
                      : <span className="text-green-600 font-medium">No</span>}
                  </td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.rsVsSpy3mo)}`}>
                    {r.rsVsSpy3mo != null ? r.rsVsSpy3mo.toFixed(2) : dash}
                  </td>
                  <td className="px-3 py-2 border-l border-gray-100">
                    <CompositeBadge
                      score={r.proximityScore} max={15} label={r.proximity.label}
                      labelStyle={PROXIMITY_LABEL_STYLES[r.proximity.label]}
                      rows={PROXIMITY_ROW_LABELS} subScores={r.proximity.subScores}
                      extraNote={r.grandScore < 15 ? "Not active in Master Score — Grand Score below 15." : undefined}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <CompositeBadge
                      score={r.upsideScore} max={18} label={r.upsideResult.label}
                      labelStyle={UPSIDE_LABEL_STYLES[r.upsideResult.label]}
                      rows={UPSIDE_ROW_LABELS} subScores={r.upsideResult.subScores}
                      extraNote={r.upsideResult.dataGapCount > 0 ? `Data gaps (${r.upsideResult.dataGapCount}): ${r.upsideResult.dataGaps.join(", ")}` : undefined}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-900">{r.masterScore}</span>
                      <span className={`inline-flex items-center rounded-full ${MASTER_LABEL_STYLES[r.master.masterLabel]} text-xs font-semibold px-2 py-0.5 whitespace-nowrap`}>
                        {r.master.masterLabel}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => onRemove(r.ticker)} className="text-xs text-red-500 hover:text-red-700 mr-2">Remove</button>
                    <button onClick={() => onMoveToExcluded(r.ticker)} className="text-xs text-[var(--muted)] hover:text-red-600">Move to Excluded</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
