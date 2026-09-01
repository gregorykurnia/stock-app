"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  | "macd" | "roc14" | "low6mo" | "distLow6mo" | "resistance" | "distResistance" | "daysSinceResistance" | "rsi" | "diPlus" | "diMinus" | "adx" | "shortFloat" | "adv" | "relVolume" | "earnings";
type SortDir = "asc" | "desc";

interface Props {
  stocks: USSwingStock[];
  prices: Record<string, number | null>;
  atrs: Record<string, number | null>;
  ema20s: Record<string, number | null>;
  ema50s: Record<string, number | null>;
  goldenCrossDates?: Record<string, string | null>;
  macds: Record<string, number | null>;
  roc14s?: Record<string, number | null>;
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

const LEGEND = {
  atr: "ATR% — volatility as % of price\n<1%: Very Low\n1.01-2%: Low to Moderate\n2.01-4%: Moderate\n4.01-7%: High\n>7%: Very High",
  ema20d: "Dist EMA20D — price distance from EMA20 daily\n0-3%: Healthy\n3.01-7%: Strong Trend\n7.01-12%: Extended\n>12.01%: Overextended",
  ema50d: "Dist EMA50D — price distance from EMA50 daily\n0-5%: Healthy\n5.01-10%: Moderately Extended\n10.01-20%: Extended\n>20.01%: Overextended",
  goldenCross: "Golden Cross — days since EMA20D crossed above EMA50D\n0-15d: Very Early, Trend Not Confirmed\n16-45d: Trend Establishing, Best Entry\n46-90d: Mature Trend\n91-180d: Late Stage Trend\n>181d: Aged Cross",
  roc14: "ROC14 — % price change over the last 14 daily closes\n>10%: Strong Price Momentum, Overextend Check\n5-9.9%: Solid Momentum for Swing\n2-4.9%: Moderate Trend, Good Midterm\n0-1.9%: Weak Trend, Low Conviction",
  distLow: "Dist from Low — price distance from the 6-month low\n0-5%: High Risk, Need Strong Reversal Confirmation\n5.01-15%: Early Recovery Zone\n15.01-30%: Mid Recovery Zone, Good Midterm\n30.01-50%: Strong Recovery Zone\n50.01-100%: Extended Recovery Zone\n>100.01%: Overextended Breakout",
  distResistance: "Dist from Resistance — price distance from resistance\n>20%: Big Growth Room\n10-19.99%: Decent Room\n5-9.99%: Close Resistance Room\n0-4.99%: Near Resistance\n<0.1% (or above): Breakout",
  adx: "ADX — trend strength\n<15: No Trend\n15.01-20: Weak Trend\n20.01-25: Building Trend, Good for Midterm\n25.01-35: Strong Trend, Good for Momentum\n35.01-50: Very Strong Trend, Maybe Overextended\n>50.01: Parabolic Move",
  shortFloat: "Short Float % — short interest as a % of the public float\n<2%: Minimal Short Interest, No Skeptic\n2.01-5%: Low to Normal, Some Skeptics\n5.01-10%: Moderate, Squeeze Possible\n10.01-20%: Battleground Stock\n20.01-30%: Very High, Heavily Contested\n>30.01%: Extreme Short Float",
};

export default function USSwingTable({
  stocks, prices, atrs, ema20s, ema50s, goldenCrossDates = {}, macds, roc14s = {}, rsis, diPluses = {}, diMinuses = {}, adxs = {}, low6mos, relVolumes,
  resistances = {}, daysSinceResistances = {}, shortFloats = {}, advs = {}, earnings = {}, loading = false,
  addTicker = "", addLoading = false, addError = "", onAddTickerChange, onAdd, onRemove, onToggleStar,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [starredOnly, setStarredOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounce: only apply the search filter/lookup once the user pauses typing for 400ms,
  // rather than re-filtering on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toUpperCase()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const onListTicker = useMemo(() => new Set(stocks.map((s) => s.ticker.toUpperCase())), [stocks]);
  const isOnList = search !== "" && onListTicker.has(search);

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
        roc14: roc14s[s.ticker] ?? null,
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
  }, [stocks, prices, atrs, ema20s, ema50s, goldenCrossDates, macds, roc14s, rsis, diPluses, diMinuses, adxs, low6mos, relVolumes, resistances, daysSinceResistances, shortFloats, advs, earnings]);

  const filteredRows = useMemo(() => {
    let out = starredOnly ? rows.filter((r) => r.starred) : rows;
    if (search) out = out.filter((r) => r.ticker.toUpperCase().includes(search) || r.name?.toUpperCase().includes(search));
    return out;
  }, [rows, starredOnly, search]);

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
        case "roc14": return r.roc14;
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
      "EMA50D", "Dist EMA50D%", "Golden Cross", "MACD", "ROC14", "Low (6mo)", "Dist from Low%", "Resistance (1Y)", "Dist from Resistance%", "Days Since Resistance",
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
        r.macd?.toFixed(2) ?? "", r.roc14?.toFixed(1) ?? "", r.low6mo?.toFixed(2) ?? "", r.distLow6mo?.toFixed(1) ?? "",
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
    const legendRows: (string | number | null)[][] = [
      [], ["Legend"],
      ...Object.values(LEGEND).flatMap((text): (string | number | null)[][] => [...text.split("\n").map((line) => [line]), []]),
    ];
    downloadCsv(`swing-${date}.csv`, headers, [...data, ...legendRows]);
  }

  const Th = ({ label, k, title, sticky, info }: { label: string; k: SortKey; title?: string; sticky?: boolean; info?: boolean }) => (
    <th
      title={info ? undefined : title}
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 whitespace-nowrap select-none${sticky ? " sticky left-0 z-20 bg-gray-100 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-300 after:content-['']" : ""}`}
      onClick={() => toggleSort(k)}
    >
      {label}{sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
      {info && (
        <span
          title={title}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center w-3.5 h-3.5 ml-1 rounded-full border border-gray-400 text-[9px] leading-none text-gray-400 hover:text-gray-700 hover:border-gray-700 normal-case font-normal cursor-help align-middle whitespace-pre-line"
        >
          i
        </span>
      )}
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
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Search ticker or name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 w-48"
          />
          {search && (
            <span className={`text-xs font-medium whitespace-nowrap ${isOnList ? "text-green-600" : "text-gray-400"}`}>
              {isOnList ? `✓ ${search} is on your list` : `${search} not on your list`}
            </span>
          )}
        </div>
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
              <Th label="ATR%" k="atr" title={LEGEND.atr} info />
              <Th label="EMA20D" k="ema20d" title="EMA20, daily" />
              <Th label="Dist EMA20D" k="distEma20d" title={LEGEND.ema20d} info />
              <Th label="EMA50D" k="ema50d" title="EMA50, daily" />
              <Th label="Dist EMA50D" k="distEma50d" title={LEGEND.ema50d} info />
              <Th label="Golden Cross" k="goldenCross" title={LEGEND.goldenCross} info />
              <Th label="MACD" k="macd" title="MACD line (12, 26) — daily closes" />
              <Th label="ROC14" k="roc14" title={LEGEND.roc14} info />
              <Th label="Low (6mo)" k="low6mo" title="Lowest intraday low over the last ~6 months (126 sessions)" />
              <Th label="Dist from Low" k="distLow6mo" title={LEGEND.distLow} info />
              <Th label="Resistance" k="resistance" title="Highest intraday high over the last ~1 year, excluding the most recent ~32 sessions (~1.5 months) — the last prior ceiling the stock pulled back from" />
              <Th label="Dist from Resistance" k="distResistance" title={LEGEND.distResistance} info />
              <Th label="Days Since Resistance" k="daysSinceResistance" title="Trading sessions since the bar that set the resistance high — a stale reading means an old ceiling, a fresh one means it was made just outside the 32-session cooldown" />
              <Th label="RSI" k="rsi" title="RSI(14), daily" />
              <Th label="DI+" k="diPlus" title="+DI(14), daily" />
              <Th label="DI-" k="diMinus" title="-DI(14), daily" />
              <Th label="ADX" k="adx" title={LEGEND.adx} info />
              <Th label="Short Float %" k="shortFloat" title={LEGEND.shortFloat} info />
              <Th label="ADV" k="adv" title="Average daily volume (3-month)" />
              <Th label="Rel Volume" k="relVolume" title="Latest session volume vs its trailing 20-day average" />
              <Th label="Earnings Date" k="earnings" title="Next/last reported earnings date, with days until in brackets" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRows.length === 0 && (
              <tr><td colSpan={25} className="px-3 py-6 text-center text-gray-400 text-sm">{starredOnly ? "No starred tickers." : "No tickers yet — add one above."}</td></tr>
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
                <td className={`px-3 py-2 font-medium ${distColor(r.roc14)}`}>{r.roc14 != null ? `${r.roc14.toFixed(1)}%` : dash}</td>
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
