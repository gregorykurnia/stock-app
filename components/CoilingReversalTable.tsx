"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { downloadCsv } from "@/lib/exportCsv";
import {
  scoreMasterV2Rows,
  type MasterV2Label,
  type PillarSubScores,
  type AccumulationSubScores,
  type FundamentalSubScores,
} from "@/lib/masterScoreV2";
import type { UpsideInput as UpsideRaw } from "@/lib/upsideScore";

export interface CoilingStock {
  ticker: string;
  name: string | null;
  industry: string | null;
  addedAt?: string | null;
}

type SortKey =
  | "ticker" | "industry" | "price" | "distFrom2yHigh"
  | "pillar1Score" | "pillar2Score" | "pillar3Score" | "masterScore"
  | "rsiDivergence" | "rsiDivergenceWeekly" | "obvDivergence" | "weeklyRsi" | "rsiFloor6mo";
type SortDir = "asc" | "desc";

const MASTER_LABEL_STYLES: Record<MasterV2Label, string> = {
  "Tier 1: High Conviction": "bg-green-100 text-green-700 border border-green-300",
  "Tier 2: Strong Candidate": "bg-blue-100 text-blue-700 border border-blue-300",
  "Tier 3: Watch Closely": "bg-yellow-100 text-yellow-700 border border-yellow-300",
  "Tier 4: Too Early": "bg-orange-100 text-orange-700 border border-orange-300",
  "Tier 5: Avoid": "bg-red-100 text-red-700 border border-red-300",
};

const SETUP_ROW_LABELS: [keyof PillarSubScores, string][] = [
  ["distFrom2yHigh", "% from 2Y High"],
  ["distFrom6moLow", "% from 6mo Low"],
  ["ma30wkSlope", "30wk MA Slope"],
  ["bbw", "BBW Percentile"],
  ["atrPct", "ATR%"],
];

const ACCUMULATION_ROW_LABELS: [keyof AccumulationSubScores, string][] = [
  ["rsiDivDaily", "RSI Divergence (Daily)"],
  ["rsiDivWeekly", "RSI Divergence (Weekly)"],
  ["obvDivergence", "OBV Divergence"],
  ["recoveryCandle", "Recovery Candle"],
];

const FUNDAMENTAL_ROW_LABELS: [keyof FundamentalSubScores, string][] = [
  ["grossMarginTrend", "Gross Margin Trend"],
  ["revenueTrend", "Revenue Trend"],
  ["fcfStatus", "FCF Status"],
  ["shortInterest", "Short Interest"],
  ["insiderBuying", "Insider Buying"],
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
  rsiDivDailyConfirmed: Record<string, boolean | null>;
  rsiDivergenceWeekly: Record<string, number | null>;
  rsiDivWeeklyConfirmed: Record<string, boolean | null>;
  obvSlope: Record<string, number | null>;
  obvDivergence: Record<string, number | null>;
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
  recoveryCandle: Record<string, number | null>;
  upside: Record<string, UpsideRaw>;
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

interface TierRange { range: string; color: keyof typeof TIER_DOT; meaning: string }
interface ColumnTip { definition: string; ranges: TierRange[] }

const TIER_DOT: Record<string, string> = {
  green: "bg-green-600", blue: "bg-blue-500", yellow: "bg-yellow-500", red: "bg-red-500", gray: "bg-gray-400",
};

const COLUMN_TIPS: Partial<Record<SortKey, ColumnTip>> = {
  masterScore: {
    definition: "Sum of three equal pillars (Setup Quality + Accumulation Signal + Fundamental Health, max 10 each = max 30). No hard eliminators — every row is scored; issues surface as Flag Reasons only.",
    ranges: [
      { range: "24–30", color: "green", meaning: "Tier 1: High Conviction" },
      { range: "18–23", color: "blue", meaning: "Tier 2: Strong Candidate" },
      { range: "12–17", color: "yellow", meaning: "Tier 3: Watch Closely" },
      { range: "6–11", color: "gray", meaning: "Tier 4: Too Early" },
      { range: "0–5", color: "red", meaning: "Tier 5: Avoid" },
    ],
  },
  pillar1Score: {
    definition: "Setup Quality (max 10): is this stock coiling / forming a base? % from 2Y High + % from 6mo Low + 30wk MA Slope + BBW Percentile + ATR%.",
    ranges: [],
  },
  pillar2Score: {
    definition: "Accumulation Signal (max 10): is smart money already buying? RSI Divergence (Daily + Weekly) + OBV Divergence + Recovery Candle.",
    ranges: [],
  },
  pillar3Score: {
    definition: "Fundamental Health (max 10): is the business worth owning? Gross Margin Trend + Revenue Trend + FCF Status + Short Interest + Insider Buying.",
    ranges: [],
  },
  distFrom2yHigh: {
    definition: "Distance below the trailing 2-year high (discount depth). ⚑ Flag: > -15% (barely off its high — not beaten down).",
    ranges: [
      { range: "< -60%", color: "green", meaning: "3 pts" },
      { range: "-60% to -40%", color: "blue", meaning: "2 pts" },
      { range: "-40% to -25%", color: "yellow", meaning: "1 pt" },
      { range: "> -25%", color: "red", meaning: "0 pts" },
    ],
  },
  rsiDivergence: {
    definition: "Daily RSI(14, Wilder) at the 20-day low minus RSI at the 40-20-day-ago low. Only scored when a double-bottom is confirmed (Low2 within 5% below Low1 and RSI at Low2 higher). Logged as a Data Gap when fewer than 40 daily bars are available.",
    ranges: [
      { range: "> 10", color: "green", meaning: "3 pts" },
      { range: "5–10", color: "blue", meaning: "2 pts" },
      { range: "2–5", color: "yellow", meaning: "1 pt" },
      { range: "no divergence", color: "red", meaning: "0 pts" },
    ],
  },
  rsiDivergenceWeekly: {
    definition: "Same shape as RSI Divergence but on weekly closes (16-8 weeks ago low vs last 8 weeks low).",
    ranges: [
      { range: "> 7", color: "green", meaning: "3 pts" },
      { range: "3–7", color: "blue", meaning: "2 pts" },
      { range: "1–3", color: "yellow", meaning: "1 pt" },
      { range: "no divergence", color: "red", meaning: "0 pts" },
    ],
  },
  obvDivergence: {
    definition: "Normalized OBV slope minus normalized price slope, last 20 sessions. Positive = OBV rising while price is flat/falling (accumulation).",
    ranges: [
      { range: "> 0.03", color: "green", meaning: "2 pts" },
      { range: "0.01–0.03", color: "blue", meaning: "1 pt" },
      { range: "< 0.01", color: "red", meaning: "0 pts" },
    ],
  },
  weeklyRsi: {
    definition: "RSI(14) on weekly closes. ⚑ Flag: outside 35–65 (extreme reading).",
    ranges: [],
  },
  rsiFloor6mo: {
    definition: "Lowest weekly RSI over the trailing 26 weeks — how oversold the stock got at worst. Informational only.",
    ranges: [],
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

// Generic pillar-score badge (score + hover breakdown), reused for Pillar 1/2/3.
function PillarBadge<K extends string>({
  score, max, rows, subScores, extraNote,
}: {
  score: number; max: number; rows: [K, string][]; subScores: Record<K, number>; extraNote?: string;
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
        {score}/{max}
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
                  <td className="py-0.5 text-right font-mono text-gray-800">{subScores[key]}</td>
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

const EMPTY_UPSIDE: UpsideRaw = {
  gmChanges: null, revenueGrowth: null, cash: null, avgQuarterlyFcf: null,
  epsCurrent: null, epsNinetyDaysAgo: null, shortPercentOfFloat: null, insiderBuyCount: null,
};

export default function CoilingReversalTable({
  stocks, prices, distFrom2yHigh, distFrom6moLow, roc1mo, roc3mo,
  ma30wk, priceVsMa30wk, ma30wkSlope, volRatio10_90, upDownVolRatio, bbw,
  atrPct, atrTrend, weeklyRsi, rsiFloor6mo, rsiDivergence, rsiDivDailyConfirmed, rsiDivergenceWeekly, rsiDivWeeklyConfirmed,
  obvSlope, obvDivergence, maStackScore, lowerHighs, rsVsSpy3mo,
  slopeNow, slope4wk, slope8wk, maTouchCount, rangeContractionRatio, rsLineDiffPct, volGreenRatio, recoveryCandle, upside,
  loading, addTicker, addLoading, addError, onAddTickerChange, onAdd, onRemove, onMoveToExcluded,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // roc3mo/ma30wk/priceVsMa30wk/volRatio10_90/upDownVolRatio/atrTrend/maStackScore/rsVsSpy3mo/
  // slopeNow/slope4wk/slope8wk/maTouchCount/rangeContractionRatio/rsLineDiffPct/volGreenRatio/
  // obvSlope are still fetched by the shared /api/coiling-daily route (Bagger Reversal reuses
  // them) but are no longer part of the unified Master Score, so they're intentionally unused here.
  void roc3mo; void ma30wk; void priceVsMa30wk; void volRatio10_90; void upDownVolRatio; void atrTrend;
  void maStackScore; void rsVsSpy3mo; void slopeNow; void slope4wk; void slope8wk; void maTouchCount;
  void rangeContractionRatio; void rsLineDiffPct; void volGreenRatio; void obvSlope;

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const rows = useMemo(() => {
    const base = stocks.map((s) => {
      const u = upside[s.ticker] ?? EMPTY_UPSIDE;
      return {
        ...s,
        price: prices[s.ticker] ?? null,
        distFrom2yHigh: distFrom2yHigh[s.ticker] ?? null,
        distFrom6moLow: distFrom6moLow[s.ticker] ?? null,
        roc1mo: roc1mo[s.ticker] ?? null,
        ma30wkSlope: ma30wkSlope[s.ticker] ?? null,
        bbw: bbw[s.ticker] ?? null,
        atrPct: atrPct[s.ticker] ?? null,
        weeklyRsi: weeklyRsi[s.ticker] ?? null,
        rsiFloor6mo: rsiFloor6mo[s.ticker] ?? null,
        rsiDivergence: rsiDivergence[s.ticker] ?? null,
        rsiDivDaily: rsiDivergence[s.ticker] ?? null,
        rsiDivDailyConfirmed: rsiDivDailyConfirmed[s.ticker] ?? null,
        rsiDivergenceWeekly: rsiDivergenceWeekly[s.ticker] ?? null,
        rsiDivWeekly: rsiDivergenceWeekly[s.ticker] ?? null,
        rsiDivWeeklyConfirmed: rsiDivWeeklyConfirmed[s.ticker] ?? null,
        obvDivergence: obvDivergence[s.ticker] ?? null,
        recoveryCandle: recoveryCandle[s.ticker] ?? null,
        lowerHighs: lowerHighs[s.ticker] ?? null,
        gmChanges: u.gmChanges ?? null,
        revenueGrowth: u.revenueGrowth ?? null,
        avgQuarterlyFcf: u.avgQuarterlyFcf ?? null,
        cash: u.cash ?? null,
        shortPercentOfFloat: u.shortPercentOfFloat ?? null,
        insiderBuyCount: u.insiderBuyCount ?? null,
      };
    });
    const scores = scoreMasterV2Rows(base);
    const arr = base.map((r, i) => ({ ...r, ...scores[i] }));
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
  }, [stocks, prices, distFrom2yHigh, distFrom6moLow, roc1mo, ma30wkSlope, bbw, atrPct, weeklyRsi,
      rsiFloor6mo, rsiDivergence, rsiDivDailyConfirmed, rsiDivergenceWeekly, rsiDivWeeklyConfirmed,
      obvDivergence, recoveryCandle, lowerHighs, upside, sortKey, sortDir]);

  function exportCsv() {
    const date = new Date().toISOString().slice(0, 10);
    const headers = [
      "Ticker", "Industry", "Price", "% from 2Y High",
      "Pillar 1 Score", "Pillar 2 Score", "Pillar 3 Score",
      "Master Score", "Master Label",
      "RSI Divergence (raw)", "RSI Divergence Weekly (raw)",
      "OBV Divergence (raw)", "Weekly RSI", "RSI Floor 6mo",
      "Flag Reasons", "Data Gaps",
    ];
    const data = rows.map((r) => [
      r.ticker,
      r.industry ?? "",
      r.price?.toFixed(2) ?? "",
      r.distFrom2yHigh?.toFixed(1) ?? "",
      r.pillar1Score,
      r.pillar2Score,
      r.pillar3Score,
      r.masterScore,
      r.masterLabel,
      r.rsiDivergence?.toFixed(1) ?? "",
      r.rsiDivergenceWeekly?.toFixed(1) ?? "",
      r.obvDivergence?.toFixed(4) ?? "",
      r.weeklyRsi?.toFixed(1) ?? "",
      r.rsiFloor6mo?.toFixed(1) ?? "",
      r.flagReasons.join("; "),
      r.dataGaps.join(", "),
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
              <tr>
                {th("Ticker", "ticker")}
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Industry</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Price</th>
                {th("% from 2Y High", "distFrom2yHigh")}
                {th("Pillar 1: Setup", "pillar1Score")}
                {th("Pillar 2: Accumulation", "pillar2Score")}
                {th("Pillar 3: Fundamental", "pillar3Score")}
                {th("Master Score", "masterScore")}
                {th("RSI Divergence", "rsiDivergence")}
                {th("RSI Divergence Weekly", "rsiDivergenceWeekly")}
                {th("OBV Divergence", "obvDivergence")}
                {th("Weekly RSI", "weeklyRsi")}
                {th("RSI Floor 6mo", "rsiFloor6mo")}
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Flag Reasons</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Data Gaps</th>
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
                  <td className="px-3 py-2">{pctCell(r.distFrom2yHigh, r.setupSubScores.distFrom2yHigh)}</td>
                  <td className="px-3 py-2">
                    <PillarBadge score={r.pillar1Score} max={10} rows={SETUP_ROW_LABELS} subScores={r.setupSubScores} />
                  </td>
                  <td className="px-3 py-2">
                    <PillarBadge score={r.pillar2Score} max={10} rows={ACCUMULATION_ROW_LABELS} subScores={r.accumulationSubScores} />
                  </td>
                  <td className="px-3 py-2">
                    <PillarBadge
                      score={r.pillar3Score} max={10} rows={FUNDAMENTAL_ROW_LABELS} subScores={r.fundamentalSubScores}
                      extraNote={r.dataGaps.length > 0 ? `Data gaps (${r.dataGaps.length}): ${r.dataGaps.join(", ")}` : undefined}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-900">{r.masterScore}/30</span>
                      <span className={`inline-flex items-center rounded-full ${MASTER_LABEL_STYLES[r.masterLabel]} text-xs font-semibold px-2 py-0.5 whitespace-nowrap`}>
                        {r.masterLabel}
                      </span>
                    </div>
                  </td>
                  <td className={`px-3 py-2 font-medium ${r.rsiDivergence == null ? "text-gray-400" : r.rsiDivergence > 0 ? "text-green-600" : "text-red-500"}`}>
                    {r.rsiDivergence != null ? `${r.rsiDivergence >= 0 ? "+" : ""}${r.rsiDivergence.toFixed(1)}` : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${r.rsiDivergenceWeekly == null ? "text-gray-400" : r.rsiDivergenceWeekly > 0 ? "text-green-600" : "text-red-500"}`}>
                    {r.rsiDivergenceWeekly != null ? `${r.rsiDivergenceWeekly >= 0 ? "+" : ""}${r.rsiDivergenceWeekly.toFixed(1)}` : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${r.obvDivergence == null ? "text-gray-400" : r.obvDivergence > 0 ? "text-green-600" : "text-red-500"}`}>
                    {r.obvDivergence != null ? `${r.obvDivergence >= 0 ? "+" : ""}${r.obvDivergence.toFixed(4)}` : dash}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{r.weeklyRsi != null ? r.weeklyRsi.toFixed(1) : dash}</td>
                  <td className="px-3 py-2 text-gray-700">{r.rsiFloor6mo != null ? r.rsiFloor6mo.toFixed(1) : dash}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 max-w-xs">
                    {r.flagReasons.length > 0 ? r.flagReasons.join("; ") : dash}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400 max-w-xs">
                    {r.dataGaps.length > 0 ? r.dataGaps.join(", ") : dash}
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
