"use client";

import { useMemo, useState, type FormEvent } from "react";
import { downloadCsv } from "@/lib/exportCsv";

export interface CoilingStock {
  ticker: string;
  name: string | null;
  industry: string | null;
  addedAt?: string | null;
}

type SortKey =
  | "ticker" | "industry" | "price" | "distFromAth" | "distFrom6moLow" | "roc1mo" | "roc3mo"
  | "ma30wk" | "priceVsMa30wk" | "ma30wkSlope" | "volRatio10_90" | "upDownVolRatio" | "bbw"
  | "atrPct" | "atrTrend" | "weeklyRsi" | "rsiFloor6mo" | "maStackScore" | "lowerHighs" | "rsVsSpy3mo";
type SortDir = "asc" | "desc";

interface Props {
  stocks: CoilingStock[];
  prices: Record<string, number | null>;
  distFromAth: Record<string, number | null>;
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
  maStackScore: Record<string, number | null>;
  lowerHighs: Record<string, boolean | null>;
  rsVsSpy3mo: Record<string, number | null>;
  loading?: boolean;
  addTicker: string;
  addLoading: boolean;
  addError: string;
  onAddTickerChange: (v: string) => void;
  onAdd: (e: FormEvent) => void;
  onRemove: (ticker: string) => void;
}

const dash = <span className="text-gray-400">—</span>;

const pctCell = (v: number | null, dec = 1, positiveGood = true) => {
  if (v == null) return dash;
  const good = positiveGood ? v >= 0 : v <= 0;
  return <span className={good ? "text-green-600 font-medium" : "text-red-500 font-medium"}>{v >= 0 ? "+" : ""}{v.toFixed(dec)}%</span>;
};

export default function CoilingReversalTable({
  stocks, prices, distFromAth, distFrom6moLow, roc1mo, roc3mo,
  ma30wk, priceVsMa30wk, ma30wkSlope, volRatio10_90, upDownVolRatio, bbw,
  atrPct, atrTrend, weeklyRsi, rsiFloor6mo, maStackScore, lowerHighs, rsVsSpy3mo,
  loading, addTicker, addLoading, addError, onAddTickerChange, onAdd, onRemove,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const rows = useMemo(() => {
    const arr = stocks.map((s) => ({
      ...s,
      price: prices[s.ticker] ?? null,
      distFromAth: distFromAth[s.ticker] ?? null,
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
      maStackScore: maStackScore[s.ticker] ?? null,
      lowerHighs: lowerHighs[s.ticker] ?? null,
      rsVsSpy3mo: rsVsSpy3mo[s.ticker] ?? null,
    }));
    arr.sort((a, b) => {
      let av: string | number | boolean | null = null, bv: string | number | boolean | null = null;
      if (sortKey === "ticker" || sortKey === "industry") { av = a[sortKey] ?? ""; bv = b[sortKey] ?? ""; }
      else { av = a[sortKey]; bv = b[sortKey]; }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      const an = Number(av), bn = Number(bv);
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return arr;
  }, [stocks, prices, distFromAth, distFrom6moLow, roc1mo, roc3mo, ma30wk, priceVsMa30wk, ma30wkSlope,
      volRatio10_90, upDownVolRatio, bbw, atrPct, atrTrend, weeklyRsi, rsiFloor6mo, maStackScore, lowerHighs, rsVsSpy3mo, sortKey, sortDir]);

  function exportCsv() {
    const date = new Date().toISOString().slice(0, 10);
    const headers = [
      "Ticker", "Industry", "Price", "% from ATH", "% from 6mo Low", "ROC 1mo", "ROC 3mo",
      "30wk MA", "Price vs 30wk MA", "30wk MA Slope", "Vol Ratio 10d/90d", "Up/Down Vol Ratio",
      "BBW", "ATR%", "ATR Trend", "Weekly RSI", "RSI Floor 6mo", "MA Stack Score", "Lower Highs", "RS vs SPY 3mo",
    ];
    const data = rows.map((r) => [
      r.ticker,
      r.industry ?? "",
      r.price?.toFixed(2) ?? "",
      r.distFromAth?.toFixed(1) ?? "",
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
      r.maStackScore ?? "",
      r.lowerHighs == null ? "" : r.lowerHighs ? "Yes" : "No",
      r.rsVsSpy3mo?.toFixed(2) ?? "",
    ]);
    downloadCsv(`coiling-reversal-${date}.csv`, headers, data);
  }

  const th = (label: string, k: SortKey, title?: string) => (
    <th
      key={k}
      onClick={() => handleSort(k)}
      title={title}
      className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 whitespace-nowrap select-none"
    >
      {label} {sortKey === k && (sortDir === "asc" ? "▲" : "▼")}
    </th>
  );

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
                {th("% from ATH", "distFromAth")}
                {th("% from 6mo Low", "distFrom6moLow")}
                {th("ROC 1mo", "roc1mo")}
                {th("ROC 3mo", "roc3mo")}
                {th("30wk MA", "ma30wk")}
                {th("Price vs 30wk MA", "priceVsMa30wk")}
                {th("30wk MA Slope", "ma30wkSlope")}
                {th("Vol Ratio 10d/90d", "volRatio10_90")}
                {th("Up/Down Vol Ratio", "upDownVolRatio")}
                {th("BBW", "bbw", "Bollinger Band Width (20d, 2 std dev)")}
                {th("ATR%", "atrPct")}
                {th("ATR Trend", "atrTrend", "ATR(14) now vs 20d ago; negative = contracting")}
                {th("Weekly RSI", "weeklyRsi")}
                {th("RSI Floor 6mo", "rsiFloor6mo")}
                {th("MA Stack", "maStackScore", "0-3: EMA20>EMA50, EMA50>EMA200, Price>EMA200")}
                {th("Lower Highs", "lowerHighs", "Last 3 swing highs over 20wk each lower than the prior")}
                {th("RS vs SPY 3mo", "rsVsSpy3mo")}
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.ticker} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-semibold text-gray-900">
                    {r.ticker}
                    {r.name && <div className="text-xs text-gray-400 font-normal">{r.name}</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.industry}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.price != null ? `$${r.price.toFixed(2)}` : dash}</td>
                  <td className="px-3 py-2">{pctCell(r.distFromAth, 1, false)}</td>
                  <td className="px-3 py-2">{pctCell(r.distFrom6moLow)}</td>
                  <td className="px-3 py-2">{pctCell(r.roc1mo)}</td>
                  <td className="px-3 py-2">{pctCell(r.roc3mo)}</td>
                  <td className="px-3 py-2 text-gray-700">{r.ma30wk != null ? `$${r.ma30wk.toFixed(2)}` : dash}</td>
                  <td className={`px-3 py-2 font-medium ${r.priceVsMa30wk == null ? "text-gray-400" : r.priceVsMa30wk >= 1 ? "text-green-600" : "text-red-500"}`}>
                    {r.priceVsMa30wk != null ? r.priceVsMa30wk.toFixed(2) : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${r.ma30wkSlope == null ? "text-gray-400" : r.ma30wkSlope >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {r.ma30wkSlope != null ? r.ma30wkSlope.toFixed(2) : dash}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{r.volRatio10_90 != null ? `${r.volRatio10_90.toFixed(2)}x` : dash}</td>
                  <td className="px-3 py-2 text-gray-700">{r.upDownVolRatio != null ? r.upDownVolRatio.toFixed(2) : dash}</td>
                  <td className="px-3 py-2 text-gray-700">{r.bbw != null ? r.bbw.toFixed(3) : dash}</td>
                  <td className="px-3 py-2 text-gray-700">{r.atrPct != null ? `${r.atrPct.toFixed(1)}%` : dash}</td>
                  <td className={`px-3 py-2 font-medium ${r.atrTrend == null ? "text-gray-400" : r.atrTrend < 0 ? "text-green-600" : "text-red-500"}`}>
                    {r.atrTrend != null ? r.atrTrend.toFixed(2) : dash}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{r.weeklyRsi != null ? r.weeklyRsi.toFixed(1) : dash}</td>
                  <td className="px-3 py-2 text-gray-700">{r.rsiFloor6mo != null ? r.rsiFloor6mo.toFixed(1) : dash}</td>
                  <td className="px-3 py-2 text-gray-700">{r.maStackScore != null ? `${r.maStackScore}/3` : dash}</td>
                  <td className="px-3 py-2">
                    {r.lowerHighs == null ? dash : r.lowerHighs
                      ? <span className="text-red-500 font-medium">Yes</span>
                      : <span className="text-green-600 font-medium">No</span>}
                  </td>
                  <td className={`px-3 py-2 font-medium ${r.rsVsSpy3mo == null ? "text-gray-400" : r.rsVsSpy3mo >= 1 ? "text-green-600" : "text-red-500"}`}>
                    {r.rsVsSpy3mo != null ? r.rsVsSpy3mo.toFixed(2) : dash}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => onRemove(r.ticker)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
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
