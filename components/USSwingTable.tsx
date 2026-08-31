"use client";

import { useMemo, useState, type FormEvent } from "react";
import { downloadCsv } from "@/lib/exportCsv";

export interface USSwingStock {
  ticker: string;
  name: string | null;
  industry: string | null;
}

type SortKey =
  | "ticker" | "industry" | "price" | "atr"
  | "ema20d" | "distEma20d" | "ema50d" | "distEma50d"
  | "macd" | "low3mo" | "distLow3mo" | "rsi" | "relVolume";
type SortDir = "asc" | "desc";

interface Props {
  stocks: USSwingStock[];
  prices: Record<string, number | null>;
  atrs: Record<string, number | null>;
  ema20s: Record<string, number | null>;
  ema50s: Record<string, number | null>;
  macds: Record<string, number | null>;
  rsis: Record<string, number | null>;
  low3mos: Record<string, number | null>;
  relVolumes: Record<string, number | null>;
  loading?: boolean;
  addTicker?: string;
  addLoading?: boolean;
  addError?: string;
  onAddTickerChange?: (v: string) => void;
  onAdd?: (e: FormEvent) => void;
  onRemove?: (ticker: string) => void;
}

const dash = <span className="text-gray-400">—</span>;

export default function USSwingTable({
  stocks, prices, atrs, ema20s, ema50s, macds, rsis, low3mos, relVolumes, loading = false,
  addTicker = "", addLoading = false, addError = "", onAddTickerChange, onAdd, onRemove,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "ticker" || key === "industry" ? "asc" : "desc"); }
  }

  const rows = useMemo(() => {
    return stocks.map((s) => {
      const price = prices[s.ticker] ?? null;
      const ema20d = ema20s[s.ticker] ?? null;
      const ema50d = ema50s[s.ticker] ?? null;
      const low3mo = low3mos[s.ticker] ?? null;
      return {
        ...s,
        price,
        atr: atrs[s.ticker] ?? null,
        ema20d,
        distEma20d: price != null && ema20d != null ? ((price - ema20d) / ema20d) * 100 : null,
        ema50d,
        distEma50d: price != null && ema50d != null ? ((price - ema50d) / ema50d) * 100 : null,
        macd: macds[s.ticker] ?? null,
        low3mo,
        distLow3mo: price != null && low3mo != null && low3mo > 0 ? ((price - low3mo) / low3mo) * 100 : null,
        rsi: rsis[s.ticker] ?? null,
        relVolume: relVolumes[s.ticker] ?? null,
      };
    });
  }, [stocks, prices, atrs, ema20s, ema50s, macds, rsis, low3mos, relVolumes]);

  const sortedRows = useMemo(() => {
    const getVal = (r: (typeof rows)[number]): number | string | null => {
      switch (sortKey) {
        case "ticker": return r.ticker;
        case "industry": return r.industry;
        case "price": return r.price;
        case "atr": return r.atr;
        case "ema20d": return r.ema20d;
        case "distEma20d": return r.distEma20d;
        case "ema50d": return r.ema50d;
        case "distEma50d": return r.distEma50d;
        case "macd": return r.macd;
        case "low3mo": return r.low3mo;
        case "distLow3mo": return r.distLow3mo;
        case "rsi": return r.rsi;
        case "relVolume": return r.relVolume;
        default: return null;
      }
    };
    const data = [...rows];
    data.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return data;
  }, [rows, sortKey, sortDir]);

  function exportCsv() {
    const date = new Date().toISOString().slice(0, 10);
    const headers = ["Ticker", "Name", "Industry", "Price", "ATR%", "EMA20D", "Dist EMA20D%",
      "EMA50D", "Dist EMA50D%", "MACD", "Low (3mo)", "Dist from Low%", "RSI", "Rel Volume"];
    const data = sortedRows.map((r) => [
      r.ticker, r.name ?? "", r.industry,
      r.price?.toFixed(2) ?? "", r.atr?.toFixed(1) ?? "",
      r.ema20d?.toFixed(2) ?? "", r.distEma20d?.toFixed(1) ?? "",
      r.ema50d?.toFixed(2) ?? "", r.distEma50d?.toFixed(1) ?? "",
      r.macd?.toFixed(2) ?? "", r.low3mo?.toFixed(2) ?? "", r.distLow3mo?.toFixed(1) ?? "",
      r.rsi?.toFixed(1) ?? "", r.relVolume?.toFixed(2) ?? "",
    ]);
    downloadCsv(`swing-${date}.csv`, headers, data);
  }

  const Th = ({ label, k, title, sticky }: { label: string; k: SortKey; title?: string; sticky?: boolean }) => (
    <th
      title={title}
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 whitespace-nowrap select-none${sticky ? " sticky left-0 z-20 bg-gray-100 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-300 after:content-['']" : ""}`}
      onClick={() => toggleSort(k)}
    >
      {label}{sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  const distColor = (v: number | null) =>
    v == null ? "text-gray-400" : v >= 0 ? "text-green-600" : "text-red-500";

  const rsiColor = (v: number | null) =>
    v == null ? "text-gray-400" : v >= 70 ? "text-red-500" : v <= 30 ? "text-green-600" : "text-gray-700";

  const relVolColor = (v: number | null) =>
    v == null ? "text-gray-400" : v >= 1.5 ? "text-green-600 font-semibold" : v <= 0.5 ? "text-gray-400" : "text-gray-700";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={onAdd} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. TSLA"
            value={addTicker}
            onChange={(e) => onAddTickerChange?.(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 w-32 uppercase"
          />
          <button
            type="submit"
            disabled={addLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm font-semibold"
          >
            {addLoading ? "Adding…" : "+ Add"}
          </button>
        </form>
        {addError && <span className="text-xs text-red-500">{addError}</span>}
        {loading && <span className="text-xs text-gray-400 animate-pulse">Loading daily indicators…</span>}
        <span className="text-xs text-gray-400 ml-auto">{stocks.length} stocks · daily timeframe · independent from List</span>
        <button
          onClick={exportCsv}
          className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 bg-white"
        >
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-[72vh] rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-30">
            <tr>
              <Th label="Ticker" k="ticker" sticky />
              <Th label="Industry" k="industry" />
              <Th label="Price" k="price" />
              <Th label="ATR%" k="atr" title="Daily ATR% — volatility as % of price" />
              <Th label="EMA20D" k="ema20d" title="EMA20, daily" />
              <Th label="Dist EMA20D" k="distEma20d" title="Price distance from EMA20 daily" />
              <Th label="EMA50D" k="ema50d" title="EMA50, daily" />
              <Th label="Dist EMA50D" k="distEma50d" title="Price distance from EMA50 daily" />
              <Th label="MACD" k="macd" title="MACD line (12, 26) — daily closes" />
              <Th label="Low (3mo)" k="low3mo" title="Lowest intraday low over the last ~3 months (63 sessions)" />
              <Th label="Dist from Low" k="distLow3mo" title="Price distance from the 3-month low" />
              <Th label="RSI" k="rsi" title="RSI(14), daily" />
              <Th label="Rel Volume" k="relVolume" title="Latest session volume vs its trailing 20-day average" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRows.length === 0 && (
              <tr><td colSpan={14} className="px-3 py-6 text-center text-gray-400 text-sm">No tickers yet — add one above.</td></tr>
            )}
            {sortedRows.map((r) => (
              <tr key={r.ticker} className="hover:bg-gray-50">
                <td className="px-3 py-2 sticky left-0 z-10 bg-white after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-200 after:content-['']">
                  <div className="font-semibold text-gray-900">{r.ticker}</div>
                  {r.name && <div className="text-xs text-gray-400">{r.name}</div>}
                </td>
                <td className="px-3 py-2 text-gray-600">{r.industry}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{r.price != null ? `$${r.price.toFixed(2)}` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.atr != null ? `${r.atr.toFixed(1)}%` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.ema20d != null ? r.ema20d.toFixed(2) : dash}</td>
                <td className={`px-3 py-2 font-medium ${distColor(r.distEma20d)}`}>{r.distEma20d != null ? `${r.distEma20d.toFixed(1)}%` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.ema50d != null ? r.ema50d.toFixed(2) : dash}</td>
                <td className={`px-3 py-2 font-medium ${distColor(r.distEma50d)}`}>{r.distEma50d != null ? `${r.distEma50d.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 font-medium ${distColor(r.macd)}`}>{r.macd != null ? r.macd.toFixed(2) : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.low3mo != null ? `$${r.low3mo.toFixed(2)}` : dash}</td>
                <td className="px-3 py-2 font-medium text-gray-700">{r.distLow3mo != null ? `${r.distLow3mo.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 font-medium ${rsiColor(r.rsi)}`}>{r.rsi != null ? r.rsi.toFixed(1) : dash}</td>
                <td className={`px-3 py-2 ${relVolColor(r.relVolume)}`}>{r.relVolume != null ? `${r.relVolume.toFixed(2)}x` : dash}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => onRemove?.(r.ticker)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
