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
  const [troughs, setTroughs] = useState<TroughEvent[]>([]);
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
        setTroughs([]);
      } else {
        setTicker(json.ticker);
        setTroughs(json.troughs ?? []);
        if ((json.troughs ?? []).length === 0) setError("No RSI<30 troughs found in the trailing window");
      }
    } catch {
      setError("fetch failed");
      setTroughs([]);
    } finally {
      setLoading(false);
    }
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
          Finds every RSI(14)&lt;30 dip over the trailing 24 months, clusters nearby dips into one trough, and reads indicators off the local price low.
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
                    Low {i + 1}
                  </th>
                ))}
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
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
