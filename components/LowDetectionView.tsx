"use client";

import { useState } from "react";
import type { TroughEvent } from "@/app/api/low-detection/route";

type RowKey = "date" | "price" | "ema20" | "ema50" | "rsi" | "diPlus" | "diMinus" | "diGap" | "adx" | "macd" | "signal" | "hist" | "cmf";

interface RowDef {
  key: RowKey;
  label: string;
  fmt: (v: TroughEvent) => string;
  // "max" = highest value is most bullish, "min" = lowest value is most bullish, null = no highlight
  best: "max" | "min" | null;
}

const ROWS: RowDef[] = [
  { key: "date", label: "Date", fmt: (t) => t.date, best: null },
  { key: "price", label: "Price", fmt: (t) => t.price.toFixed(2), best: null },
  { key: "ema20", label: "EMA20", fmt: (t) => (t.ema20 != null ? t.ema20.toFixed(2) : "—"), best: null },
  { key: "ema50", label: "EMA50", fmt: (t) => (t.ema50 != null ? t.ema50.toFixed(2) : "—"), best: null },
  { key: "rsi", label: "RSI", fmt: (t) => t.rsi.toFixed(1), best: "max" },
  { key: "diPlus", label: "DI+", fmt: (t) => (t.diPlus != null ? t.diPlus.toFixed(1) : "—"), best: "max" },
  { key: "diMinus", label: "DI-", fmt: (t) => (t.diMinus != null ? t.diMinus.toFixed(1) : "—"), best: "min" },
  { key: "diGap", label: "DI Gap (DI+ − DI-)", fmt: (t) => (t.diPlus != null && t.diMinus != null ? (t.diPlus - t.diMinus).toFixed(1) : "—"), best: "max" },
  { key: "adx", label: "ADX", fmt: (t) => (t.adx != null ? t.adx.toFixed(1) : "—"), best: "min" },
  { key: "macd", label: "MACD", fmt: (t) => (t.macd != null ? t.macd.toFixed(3) : "—"), best: null },
  { key: "signal", label: "Signal", fmt: (t) => (t.signal != null ? t.signal.toFixed(3) : "—"), best: null },
  { key: "hist", label: "Hist", fmt: (t) => (t.hist != null ? t.hist.toFixed(3) : "—"), best: "max" },
  { key: "cmf", label: "CMF", fmt: (t) => (t.cmf != null ? t.cmf.toFixed(3) : "—"), best: "max" },
];

function rawValue(t: TroughEvent, key: RowKey): number | null {
  if (key === "date") return null;
  if (key === "diGap") return t.diPlus != null && t.diMinus != null ? t.diPlus - t.diMinus : null;
  const v = t[key as Exclude<RowKey, "date" | "diGap">];
  return typeof v === "number" ? v : null;
}

export default function LowDetectionView() {
  const [tickerInput, setTickerInput] = useState("");
  const [ticker, setTicker] = useState<string | null>(null);
  const [rsiTroughs, setRsiTroughs] = useState<TroughEvent[]>([]);
  const [oneYearLow, setOneYearLow] = useState<TroughEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(t: string) {
    const clean = t.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/low-detection?ticker=${encodeURIComponent(clean)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "fetch failed");
        setRsiTroughs([]);
        setOneYearLow(null);
      } else {
        setTicker(json.ticker);
        setRsiTroughs(json.troughs ?? []);
        setOneYearLow(json.oneYearLow ?? null);
        if ((json.troughs ?? []).length === 0) setError("No RSI<30 troughs found in the trailing window (1Y low still shown)");
      }
    } catch {
      setError("fetch failed");
      setRsiTroughs([]);
      setOneYearLow(null);
    } finally {
      setLoading(false);
    }
  }

  // Always show the actual trailing-1Y price low as the final column, even when it never dipped
  // RSI<30 — dedupe against the RSI-cluster troughs if it's the same date as the last one.
  const lastRsiTrough = rsiTroughs[rsiTroughs.length - 1];
  const oneYearLowIsDuplicate = oneYearLow && lastRsiTrough && lastRsiTrough.date === oneYearLow.date;
  const troughs: TroughEvent[] = oneYearLow
    ? oneYearLowIsDuplicate
      ? rsiTroughs
      : [...rsiTroughs, oneYearLow]
    : rsiTroughs;
  const columnLabels = troughs.map((_, i) =>
    oneYearLow && !oneYearLowIsDuplicate && i === troughs.length - 1 ? "1Y Low" : `Low ${i + 1}`
  );
  if (oneYearLowIsDuplicate && columnLabels.length > 0) columnLabels[columnLabels.length - 1] = `Low ${columnLabels.length} / 1Y Low`;

  // % change from the trough just before the 1Y low column to the 1Y low column itself — usually
  // the last RSI<30 dip prior to the actual 1Y low.
  const showPctChangeCol = troughs.length >= 2;
  const prevTrough = showPctChangeCol ? troughs[troughs.length - 2] : null;
  const lastTrough = showPctChangeCol ? troughs[troughs.length - 1] : null;

  function pctChange(row: RowDef): number | null {
    if (row.key === "date" || !prevTrough || !lastTrough) return null;
    const prevVal = rawValue(prevTrough, row.key);
    const lastVal = rawValue(lastTrough, row.key);
    if (prevVal == null || lastVal == null || prevVal === 0) return null;
    return ((lastVal - prevVal) / Math.abs(prevVal)) * 100;
  }

  // Divergence classification for a row's % change cell — only meaningful when Price itself made
  // a fresh (lower) low into the 1Y-low column. Flips sign for "min is bullish" rows (DI-, ADX)
  // so the comparison is always "bullish-direction % change."
  const priceRowDef = ROWS.find((r) => r.key === "price")!;
  const priceChgPct = pctChange(priceRowDef);
  const priceMadeFreshLow = priceChgPct != null && priceChgPct < 0;

  function divergenceClass(row: RowDef): string {
    if (!row.best || !priceMadeFreshLow) return "text-gray-400";
    const pct = pctChange(row);
    if (pct == null) return "text-gray-400";
    const bullishPct = row.best === "max" ? pct : -pct;
    if (bullishPct >= 15) return "bg-emerald-200 text-emerald-900 font-semibold";
    if (bullishPct >= 5) return "bg-emerald-50 text-emerald-800";
    if (bullishPct <= -5) return "bg-red-50 text-red-700";
    return "text-gray-700";
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(tickerInput);
  }

  // Per row, the index (within troughs) of the most-bullish cell, for highlighting.
  const bestIdxByRow: Partial<Record<RowKey, number>> = {};
  for (const row of ROWS) {
    if (!row.best || troughs.length === 0) continue;
    let bestI: number | null = null;
    troughs.forEach((t, i) => {
      const v = rawValue(t, row.key);
      if (v == null) return;
      if (bestI == null) { bestI = i; return; }
      const bv = rawValue(troughs[bestI], row.key)!;
      if (row.best === "max" ? v > bv : v < bv) bestI = i;
    });
    if (bestI != null) bestIdxByRow[row.key] = bestI;
  }

  // Per row, where the latest (last-column) trough ranks among all troughs for that indicator —
  // rank 1 = most bullish reading in the whole series.
  const latestRankByRow: Partial<Record<RowKey, string>> = {};
  if (troughs.length > 0) {
    const lastIdx = troughs.length - 1;
    for (const row of ROWS) {
      if (!row.best) continue;
      const values = troughs.map((t) => rawValue(t, row.key)).filter((v): v is number => v != null);
      const lastVal = rawValue(troughs[lastIdx], row.key);
      if (lastVal == null || values.length === 0) continue;
      const sorted = [...values].sort((a, b) => (row.best === "max" ? b - a : a - b));
      const rank = sorted.indexOf(lastVal) + 1;
      latestRankByRow[row.key] = `(${rank}/${values.length})`;
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={tickerInput}
          onChange={(e) => setTickerInput(e.target.value)}
          placeholder="Ticker (e.g. CRM)"
          className="border border-gray-300 rounded px-2 py-1 text-sm w-40"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Detect Lows"}
        </button>
        <span className="text-xs text-gray-500">
          Finds every RSI(14)&lt;30 dip over the trailing 24 months, clusters nearby dips into one trough, and reads indicators off the local price low. The last column is always the actual trailing-1Y price low, even if RSI never dipped below 30 there.
        </span>
      </form>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {troughs.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded">
          <table className="text-sm border-collapse min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 text-left px-3 py-1.5 font-medium text-gray-600 border-b border-gray-200">
                  {ticker} — {troughs.length} trough{troughs.length !== 1 ? "s" : ""}
                </th>
                {troughs.map((t, i) => (
                  <th key={i} className="text-right px-3 py-1.5 font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap">
                    {columnLabels[i]}
                  </th>
                ))}
                {showPctChangeCol && (
                  <th className="text-right px-3 py-1.5 font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap">
                    % Chg ({columnLabels[columnLabels.length - 2]} → {columnLabels[columnLabels.length - 1]})
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key} className="odd:bg-white even:bg-gray-50/50">
                  <td className="sticky left-0 bg-inherit text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-100 whitespace-nowrap">
                    {row.label}
                  </td>
                  {troughs.map((t, i) => (
                    <td
                      key={i}
                      className={`text-right px-3 py-1.5 border-b border-gray-100 whitespace-nowrap tabular-nums ${
                        bestIdxByRow[row.key] === i ? "bg-emerald-100 text-emerald-800 font-semibold" : "text-gray-700"
                      }`}
                    >
                      {row.fmt(t)}
                      {i === troughs.length - 1 && latestRankByRow[row.key] && (
                        <span className="ml-1 text-xs text-gray-400 font-normal">{latestRankByRow[row.key]}</span>
                      )}
                    </td>
                  ))}
                  {showPctChangeCol && (() => {
                    const pct = pctChange(row);
                    return (
                      <td className={`text-right px-3 py-1.5 border-b border-gray-100 whitespace-nowrap tabular-nums ${divergenceClass(row)}`}>
                        {pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
                      </td>
                    );
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showPctChangeCol && priceMadeFreshLow && (
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>% Chg divergence:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-200" /> ≥+15% strong bullish divergence</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-50 border border-emerald-100" /> +5–15% mild divergence</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" /> −5–5% flat</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-50 border border-red-100" /> ≤−5% confirming weakness</span>
        </div>
      )}
    </div>
  );
}
