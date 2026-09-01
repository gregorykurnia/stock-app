"use client";

import { useMemo, useState, type FormEvent } from "react";
import { downloadCsv } from "@/lib/exportCsv";

export interface USSwingStock {
  ticker: string;
  name: string | null;
  industry: string | null;
  starred?: boolean;
}

type SortKey =
  | "ticker" | "industry" | "price" | "atr"
  | "ema20d" | "distEma20d" | "ema50d" | "distEma50d" | "goldenCross"
  | "macd" | "low6mo" | "distLow6mo" | "resistance" | "distResistance" | "daysSinceResistance" | "rsi" | "diPlus" | "diMinus" | "adx" | "shortFloat" | "adv" | "relVolume" | "earnings";
type SortDir = "asc" | "desc";

interface Props {
  stocks: USSwingStock[];
  prices: Record<string, number | null>;
  atrs: Record<string, number | null>;
  ema20s: Record<string, number | null>;
  ema50s: Record<string, number | null>;
  goldenCrossDates?: Record<string, string | null>;
  macds: Record<string, number | null>;
  rsis: Record<string, number | null>;
  diPluses?: Record<string, number | null>;
  diMinuses?: Record<string, number | null>;
  adxs?: Record<string, number | null>;
  low6mos: Record<string, number | null>;
  relVolumes: Record<string, number | null>;
  resistances?: Record<string, number | null>;
  daysSinceResistances?: Record<string, number | null>;
  shortFloats?: Record<string, number | null>;
  advs?: Record<string, number | null>;
  earnings?: Record<string, string | null>;
  loading?: boolean;
  addTicker?: string;
  addLoading?: boolean;
  addError?: string;
  onAddTickerChange?: (v: string) => void;
  onAdd?: (e: FormEvent) => void;
  onRemove?: (ticker: string) => void;
  onToggleStar?: (ticker: string) => void;
}

const dash = <span className="text-gray-400">—</span>;

export default function USSwingTable({
  stocks, prices, atrs, ema20s, ema50s, goldenCrossDates = {}, macds, rsis, diPluses = {}, diMinuses = {}, adxs = {}, low6mos, relVolumes,
  resistances = {}, daysSinceResistances = {}, shortFloats = {}, advs = {}, earnings = {}, loading = false,
  addTicker = "", addLoading = false, addError = "", onAddTickerChange, onAdd, onRemove, onToggleStar,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [starredOnly, setStarredOnly] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "ticker" || key === "industry" ? "asc" : "desc"); }
  }

  const rows = useMemo(() => {
    return stocks.map((s) => {
      const price = prices[s.ticker] ?? null;
      const ema20d = ema20s[s.ticker] ?? null;
      const ema50d = ema50s[s.ticker] ?? null;
      const low6mo = low6mos[s.ticker] ?? null;
      const resistance = resistances[s.ticker] ?? null;
      return {
        ...s,
        price,
        atr: atrs[s.ticker] ?? null,
        ema20d,
        distEma20d: price != null && ema20d != null ? ((price - ema20d) / ema20d) * 100 : null,
        ema50d,
        distEma50d: price != null && ema50d != null ? ((price - ema50d) / ema50d) * 100 : null,
        goldenCrossDate: goldenCrossDates[s.ticker] ?? null,
        macd: macds[s.ticker] ?? null,
        low6mo,
        distLow6mo: price != null && low6mo != null && low6mo > 0 ? ((price - low6mo) / low6mo) * 100 : null,
        resistance,
        distResistance: price != null && resistance != null && resistance > 0 ? ((price - resistance) / resistance) * 100 : null,
        daysSinceResistance: daysSinceResistances[s.ticker] ?? null,
        rsi: rsis[s.ticker] ?? null,
        diPlus: diPluses[s.ticker] ?? null,
        diMinus: diMinuses[s.ticker] ?? null,
        adx: adxs[s.ticker] ?? null,
        relVolume: relVolumes[s.ticker] ?? null,
        shortFloat: shortFloats[s.ticker] ?? null,
        adv: advs[s.ticker] ?? null,
        earnings: earnings[s.ticker] ?? null,
      };
    });
  }, [stocks, prices, atrs, ema20s, ema50s, goldenCrossDates, macds, rsis, diPluses, diMinuses, adxs, low6mos, relVolumes, resistances, daysSinceResistances, shortFloats, advs, earnings]);

  const filteredRows = useMemo(() => {
    return starredOnly ? rows.filter((r) => r.starred) : rows;
  }, [rows, starredOnly]);

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
        case "goldenCross": {
          if (!r.goldenCrossDate) return null;
          const today = new Date().toISOString().slice(0, 10);
          return Math.round((new Date(today + "T00:00:00Z").getTime() - new Date(r.goldenCrossDate + "T00:00:00Z").getTime()) / 86400000);
        }
        case "macd": return r.macd;
        case "low6mo": return r.low6mo;
        case "distLow6mo": return r.distLow6mo;
        case "resistance": return r.resistance;
        case "distResistance": return r.distResistance;
        case "daysSinceResistance": return r.daysSinceResistance;
        case "rsi": return r.rsi;
        case "diPlus": return r.diPlus;
        case "diMinus": return r.diMinus;
        case "adx": return r.adx;
        case "shortFloat": return r.shortFloat;
        case "adv": return r.adv;
        case "relVolume": return r.relVolume;
        case "earnings": {
          if (!r.earnings) return null;
          const today = new Date().toISOString().slice(0, 10);
          return Math.round((new Date(r.earnings + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86400000);
        }
        default: return null;
      }
    };
    const data = [...filteredRows];
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
  }, [filteredRows, sortKey, sortDir]);

  function exportCsv() {
    const date = new Date().toISOString().slice(0, 10);
    const headers = ["Ticker", "Name", "Industry", "Price", "ATR%", "EMA20D", "Dist EMA20D%",
      "EMA50D", "Dist EMA50D%", "Golden Cross", "MACD", "Low (6mo)", "Dist from Low%", "Resistance (1Y)", "Dist from Resistance%", "Days Since Resistance",
      "RSI", "DI+", "DI-", "ADX", "Short Float%", "ADV",
      "Rel Volume", "Earnings Date", "Days to Earnings"];
    const data = sortedRows.map((r) => {
      const daysUntil = r.earnings
        ? Math.round((new Date(r.earnings + "T00:00:00Z").getTime() - new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()) / 86400000)
        : null;
      const goldenCrossDays = r.goldenCrossDate
        ? Math.round((new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime() - new Date(r.goldenCrossDate + "T00:00:00Z").getTime()) / 86400000)
        : null;
      return [
        r.ticker, r.name ?? "", r.industry,
        r.price?.toFixed(2) ?? "", r.atr?.toFixed(1) ?? "",
        r.ema20d?.toFixed(2) ?? "", r.distEma20d?.toFixed(1) ?? "",
        r.ema50d?.toFixed(2) ?? "", r.distEma50d?.toFixed(1) ?? "",
        r.goldenCrossDate ? `${r.goldenCrossDate} (${goldenCrossDays}D)` : "",
        r.macd?.toFixed(2) ?? "", r.low6mo?.toFixed(2) ?? "", r.distLow6mo?.toFixed(1) ?? "",
        r.resistance?.toFixed(2) ?? "", r.distResistance?.toFixed(1) ?? "", r.daysSinceResistance != null ? String(r.daysSinceResistance) : "",
        r.rsi?.toFixed(1) ?? "",
        r.diPlus?.toFixed(1) ?? "",
        r.diMinus?.toFixed(1) ?? "",
        r.adx?.toFixed(1) ?? "",
        r.shortFloat != null ? (r.shortFloat * 100).toFixed(1) : "",
        r.adv != null ? Math.round(r.adv).toLocaleString() : "",
        r.relVolume?.toFixed(2) ?? "",
        r.earnings ?? "", daysUntil != null ? String(daysUntil) : "",
      ];
    });
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

  const adxColor = (v: number | null) =>
    v == null ? "text-gray-400" : v < 20 ? "text-gray-400" : v <= 45 ? "text-green-600 font-semibold" : "text-orange-500 font-semibold";

  const relVolColor = (v: number | null) =>
    v == null ? "text-gray-400" : v >= 1.5 ? "text-green-600 font-semibold" : v <= 0.5 ? "text-gray-400" : "text-gray-700";

  const shortFloatColor = (v: number | null) =>
    v == null ? "text-gray-400" : v >= 0.2 ? "text-red-500 font-semibold" : v >= 0.1 ? "text-yellow-600" : "text-gray-700";

  const fmtAdv = (v: number | null) => {
    if (v == null) return dash;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toFixed(0);
  };

  function EarningsCell({ dateStr }: { dateStr: string | null }) {
    if (!dateStr) return dash;
    const todayStr = new Date().toISOString().slice(0, 10);
    const daysUntil = Math.round((new Date(dateStr + "T00:00:00Z").getTime() - new Date(todayStr + "T00:00:00Z").getTime()) / 86400000);
    const bracket = daysUntil < 0 ? `(reported)` : `(${daysUntil}d)`;
    const color = daysUntil >= 0 && daysUntil <= 7 ? "text-yellow-600 font-semibold" : "text-gray-700";
    return (
      <span className={color}>
        {dateStr} <span className="text-gray-400 font-normal">{bracket}</span>
      </span>
    );
  }

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
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={starredOnly}
            onChange={(e) => setStarredOnly(e.target.checked)}
            className="accent-yellow-500"
          />
          ★ Starred only
        </label>
        <span className="text-xs text-gray-400 ml-auto">{sortedRows.length} of {stocks.length} stocks · daily timeframe · independent from List</span>
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
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">★</th>
              <Th label="Ticker" k="ticker" sticky />
              <Th label="Industry" k="industry" />
              <Th label="Price" k="price" />
              <Th label="ATR%" k="atr" title="Daily ATR% — volatility as % of price" />
              <Th label="EMA20D" k="ema20d" title="EMA20, daily" />
              <Th label="Dist EMA20D" k="distEma20d" title="Price distance from EMA20 daily" />
              <Th label="EMA50D" k="ema50d" title="EMA50, daily" />
              <Th label="Dist EMA50D" k="distEma50d" title="Price distance from EMA50 daily" />
              <Th label="Golden Cross" k="goldenCross" title="Most recent date EMA20D crossed above EMA50D, and days since" />
              <Th label="MACD" k="macd" title="MACD line (12, 26) — daily closes" />
              <Th label="Low (6mo)" k="low6mo" title="Lowest intraday low over the last ~6 months (126 sessions)" />
              <Th label="Dist from Low" k="distLow6mo" title="Price distance from the 6-month low" />
              <Th label="Resistance" k="resistance" title="Highest intraday high over the last ~1 year, excluding the most recent ~32 sessions (~1.5 months) — the last prior ceiling the stock pulled back from" />
              <Th label="Dist from Resistance" k="distResistance" title="Price distance from resistance — negative means below/approaching, positive means already broken above" />
              <Th label="Days Since Resistance" k="daysSinceResistance" title="Trading sessions since the bar that set the resistance high — a stale reading means an old ceiling, a fresh one means it was made just outside the 32-session cooldown" />
              <Th label="RSI" k="rsi" title="RSI(14), daily" />
              <Th label="DI+" k="diPlus" title="+DI(14), daily" />
              <Th label="DI-" k="diMinus" title="-DI(14), daily" />
              <Th label="ADX" k="adx" title="Average Directional Index — trend strength: <20 no trend/choppy, 20-25 emerging, 25-45 trending, >45 overextended" />
              <Th label="Short Float %" k="shortFloat" title="Short interest as a % of the public float" />
              <Th label="ADV" k="adv" title="Average daily volume (3-month)" />
              <Th label="Rel Volume" k="relVolume" title="Latest session volume vs its trailing 20-day average" />
              <Th label="Earnings Date" k="earnings" title="Next/last reported earnings date, with days until in brackets" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRows.length === 0 && (
              <tr><td colSpan={24} className="px-3 py-6 text-center text-gray-400 text-sm">{starredOnly ? "No starred tickers." : "No tickers yet — add one above."}</td></tr>
            )}
            {sortedRows.map((r) => (
              <tr key={r.ticker} className="hover:bg-gray-50">
                <td className="px-2 py-2">
                  <button
                    onClick={() => onToggleStar?.(r.ticker)}
                    aria-label={r.starred ? `Unstar ${r.ticker}` : `Star ${r.ticker}`}
                    className={`text-base leading-none ${r.starred ? "text-yellow-500" : "text-gray-300 hover:text-gray-400"}`}
                  >
                    {r.starred ? "★" : "☆"}
                  </button>
                </td>
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
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                  {r.goldenCrossDate != null ? (
                    <>{r.goldenCrossDate} <span className="text-gray-400">({Math.round((new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime() - new Date(r.goldenCrossDate + "T00:00:00Z").getTime()) / 86400000)}D)</span></>
                  ) : dash}
                </td>
                <td className={`px-3 py-2 font-medium ${distColor(r.macd)}`}>{r.macd != null ? r.macd.toFixed(2) : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.low6mo != null ? `$${r.low6mo.toFixed(2)}` : dash}</td>
                <td className="px-3 py-2 font-medium text-gray-700">{r.distLow6mo != null ? `${r.distLow6mo.toFixed(1)}%` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.resistance != null ? `$${r.resistance.toFixed(2)}` : dash}</td>
                <td className={`px-3 py-2 font-medium ${distColor(r.distResistance)}`}>{r.distResistance != null ? `${r.distResistance.toFixed(1)}%` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.daysSinceResistance != null ? `${r.daysSinceResistance}D` : dash}</td>
                <td className={`px-3 py-2 font-medium ${rsiColor(r.rsi)}`}>{r.rsi != null ? r.rsi.toFixed(1) : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.diPlus != null ? r.diPlus.toFixed(1) : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.diMinus != null ? r.diMinus.toFixed(1) : dash}</td>
                <td className={`px-3 py-2 font-medium ${adxColor(r.adx)}`}>{r.adx != null ? r.adx.toFixed(1) : dash}</td>
                <td className={`px-3 py-2 font-medium ${shortFloatColor(r.shortFloat)}`}>{r.shortFloat != null ? `${(r.shortFloat * 100).toFixed(1)}%` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{fmtAdv(r.adv)}</td>
                <td className={`px-3 py-2 ${relVolColor(r.relVolume)}`}>{r.relVolume != null ? `${r.relVolume.toFixed(2)}x` : dash}</td>
                <td className="px-3 py-2 whitespace-nowrap"><EarningsCell dateStr={r.earnings} /></td>
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
