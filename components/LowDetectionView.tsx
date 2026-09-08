"use client";

import { useState } from "react";
import type { TroughEvent } from "@/app/api/low-detection/route";

type RowKey = "date" | "price" | "ema20" | "ema50" | "rsi" | "diPlus" | "diMinus" | "diGap" | "adx" | "macd" | "signal" | "hist" | "cmf" | "obv";

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
  { key: "obv", label: "OBV", fmt: (t) => (t.obv != null ? t.obv.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"), best: "max" },
];

function rawValue(t: TroughEvent, key: RowKey): number | null {
  if (key === "date") return null;
  if (key === "diGap") return t.diPlus != null && t.diMinus != null ? t.diPlus - t.diMinus : null;
  const v = t[key as Exclude<RowKey, "date" | "diGap">];
  return typeof v === "number" ? v : null;
}

interface Column {
  label: string;
  data: TroughEvent;
  custom?: boolean;
}

// Parses a "Key: value" per-line block (Date/Price/EMA20/EMA50/RSI/DI+/DI-/ADX/MACD/Signal/Hist/CMF)
// pasted straight out of manual analysis, e.g. from a chat transcript.
function parsePastedValues(text: string): TroughEvent | null {
  const map: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (key) map[key] = val;
  }
  const num = (k: string) => {
    const v = map[k];
    if (v == null) return null;
    const n = parseFloat(v.replace(/,/g, ""));
    return isNaN(n) ? null : n;
  };
  const price = num("price");
  const rsi = num("rsi");
  if (price == null || rsi == null) return null;
  return {
    date: map["date"] ?? "",
    price,
    ema20: num("ema20"),
    ema50: num("ema50"),
    rsi,
    diPlus: num("di+"),
    diMinus: num("di-"),
    adx: num("adx"),
    macd: num("macd"),
    signal: num("signal"),
    hist: num("hist"),
    cmf: num("cmf"),
    obv: num("obv"),
  };
}

export default function LowDetectionView() {
  const [tickerInput, setTickerInput] = useState("");
  const [ticker, setTicker] = useState<string | null>(null);
  const [rsiTroughs, setRsiTroughs] = useState<TroughEvent[]>([]);
  const [oneYearLow, setOneYearLow] = useState<TroughEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customColumns, setCustomColumns] = useState<Column[]>([]);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  async function runSearch(t: string) {
    const clean = t.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError(null);
    setCustomColumns([]);
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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(tickerInput);
  }

  function onAddColumn() {
    const parsed = parsePastedValues(pasteText);
    if (!parsed) {
      setPasteError("Couldn't find Price and RSI lines — check the pasted format");
      return;
    }
    const label = newColumnName.trim() || `Custom ${customColumns.length + 1}`;
    setCustomColumns((cols) => [...cols, { label, data: parsed, custom: true }]);
    setAddingColumn(false);
    setNewColumnName("");
    setPasteText("");
    setPasteError(null);
  }

  function removeCustomColumn(i: number) {
    setCustomColumns((cols) => cols.filter((_, idx) => idx !== i));
  }

  // Always show the actual trailing-1Y price low as a base column, even when it never dipped
  // RSI<30 — dedupe against the RSI-cluster troughs if it's the same date as the last one.
  const lastRsiTrough = rsiTroughs[rsiTroughs.length - 1];
  const oneYearLowIsDuplicate = oneYearLow && lastRsiTrough && lastRsiTrough.date === oneYearLow.date;
  const baseTroughs: TroughEvent[] = oneYearLow
    ? oneYearLowIsDuplicate
      ? rsiTroughs
      : [...rsiTroughs, oneYearLow]
    : rsiTroughs;
  const baseLabels = baseTroughs.map((_, i) =>
    oneYearLow && !oneYearLowIsDuplicate && i === baseTroughs.length - 1 ? "1Y Low" : `Low ${i + 1}`
  );
  if (oneYearLowIsDuplicate && baseLabels.length > 0) baseLabels[baseLabels.length - 1] = `Low ${baseLabels.length} / 1Y Low`;

  const columns: Column[] = [
    ...baseTroughs.map((data, i) => ({ label: baseLabels[i], data })),
    ...customColumns,
  ];

  // % change from the second-to-last column to the last column — usually 1Y Low, or (once a
  // custom "dead cat bounce" column is added) the 1Y Low vs that custom low.
  const showPctChangeCol = columns.length >= 2;
  const prevCol = showPctChangeCol ? columns[columns.length - 2] : null;
  const lastCol = showPctChangeCol ? columns[columns.length - 1] : null;

  function pctChange(row: RowDef): number | null {
    if (row.key === "date" || !prevCol || !lastCol) return null;
    const prevVal = rawValue(prevCol.data, row.key);
    const lastVal = rawValue(lastCol.data, row.key);
    if (prevVal == null || lastVal == null || prevVal === 0) return null;
    return ((lastVal - prevVal) / Math.abs(prevVal)) * 100;
  }

  // Color classification for a row's % change cell. Flips sign for "min is bullish" rows
  // (DI-, ADX) so the comparison is always "bullish-direction % change." Always shown — not
  // gated on Price itself falling — since a rising indicator into a bounce is still worth
  // flagging (that's the "is this a real low or a dead-cat bounce" read).
  function divergenceClass(row: RowDef): string {
    const pct = pctChange(row);
    if (pct == null) return "text-gray-400";
    if (!row.best) {
      // No bullish/bearish direction for this row (Price, EMA20/50, MACD, Signal) — plain
      // green/red text by sign.
      return pct > 0 ? "text-emerald-700" : pct < 0 ? "text-red-600" : "text-gray-700";
    }
    const bullishPct = row.best === "max" ? pct : -pct;
    if (bullishPct >= 15) return "bg-emerald-200 text-emerald-900 font-semibold";
    if (bullishPct >= 5) return "bg-emerald-50 text-emerald-800";
    if (bullishPct <= -5) return "bg-red-50 text-red-700";
    return "text-gray-700";
  }

  // Per row, the index (within columns) of the most-bullish cell, for highlighting.
  const bestIdxByRow: Partial<Record<RowKey, number>> = {};
  for (const row of ROWS) {
    if (!row.best || columns.length === 0) continue;
    let bestI: number | null = null;
    columns.forEach((c, i) => {
      const v = rawValue(c.data, row.key);
      if (v == null) return;
      if (bestI == null) { bestI = i; return; }
      const bv = rawValue(columns[bestI].data, row.key)!;
      if (row.best === "max" ? v > bv : v < bv) bestI = i;
    });
    if (bestI != null) bestIdxByRow[row.key] = bestI;
  }

  // Per row, where the latest (last-column) reading ranks among all columns for that indicator —
  // rank 1 = most bullish reading in the whole series.
  const latestRankByRow: Partial<Record<RowKey, string>> = {};
  if (columns.length > 0) {
    const lastIdx = columns.length - 1;
    for (const row of ROWS) {
      if (!row.best) continue;
      const values = columns.map((c) => rawValue(c.data, row.key)).filter((v): v is number => v != null);
      const lastVal = rawValue(columns[lastIdx].data, row.key);
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
          Finds every RSI(14)&lt;30 dip over the trailing 24 months, clusters nearby dips into one trough, and reads indicators off the local price low. The base last column is always the actual trailing-1Y price low, even if RSI never dipped below 30 there.
        </span>
      </form>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {columns.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded">
          <table className="text-sm border-collapse min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 text-left px-3 py-1.5 font-medium text-gray-600 border-b border-gray-200">
                  {ticker} — {columns.length} column{columns.length !== 1 ? "s" : ""}
                </th>
                {columns.map((c, i) => (
                  <th key={i} className="text-right px-3 py-1.5 font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap">
                    {c.label}
                    {c.custom && (
                      <button
                        type="button"
                        onClick={() => removeCustomColumn(i - baseTroughs.length)}
                        title="Remove column"
                        className="ml-1.5 text-gray-400 hover:text-red-600 font-normal"
                      >
                        ×
                      </button>
                    )}
                  </th>
                ))}
                <th className="text-center px-2 py-1.5 border-b border-gray-200">
                  <button
                    type="button"
                    onClick={() => setAddingColumn((v) => !v)}
                    title="Add custom column"
                    className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold leading-none"
                  >
                    +
                  </button>
                </th>
                {showPctChangeCol && (
                  <th className="text-right px-3 py-1.5 font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap">
                    % Chg ({prevCol?.label} → {lastCol?.label})
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
                  {columns.map((c, i) => (
                    <td
                      key={i}
                      className={`text-right px-3 py-1.5 border-b border-gray-100 whitespace-nowrap tabular-nums ${
                        bestIdxByRow[row.key] === i ? "bg-emerald-100 text-emerald-800 font-semibold" : "text-gray-700"
                      }`}
                    >
                      {row.fmt(c.data)}
                      {i === columns.length - 1 && latestRankByRow[row.key] && (
                        <span className="ml-1 text-xs text-gray-400 font-normal">{latestRankByRow[row.key]}</span>
                      )}
                    </td>
                  ))}
                  <td className="border-b border-gray-100" />
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

      {showPctChangeCol && (
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>% Chg color:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-200" /> ≥+15% strong bullish divergence</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-50 border border-emerald-100" /> +5–15% mild divergence</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" /> −5–5% flat</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-50 border border-red-100" /> ≤−5% confirming weakness</span>
        </div>
      )}

      {addingColumn && (
        <div className="border border-gray-200 rounded p-3 space-y-2 max-w-md">
          <div className="text-sm font-medium text-gray-700">Add custom column</div>
          <input
            type="text"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            placeholder="Column name (e.g. Dead Cat Bounce Low)"
            className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
          />
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Paste values, e.g.:\nDate: 2026-06-18\nPrice: 43.47\nEMA20: 46.57\nEMA50: 47.58\nRSI: 39.0\nDI+: 17.7\nDI-: 27.6\nADX: 17.3\nMACD: -1.313\nSignal: -0.540\nHist: -0.773\nCMF: -0.066"}
            rows={6}
            className="border border-gray-300 rounded px-2 py-1 text-sm w-full font-mono"
          />
          {pasteError && <div className="text-xs text-red-600">{pasteError}</div>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAddColumn}
              className="px-3 py-1 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Save Column
            </button>
            <button
              type="button"
              onClick={() => { setAddingColumn(false); setPasteError(null); }}
              className="px-3 py-1 text-sm font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
