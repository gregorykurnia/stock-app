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
  | "ticker" | "industry" | "price" | "priceChangePct" | "atr"
  | "ema20d" | "distEma20d" | "ema50d" | "distEma50d" | "goldenCross"
  | "macd" | "roc14" | "roc63" | "roc90" | "low6mo" | "distLow6mo" | "resistance" | "distResistance" | "daysSinceResistance" | "high5yr" | "distHigh5yr" | "daysSinceHigh5yr"
  | "low1yr" | "daysSinceLow1yr" | "distLow1yr" | "cagrLow1yr" | "rsi" | "diPlus" | "diMinus" | "adx" | "shortFloat" | "adv" | "relVolume" | "earnings" | "coiledBase" | "extLongTermMomentum" | "recentBreakout";
type SortDir = "asc" | "desc";

interface Props {
  stocks: USSwingStock[];
  prices: Record<string, number | null>;
  prevCloses?: Record<string, number | null>;
  atrs: Record<string, number | null>;
  ema20s: Record<string, number | null>;
  ema50s: Record<string, number | null>;
  goldenCrossDates?: Record<string, string | null>;
  macds: Record<string, number | null>;
  roc14s?: Record<string, number | null>;
  roc63s?: Record<string, number | null>;
  roc90s?: Record<string, number | null>;
  rsis: Record<string, number | null>;
  diPluses?: Record<string, number | null>;
  diMinuses?: Record<string, number | null>;
  adxs?: Record<string, number | null>;
  low6mos: Record<string, number | null>;
  relVolumes: Record<string, number | null>;
  resistances?: Record<string, number | null>;
  daysSinceResistances?: Record<string, number | null>;
  high5yrs?: Record<string, number | null>;
  distHigh5yrs?: Record<string, number | null>;
  daysSinceHigh5yrs?: Record<string, number | null>;
  low1yrs?: Record<string, number | null>;
  distLow1yrs?: Record<string, number | null>;
  daysSinceLow1yrs?: Record<string, number | null>;
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

// Shared 6-step ramp used across every tiered metric below: gray (neutral/no-signal) → blue (early/building)
// → green (sweet spot) → yellow (caution) → orange (extended) → red (overextended/high-risk).
const DOT: Record<string, string> = {
  gray: "bg-gray-400", blue: "bg-blue-500", green: "bg-green-600",
  yellow: "bg-yellow-500", orange: "bg-orange-500", red: "bg-red-500",
};
const TEXT: Record<string, string> = {
  gray: "text-gray-400", blue: "text-blue-600 font-medium", green: "text-green-600 font-semibold",
  yellow: "text-yellow-600 font-medium", orange: "text-orange-500 font-semibold", red: "text-red-500 font-semibold",
};

interface Tier { max: number; label: string; color: keyof typeof DOT; range: string }

function tierFor(tiers: Tier[], v: number | null): Tier | null {
  if (v == null) return null;
  return tiers.find((t) => v <= t.max) ?? tiers[tiers.length - 1];
}
const cellClass = (tiers: Tier[], v: number | null) => TEXT[tierFor(tiers, v)?.color ?? "gray"];

const TIERS = {
  atr: [
    { max: 1, label: "Very Low", color: "gray", range: "<1%" },
    { max: 2, label: "Low to Moderate", color: "blue", range: "1.01-2%" },
    { max: 4, label: "Moderate", color: "green", range: "2.01-4%" },
    { max: 7, label: "High", color: "yellow", range: "4.01-7%" },
    { max: Infinity, label: "Very High", color: "red", range: ">7%" },
  ] as Tier[],
  ema20d: [
    { max: 3, label: "Healthy", color: "green", range: "0-3%" },
    { max: 7, label: "Strong Trend", color: "blue", range: "3.01-7%" },
    { max: 12, label: "Extended", color: "yellow", range: "7.01-12%" },
    { max: Infinity, label: "Overextended", color: "red", range: ">12.01%" },
  ] as Tier[],
  ema50d: [
    { max: 5, label: "Healthy", color: "green", range: "0-5%" },
    { max: 10, label: "Moderately Extended", color: "blue", range: "5.01-10%" },
    { max: 20, label: "Extended", color: "yellow", range: "10.01-20%" },
    { max: Infinity, label: "Overextended", color: "red", range: ">20.01%" },
  ] as Tier[],
  goldenCross: [
    { max: 15, label: "Very Early, Trend Not Confirmed", color: "gray", range: "0-15d" },
    { max: 45, label: "Trend Establishing, Best Entry", color: "green", range: "16-45d" },
    { max: 90, label: "Mature Trend", color: "blue", range: "46-90d" },
    { max: 180, label: "Late Stage Trend", color: "yellow", range: "91-180d" },
    { max: Infinity, label: "Aged Cross", color: "red", range: ">181d" },
  ] as Tier[],
  roc14: [
    { max: 0, label: "Negative Momentum, Trend Reversing", color: "red", range: "<0%" },
    { max: 1.9, label: "Weak Trend, Low Conviction", color: "gray", range: "0-1.9%" },
    { max: 4.9, label: "Moderate Trend, Good Midterm", color: "blue", range: "2-4.9%" },
    { max: 9.9, label: "Solid Momentum for Swing", color: "green", range: "5-9.9%" },
    { max: Infinity, label: "Strong Momentum, Overextend Check", color: "yellow", range: ">10%" },
  ] as Tier[],
  // Same shape as roc14, thresholds scaled ~sqrt(period/14) for the longer lookback.
  roc63: [
    { max: 0, label: "Negative Momentum, Trend Reversing", color: "red", range: "<0%" },
    { max: 3.9, label: "Weak Trend, Low Conviction", color: "gray", range: "0-3.9%" },
    { max: 10.4, label: "Moderate Trend, Good Midterm", color: "blue", range: "4-10.4%" },
    { max: 20.9, label: "Solid Momentum for Swing", color: "green", range: "10.5-20.9%" },
    { max: Infinity, label: "Strong Momentum, Overextend Check", color: "yellow", range: ">21%" },
  ] as Tier[],
  roc90: [
    { max: 0, label: "Negative Momentum, Trend Reversing", color: "red", range: "<0%" },
    { max: 4.8, label: "Weak Trend, Low Conviction", color: "gray", range: "0-4.8%" },
    { max: 12.4, label: "Moderate Trend, Good Midterm", color: "blue", range: "4.9-12.4%" },
    { max: 25.1, label: "Solid Momentum for Swing", color: "green", range: "12.5-25.1%" },
    { max: Infinity, label: "Strong Momentum, Overextend Check", color: "yellow", range: ">25.1%" },
  ] as Tier[],
  distLow: [
    { max: 5, label: "High Risk, Need Strong Reversal Confirmation", color: "red", range: "0-5%" },
    { max: 15, label: "Early Recovery Zone", color: "yellow", range: "5.01-15%" },
    { max: 30, label: "Mid Recovery Zone, Good Midterm", color: "green", range: "15.01-30%" },
    { max: 50, label: "Strong Recovery Zone", color: "blue", range: "30.01-50%" },
    { max: 100, label: "Extended Recovery Zone", color: "orange", range: "50.01-100%" },
    { max: Infinity, label: "Overextended Breakout", color: "red", range: ">100.01%" },
  ] as Tier[],
  // Tiers below apply to "room to resistance" (how far price sits below resistance); a value already
  // at/above resistance (distResistance >= 0) is a Breakout regardless of these bands.
  distResistance: [
    { max: 4.99, label: "Near Resistance", color: "orange", range: "0-4.99%" },
    { max: 9.99, label: "Close Resistance Room", color: "yellow", range: "5-9.99%" },
    { max: 19.99, label: "Decent Room", color: "blue", range: "10-19.99%" },
    { max: Infinity, label: "Big Growth Room", color: "green", range: ">20%" },
  ] as Tier[],
  rsi: [
    { max: 40, label: "Weak, Oversold", color: "red", range: "<40" },
    { max: 50, label: "Neutral to Weak", color: "orange", range: "40.01-50" },
    { max: 60, label: "Neutral to Strong", color: "blue", range: "50.01-60" },
    { max: 70, label: "Strong", color: "green", range: "60.01-70" },
    { max: 80, label: "Overbought", color: "yellow", range: "70.01-80" },
    { max: Infinity, label: "Way Overbought", color: "red", range: ">80.01" },
  ] as Tier[],
  adx: [
    { max: 15, label: "No Trend", color: "gray", range: "<15" },
    { max: 20, label: "Weak Trend", color: "blue", range: "15.01-20" },
    { max: 25, label: "Building Trend, Good for Midterm", color: "green", range: "20.01-25" },
    { max: 35, label: "Strong Trend, Good for Momentum", color: "green", range: "25.01-35" },
    { max: 50, label: "Very Strong Trend, Maybe Overextended", color: "yellow", range: "35.01-50" },
    { max: Infinity, label: "Parabolic Move", color: "red", range: ">50.01" },
  ] as Tier[],
  shortFloat: [
    { max: 2, label: "Minimal Short Interest, No Skeptic", color: "gray", range: "<2%" },
    { max: 5, label: "Low to Normal, Some Skeptics", color: "blue", range: "2.01-5%" },
    { max: 10, label: "Moderate, Squeeze Possible", color: "green", range: "5.01-10%" },
    { max: 20, label: "Battleground Stock", color: "yellow", range: "10.01-20%" },
    { max: 30, label: "Very High, Heavily Contested", color: "orange", range: "20.01-30%" },
    { max: Infinity, label: "Extreme Short Float", color: "red", range: ">30.01%" },
  ] as Tier[],
} satisfies Record<string, Tier[]>;

function InfoDot({ tiers, breakoutNote }: { tiers: Tier[]; breakoutNote?: string }) {
  return (
    <span className="relative inline-block group/info align-middle ml-1">
      <span
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-400 text-[9px] leading-none text-gray-400 group-hover/info:text-gray-700 group-hover/info:border-gray-700 normal-case font-normal cursor-help"
      >
        i
      </span>
      <span className="invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100 transition-opacity absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 w-64 rounded-md border border-gray-200 bg-white shadow-lg p-2 text-left normal-case font-normal">
        {breakoutNote && (
          <div className="flex items-start gap-1.5 mb-1 pb-1 border-b border-gray-100">
            <span className="mt-0.5 w-2 h-2 rounded-full bg-green-600 shrink-0" />
            <span className="text-[11px] text-gray-700">{breakoutNote}</span>
          </div>
        )}
        {tiers.map((t) => (
          <div key={t.range} className="flex items-start gap-1.5 py-0.5">
            <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${DOT[t.color]}`} />
            <span className="text-[11px] text-gray-700">
              <span className="font-semibold text-gray-900">{t.range}</span> {t.label}
            </span>
          </div>
        ))}
      </span>
    </span>
  );
}

export default function USSwingTable({
  stocks, prices, prevCloses = {}, atrs, ema20s, ema50s, goldenCrossDates = {}, macds, roc14s = {}, roc63s = {}, roc90s = {}, rsis, diPluses = {}, diMinuses = {}, adxs = {}, low6mos, relVolumes,
  resistances = {}, daysSinceResistances = {}, high5yrs = {}, distHigh5yrs = {}, daysSinceHigh5yrs = {},
  low1yrs = {}, distLow1yrs = {}, daysSinceLow1yrs = {}, shortFloats = {}, advs = {}, earnings = {}, loading = false,
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
      const prevClose = prevCloses[s.ticker] ?? null;
      const ema20d = ema20s[s.ticker] ?? null;
      const ema50d = ema50s[s.ticker] ?? null;
      const low6mo = low6mos[s.ticker] ?? null;
      const resistance = resistances[s.ticker] ?? null;
      return {
        ...s,
        price,
        priceChangePct: price != null && prevClose != null && prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : null,
        atr: atrs[s.ticker] ?? null,
        ema20d,
        distEma20d: price != null && ema20d != null ? ((price - ema20d) / ema20d) * 100 : null,
        ema50d,
        distEma50d: price != null && ema50d != null ? ((price - ema50d) / ema50d) * 100 : null,
        goldenCrossDate: goldenCrossDates[s.ticker] ?? null,
        goldenCrossDays: goldenCrossDates[s.ticker]
          ? Math.round((Date.now() - new Date(goldenCrossDates[s.ticker] + "T00:00:00Z").getTime()) / 86400000)
          : null,
        macd: macds[s.ticker] ?? null,
        roc14: roc14s[s.ticker] ?? null,
        roc63: roc63s[s.ticker] ?? null,
        roc90: roc90s[s.ticker] ?? null,
        low6mo,
        distLow6mo: price != null && low6mo != null && low6mo > 0 ? ((price - low6mo) / low6mo) * 100 : null,
        resistance,
        distResistance: price != null && resistance != null && resistance > 0 ? ((price - resistance) / resistance) * 100 : null,
        daysSinceResistance: daysSinceResistances[s.ticker] ?? null,
        high5yr: high5yrs[s.ticker] ?? null,
        distHigh5yr: distHigh5yrs[s.ticker] ?? null,
        daysSinceHigh5yr: daysSinceHigh5yrs[s.ticker] ?? null,
        coiledBase: (() => {
          const d = distHigh5yrs[s.ticker] ?? null;
          const days = daysSinceHigh5yrs[s.ticker] ?? null;
          return d != null && days != null && d >= -15 && d <= 0 && days > 75;
        })(),
        extLongTermMomentum: (() => {
          const daysSinceHigh = daysSinceHigh5yrs[s.ticker] ?? null;
          const daysSinceLow = daysSinceLow1yrs[s.ticker] ?? null;
          const low6moVal = low6mos[s.ticker] ?? null;
          const distLow6moVal = price != null && low6moVal != null && low6moVal > 0 ? ((price - low6moVal) / low6moVal) * 100 : null;
          const roc63 = roc63s[s.ticker] ?? null;
          return (
            daysSinceHigh != null && daysSinceHigh < 15 &&
            daysSinceLow != null && daysSinceLow >= 220 &&
            distLow6moVal != null && distLow6moVal >= 35 && distLow6moVal <= 60 &&
            roc63 != null && roc63 >= 22
          );
        })(),
        recentBreakout: (() => {
          const daysSinceHigh = daysSinceHigh5yrs[s.ticker] ?? null;
          const distResistanceVal = price != null && resistance != null && resistance > 0 ? ((price - resistance) / resistance) * 100 : null;
          const daysSinceRes = daysSinceResistances[s.ticker] ?? null;
          return (
            daysSinceHigh != null && daysSinceHigh < 15 &&
            distResistanceVal != null && distResistanceVal >= -1 && distResistanceVal <= 5 &&
            daysSinceRes != null && daysSinceRes >= 100
          );
        })(),
        low1yr: low1yrs[s.ticker] ?? null,
        distLow1yr: distLow1yrs[s.ticker] ?? null,
        daysSinceLow1yr: daysSinceLow1yrs[s.ticker] ?? null,
        cagrLow1yr: (() => {
          const low = low1yrs[s.ticker] ?? null;
          const days = daysSinceLow1yrs[s.ticker] ?? null;
          if (price == null || low == null || low <= 0 || days == null || days <= 0) return null;
          return (Math.pow(price / low, 365 / days) - 1) * 100;
        })(),
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
  }, [stocks, prices, prevCloses, atrs, ema20s, ema50s, goldenCrossDates, macds, roc14s, roc63s, roc90s, rsis, diPluses, diMinuses, adxs, low6mos, relVolumes, resistances, daysSinceResistances, high5yrs, distHigh5yrs, daysSinceHigh5yrs, low1yrs, distLow1yrs, daysSinceLow1yrs, shortFloats, advs, earnings]);

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
        case "priceChangePct": return r.priceChangePct;
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
        case "roc63": return r.roc63;
        case "roc90": return r.roc90;
        case "low6mo": return r.low6mo;
        case "distLow6mo": return r.distLow6mo;
        case "resistance": return r.resistance;
        case "distResistance": return r.distResistance;
        case "daysSinceResistance": return r.daysSinceResistance;
        case "high5yr": return r.high5yr;
        case "distHigh5yr": return r.distHigh5yr;
        case "daysSinceHigh5yr": return r.daysSinceHigh5yr;
        case "coiledBase": return r.coiledBase ? 1 : 0;
        case "extLongTermMomentum": return r.extLongTermMomentum ? 1 : 0;
        case "recentBreakout": return r.recentBreakout ? 1 : 0;
        case "low1yr": return r.low1yr;
        case "distLow1yr": return r.distLow1yr;
        case "daysSinceLow1yr": return r.daysSinceLow1yr;
        case "cagrLow1yr": return r.cagrLow1yr;
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
    const headers = ["Ticker", "Starred", "Name", "Industry", "Stock Category", "Price", "Price Change%", "ATR%", "EMA20D", "Dist EMA20D%",
      "EMA50D", "Dist EMA50D%", "Golden Cross", "MACD", "ROC14", "ROC63", "ROC90", "Low (6mo)", "Dist from Low%", "Resistance (1Y)", "Dist from Resistance%", "Days Since Resistance",
      "High (2Y)", "Dist from 2Y High%", "Days Since 2Y High",
      "Low (1Y)", "Days Since 1Y Low", "Dist from 1Y Low%", "CAGR from 1Y Low%",
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
        r.ticker, r.starred ? "Yes" : "", r.name ?? "", r.industry,
        [r.coiledBase ? "Limited Upside" : "", r.extLongTermMomentum ? "Extended Long Term Momentum" : "", r.recentBreakout ? "Recent Breakout" : ""].filter(Boolean).join(" / "),
        r.price?.toFixed(2) ?? "", r.priceChangePct != null ? `${r.priceChangePct >= 0 ? "+" : ""}${r.priceChangePct.toFixed(2)}%` : "", r.atr?.toFixed(1) ?? "",
        r.ema20d?.toFixed(2) ?? "", r.distEma20d?.toFixed(1) ?? "",
        r.ema50d?.toFixed(2) ?? "", r.distEma50d?.toFixed(1) ?? "",
        r.goldenCrossDate ? `${r.goldenCrossDate} (${goldenCrossDays}D)` : "",
        r.macd?.toFixed(2) ?? "", r.roc14?.toFixed(1) ?? "", r.roc63?.toFixed(1) ?? "", r.roc90?.toFixed(1) ?? "", r.low6mo?.toFixed(2) ?? "", r.distLow6mo?.toFixed(1) ?? "",
        r.resistance?.toFixed(2) ?? "", r.distResistance?.toFixed(1) ?? "", r.daysSinceResistance != null ? String(r.daysSinceResistance) : "",
        r.high5yr?.toFixed(2) ?? "", r.distHigh5yr?.toFixed(1) ?? "", r.daysSinceHigh5yr != null ? String(r.daysSinceHigh5yr) : "",
        r.low1yr?.toFixed(2) ?? "", r.daysSinceLow1yr != null ? String(r.daysSinceLow1yr) : "", r.distLow1yr?.toFixed(1) ?? "", r.cagrLow1yr?.toFixed(1) ?? "",
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
    const METRIC_TITLES: Record<keyof typeof TIERS, string> = {
      atr: "ATR%", ema20d: "Dist EMA20D%", ema50d: "Dist EMA50D%", goldenCross: "Golden Cross (days since)",
      roc14: "ROC14", roc63: "ROC63", roc90: "ROC90", distLow: "Dist from Low%", distResistance: "Dist from Resistance% (room below resistance)",
      rsi: "RSI", adx: "ADX", shortFloat: "Short Float%",
    };
    const legendRows: (string | number | null)[][] = [
      [], ["Legend", "Range", "Color", "Meaning"],
      ...(Object.keys(TIERS) as (keyof typeof TIERS)[]).flatMap((key): (string | number | null)[][] => {
        const rows = TIERS[key].map((t) => ["", t.range, t.color, t.label]);
        if (key === "distResistance") rows.push(["", "at/above resistance", "green", "Breakout"]);
        return [[METRIC_TITLES[key]], ...rows, []];
      }),
    ];
    downloadCsv(`swing-${date}.csv`, headers, [...data, ...legendRows]);
  }

  const Th = ({ label, k, title, sticky, infoTiers, breakoutNote }: { label: string; k: SortKey; title?: string; sticky?: boolean; infoTiers?: Tier[]; breakoutNote?: string }) => (
    <th
      title={infoTiers ? undefined : title}
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 whitespace-nowrap select-none${sticky ? " sticky left-9 z-20 bg-gray-100 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-300 after:content-['']" : ""}`}
      onClick={() => toggleSort(k)}
    >
      {label}{sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
      {infoTiers && <InfoDot tiers={infoTiers} breakoutNote={breakoutNote} />}
    </th>
  );


  const relVolColor = (v: number | null) =>
    v == null ? "text-gray-400" : v >= 1.5 ? "text-green-600 font-semibold" : v <= 0.5 ? "text-gray-400" : "text-gray-700";

  const distResistanceClass = (v: number | null) => {
    if (v == null) return "text-gray-400";
    if (v >= 0) return "text-green-600 font-semibold";
    return cellClass(TIERS.distResistance, -v);
  };

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
              <th className="w-9 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap sticky left-0 z-20 bg-gray-100">★</th>
              <Th label="Ticker" k="ticker" sticky />
              <Th label="Industry" k="industry" />
              <Th label="Stock Category" k="coiledBase" title="Limited Upside: within 15% below the 5-year high, but it's been more than 75 days since that high was set — sitting quietly under an old ceiling instead of chasing it or falling away from it. Extended Long Term Momentum: made a new 2Y high within the last 15 days, is at least 220 days removed from its 1Y low, is 35-60% above its 6mo low, and has a ROC63 of at least 22%. Recent Breakout: made a new 2Y high within the last 15 days, is between -1% and 5% from its resistance level, and that resistance was set at least 100 days ago" />
              <Th label="Price" k="price" />
              <Th label="Chg %" k="priceChangePct" title="% change vs previous close" />
              <Th label="ATR%" k="atr" infoTiers={TIERS.atr} />
              <Th label="EMA20D" k="ema20d" title="EMA20, daily" />
              <Th label="Dist EMA20D" k="distEma20d" infoTiers={TIERS.ema20d} />
              <Th label="EMA50D" k="ema50d" title="EMA50, daily" />
              <Th label="Dist EMA50D" k="distEma50d" infoTiers={TIERS.ema50d} />
              <Th label="Golden Cross" k="goldenCross" infoTiers={TIERS.goldenCross} />
              <Th label="MACD" k="macd" title="MACD line (12, 26) — daily closes" />
              <Th label="ROC14" k="roc14" infoTiers={TIERS.roc14} />
              <Th label="ROC63" k="roc63" infoTiers={TIERS.roc63} title="Rate of change over the trailing 63 trading sessions (~3mo)" />
              <Th label="ROC90" k="roc90" infoTiers={TIERS.roc90} title="Rate of change over the trailing 90 trading sessions (~4.5mo)" />
              <Th label="Low (6mo)" k="low6mo" title="Lowest intraday low over the last ~6 months (126 sessions)" />
              <Th label="Dist from Low" k="distLow6mo" infoTiers={TIERS.distLow} />
              <Th label="Resistance" k="resistance" title="Highest intraday high over the last ~1 year, excluding the most recent ~32 sessions (~1.5 months) — the last prior ceiling the stock pulled back from" />
              <Th label="Dist from Resistance" k="distResistance" infoTiers={TIERS.distResistance} breakoutNote="Already at/above resistance: Breakout" />
              <Th label="Days Since Resistance" k="daysSinceResistance" title="Trading sessions since the bar that set the resistance high — a stale reading means an old ceiling, a fresh one means it was made just outside the 32-session cooldown" />
              <Th label="2Y High" k="high5yr" title="Highest weekly high over the trailing 2 years" />
              <Th label="Dist from 2Y High" k="distHigh5yr" title="Current price vs the 2-year high, as a %. Negative = below high." />
              <Th label="Days Since 2Y High" k="daysSinceHigh5yr" title="Calendar days since the weekly bar that set the trailing 2-year high" />
              <Th label="1Y Low" k="low1yr" title="Lowest weekly low over the trailing 1 year" />
              <Th label="Days Since 1Y Low" k="daysSinceLow1yr" title="Calendar days since the weekly bar that set the trailing 1-year low" />
              <Th label="Dist from 1Y Low" k="distLow1yr" title="Current price vs the 1-year low, as a %." />
              <Th label="CAGR from 1Y Low" k="cagrLow1yr" title="Annualized return implied by the rally from the 1-year low: ((Price / 1Y Low) ^ (365 / Days Since 1Y Low) - 1) × 100" />
              <Th label="RSI" k="rsi" infoTiers={TIERS.rsi} />
              <Th label="DI+" k="diPlus" title="+DI(14), daily" />
              <Th label="DI-" k="diMinus" title="-DI(14), daily" />
              <Th label="ADX" k="adx" infoTiers={TIERS.adx} />
              <Th label="Short Float %" k="shortFloat" infoTiers={TIERS.shortFloat} />
              <Th label="ADV" k="adv" title="Average daily volume (3-month)" />
              <Th label="Rel Volume" k="relVolume" title="Latest session volume vs its trailing 20-day average" />
              <Th label="Earnings Date" k="earnings" title="Next/last reported earnings date, with days until in brackets" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRows.length === 0 && (
              <tr><td colSpan={34} className="px-3 py-6 text-center text-gray-400 text-sm">{starredOnly ? "No starred tickers." : "No tickers yet — add one above."}</td></tr>
            )}
            {sortedRows.map((r) => (
              <tr key={r.ticker} className="hover:bg-gray-50">
                <td className="w-9 px-2 py-2 sticky left-0 z-10 bg-white">
                  <button
                    onClick={() => onToggleStar?.(r.ticker)}
                    aria-label={r.starred ? `Unstar ${r.ticker}` : `Star ${r.ticker}`}
                    className={`text-base leading-none ${r.starred ? "text-yellow-500" : "text-gray-300 hover:text-gray-400"}`}
                  >
                    {r.starred ? "★" : "☆"}
                  </button>
                </td>
                <td className="px-3 py-2 sticky left-9 z-10 bg-white after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-200 after:content-['']">
                  <div className="font-semibold text-gray-900">{r.ticker}</div>
                  {r.name && <div className="text-xs text-gray-400">{r.name}</div>}
                </td>
                <td className="px-3 py-2 text-gray-600">{r.industry}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1 items-start">
                    {r.coiledBase && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 whitespace-nowrap">
                        Limited Upside
                      </span>
                    )}
                    {r.extLongTermMomentum && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 whitespace-nowrap">
                        Extended Long Term Momentum
                      </span>
                    )}
                    {r.recentBreakout && (
                      <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700 text-xs font-semibold px-2 py-0.5 whitespace-nowrap">
                        Recent Breakout
                      </span>
                    )}
                    {!r.coiledBase && !r.extLongTermMomentum && !r.recentBreakout && dash}
                  </div>
                </td>
                <td className="px-3 py-2 font-medium text-gray-900">{r.price != null ? `$${r.price.toFixed(2)}` : dash}</td>
                <td className={`px-3 py-2 font-medium ${r.priceChangePct == null ? "text-gray-400" : r.priceChangePct >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {r.priceChangePct != null ? `${r.priceChangePct >= 0 ? "+" : ""}${r.priceChangePct.toFixed(2)}%` : dash}
                </td>
                <td className={`px-3 py-2 ${cellClass(TIERS.atr, r.atr)}`}>{r.atr != null ? `${r.atr.toFixed(1)}%` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.ema20d != null ? r.ema20d.toFixed(2) : dash}</td>
                <td className={`px-3 py-2 ${cellClass(TIERS.ema20d, r.distEma20d != null ? Math.abs(r.distEma20d) : null)}`}>{r.distEma20d != null ? `${r.distEma20d.toFixed(1)}%` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.ema50d != null ? r.ema50d.toFixed(2) : dash}</td>
                <td className={`px-3 py-2 ${cellClass(TIERS.ema50d, r.distEma50d != null ? Math.abs(r.distEma50d) : null)}`}>{r.distEma50d != null ? `${r.distEma50d.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 whitespace-nowrap ${cellClass(TIERS.goldenCross, r.goldenCrossDays)}`}>
                  {r.goldenCrossDate != null ? (
                    <>{r.goldenCrossDate} <span className="text-gray-400">({r.goldenCrossDays}D)</span></>
                  ) : dash}
                </td>
                <td className={`px-3 py-2 font-medium ${r.macd == null ? "text-gray-400" : r.macd >= 0 ? "text-green-600" : "text-red-500"}`}>{r.macd != null ? r.macd.toFixed(2) : dash}</td>
                <td className={`px-3 py-2 ${cellClass(TIERS.roc14, r.roc14)}`}>{r.roc14 != null ? `${r.roc14.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 ${cellClass(TIERS.roc63, r.roc63)}`}>{r.roc63 != null ? `${r.roc63.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 ${cellClass(TIERS.roc90, r.roc90)}`}>{r.roc90 != null ? `${r.roc90.toFixed(1)}%` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.low6mo != null ? `$${r.low6mo.toFixed(2)}` : dash}</td>
                <td className={`px-3 py-2 ${cellClass(TIERS.distLow, r.distLow6mo)}`}>{r.distLow6mo != null ? `${r.distLow6mo.toFixed(1)}%` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.resistance != null ? `$${r.resistance.toFixed(2)}` : dash}</td>
                <td className={`px-3 py-2 ${distResistanceClass(r.distResistance)}`}>{r.distResistance != null ? `${r.distResistance.toFixed(1)}%` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.daysSinceResistance != null ? `${r.daysSinceResistance}D` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.high5yr != null ? `$${r.high5yr.toFixed(2)}` : dash}</td>
                <td className={`px-3 py-2 font-medium ${r.distHigh5yr == null ? "text-gray-400" : r.distHigh5yr >= -2 ? "text-green-600 font-semibold" : "text-gray-700"}`}>{r.distHigh5yr != null ? `${r.distHigh5yr.toFixed(1)}%` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.daysSinceHigh5yr != null ? `${r.daysSinceHigh5yr}D` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.low1yr != null ? `$${r.low1yr.toFixed(2)}` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.daysSinceLow1yr != null ? `${r.daysSinceLow1yr}D` : dash}</td>
                <td className="px-3 py-2 font-medium text-gray-700">{r.distLow1yr != null ? `${r.distLow1yr.toFixed(1)}%` : dash}</td>
                <td className="px-3 py-2 font-medium text-gray-700">{r.cagrLow1yr != null ? `${r.cagrLow1yr.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 ${cellClass(TIERS.rsi, r.rsi)}`}>{r.rsi != null ? r.rsi.toFixed(1) : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.diPlus != null ? r.diPlus.toFixed(1) : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.diMinus != null ? r.diMinus.toFixed(1) : dash}</td>
                <td className={`px-3 py-2 ${cellClass(TIERS.adx, r.adx)}`}>{r.adx != null ? r.adx.toFixed(1) : dash}</td>
                <td className={`px-3 py-2 ${cellClass(TIERS.shortFloat, r.shortFloat != null ? r.shortFloat * 100 : null)}`}>{r.shortFloat != null ? `${(r.shortFloat * 100).toFixed(1)}%` : dash}</td>
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
