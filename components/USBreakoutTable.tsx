"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { downloadCsv } from "@/lib/exportCsv";
import { atrLabel } from "@/lib/indicators";

export interface USBreakoutStock {
  ticker: string;
  name: string | null;
  industry: string | null;
  starred?: boolean;
  addedAt?: string | null;
  breakoutType?: "benchmark" | "new";
}

export type BreakoutStatus = "no_divergence" | "watching" | "confirmed" | "failed" | null;

type SortKey =
  | "ticker" | "industry" | "addedAt" | "status" | "breakoutType" | "price" | "swingLow" | "swingLowDate" | "pctAboveLow"
  | "preLowHigh" | "preLowHighDate" | "declineFromHighPct"
  | "rsiCurrent" | "rsiAtLow" | "rsiAnchor" | "rsiAnchorDate" | "rsiAnchorPrice" | "priceDeclinePct" | "rsiDivergencePct" | "rsiBandDepthPct"
  | "histAtAnchor" | "histAtLow" | "histCompression" | "macdHistCurrent"
  | "crossDate" | "crossPrice" | "pctAboveLowAtCross" | "daysLowToCross"
  | "distEma20AtCross" | "distEma50AtCross" | "relVolumeAtCross"
  | "shortFloat" | "adv" | "earnings" | "breakoutScore" | "atrPct";
type SortDir = "asc" | "desc";

interface Props {
  stocks: USBreakoutStock[];
  prices: Record<string, number | null>;
  data: Record<string, {
    swingLow: number | null; swingLowDate: string | null;
    preLowHigh: number | null; preLowHighDate: string | null; declineFromHighPct: number | null;
    rsiAtLow: number | null; rsiAnchor: number | null; rsiAnchorDate: string | null; rsiAnchorPrice: number | null; priceDeclinePct: number | null;
    rsiDivergencePct: number | null; rsiBandDepthPct: number | null;
    histAtAnchor: number | null; histAtLow: number | null; histCompression: number | null;
    crossDate: string | null; crossPrice: number | null; pctAboveLowAtCross: number | null; daysLowToCross: number | null;
    distEma20AtCross: number | null; distEma50AtCross: number | null; relVolumeAtCross: number | null;
    status: BreakoutStatus;
    rsiCurrent: number | null; macdHistCurrent: number | null;
    breakoutScore: number | null;
    atrPct: number | null;
  }>;
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
  onTypeChange?: (ticker: string, breakoutType: "benchmark" | "new") => void;
}

const dash = <span className="text-gray-400">—</span>;

function FilterDropdown<T extends string>({
  label, options, selected, onToggle, describe,
}: {
  label: string;
  options: readonly T[];
  selected: Set<T>;
  onToggle: (key: T) => void;
  describe: (key: T) => { text: string; badgeClass: string; title?: string };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 text-xs cursor-pointer select-none px-2.5 py-1.5 rounded border ${selected.size > 0 ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"}`}
      >
        {label}
        {selected.size > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold leading-none">
            {selected.size}
          </span>
        )}
        <span className="text-gray-400 text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute z-40 top-full left-0 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg p-1.5 space-y-0.5">
          {options.map((key) => {
            const { text, badgeClass, title } = describe(key);
            return (
              <label
                key={key}
                title={title}
                className="flex items-center gap-2 text-xs cursor-pointer select-none px-2 py-1.5 rounded hover:bg-gray-50"
              >
                <input type="checkbox" checked={selected.has(key)} onChange={() => onToggle(key)} className="accent-blue-600" />
                <span className={`inline-flex items-center rounded-full ${badgeClass} text-xs font-semibold px-2 py-0.5 whitespace-nowrap`}>
                  {text}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoDot({ text }: { text: string }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [align, setAlign] = useState<"left" | "right">("left");

  function handleEnter() {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Tooltip is w-64 (256px); flip to right-aligned if there isn't enough room to its right.
    setAlign(window.innerWidth - rect.left < 280 ? "right" : "left");
  }

  return (
    <span ref={wrapRef} onMouseEnter={handleEnter} className="relative inline-block group/info align-middle ml-1">
      <span
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-400 text-[9px] leading-none text-gray-400 group-hover/info:text-gray-700 group-hover/info:border-gray-700 normal-case font-normal cursor-help"
      >
        i
      </span>
      <span className={`invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100 transition-opacity absolute z-50 top-full ${align === "right" ? "right-0" : "left-0"} mt-1 w-64 whitespace-normal rounded-md border border-gray-200 bg-white shadow-lg p-2 text-left normal-case font-normal text-[11px] text-gray-700 leading-snug`}>
        {text}
      </span>
    </span>
  );
}

const TYPE_DEF: Record<"benchmark" | "new", { label: string; badgeClass: string }> = {
  benchmark: { label: "Benchmark", badgeClass: "bg-purple-100 text-purple-700" },
  new: { label: "New", badgeClass: "bg-teal-100 text-teal-700" },
};

const STATUS_DEF: Record<Exclude<BreakoutStatus, null>, { label: string; badgeClass: string; description: string }> = {
  no_divergence: {
    label: "No Divergence", badgeClass: "bg-gray-100 text-gray-500",
    description: "RSI at the swing low was not higher than the lowest pre-low RSI reading — no bullish divergence detected in the trailing window.",
  },
  watching: {
    label: "Watching", badgeClass: "bg-blue-100 text-blue-700",
    description: "Bullish RSI divergence confirmed at the swing low, but MACD hasn't crossed bullish yet and price hasn't broken below the low either — still building.",
  },
  confirmed: {
    label: "Confirmed", badgeClass: "bg-green-100 text-green-700",
    description: "Divergence confirmed and MACD line crossed above signal (histogram flipped positive) without price making a new low first.",
  },
  failed: {
    label: "Failed", badgeClass: "bg-red-100 text-red-700",
    description: "Divergence formed, but price broke below the swing low again before MACD confirmed — the divergence didn't hold.",
  },
};

const rsiClass = (v: number | null) => {
  if (v == null) return "text-gray-400";
  if (v < 30) return "text-red-500 font-semibold";
  if (v < 40) return "text-orange-500 font-medium";
  if (v <= 60) return "text-gray-700";
  if (v <= 70) return "text-blue-600 font-medium";
  return "text-yellow-600 font-semibold";
};

const divergenceClass = (v: number | null) =>
  v == null ? "text-gray-400"
    : v <= 0 ? "text-red-500 font-medium"
    : v < 20 ? "text-gray-500"
    : v < 40 ? "text-blue-600 font-medium"
    : "text-green-600 font-semibold";

const compressionClass = (v: number | null) =>
  v == null ? "text-gray-400"
    : v <= 0 ? "text-red-500 font-medium"
    : v < 0.5 ? "text-gray-500"
    : v < 1 ? "text-blue-600 font-medium"
    : "text-green-600 font-semibold";

const priceDeclineClass = (v: number | null) =>
  v == null ? "text-gray-400"
    : v >= 0 ? "text-gray-500"
    : v >= -10 ? "text-blue-600 font-medium"
    : v >= -25 ? "text-orange-500 font-medium"
    : "text-red-500 font-semibold";

const bandDepthClass = (v: number | null) =>
  v == null ? "text-gray-400"
    : v >= 40 ? "text-green-600 font-semibold"
    : v >= 15 ? "text-blue-600 font-medium"
    : v >= 0 ? "text-gray-500"
    : "text-gray-400";

const histClass = (v: number | null) =>
  v == null ? "text-gray-400" : v >= 0 ? "text-green-600 font-medium" : "text-red-500 font-medium";

const pctAboveLowClass = (v: number | null) =>
  v == null ? "text-gray-400"
    : v <= 10 ? "text-green-600 font-semibold"
    : v <= 20 ? "text-blue-600 font-medium"
    : v <= 35 ? "text-yellow-600 font-medium"
    : "text-orange-500 font-semibold";

const distEmaClass = (v: number | null) =>
  v == null ? "text-gray-400"
    : Math.abs(v) <= 3 ? "text-green-600 font-medium"
    : Math.abs(v) <= 7 ? "text-blue-600"
    : "text-yellow-600";

const relVolClass = (v: number | null) =>
  v == null ? "text-gray-400" : v >= 1.5 ? "text-green-600 font-semibold" : v <= 0.7 ? "text-gray-400" : "text-gray-700";

const shortFloatColor = (v: number | null) =>
  v == null ? "text-gray-400" : v >= 0.2 ? "text-red-500 font-semibold" : v >= 0.1 ? "text-yellow-600" : "text-gray-700";

const daysToConfirmClass = (v: number | null) =>
  v == null ? "text-gray-400" : v <= 10 ? "text-green-600 font-medium" : v <= 25 ? "text-blue-600" : "text-gray-700";

const breakoutScoreClass = (v: number | null) =>
  v == null ? "text-gray-400"
    : v >= 8 ? "text-green-600 font-bold"
    : v >= 6.5 ? "text-blue-600 font-semibold"
    : v >= 5 ? "text-yellow-600 font-medium"
    : "text-red-500 font-semibold";

function fmtAdv(v: number | null) {
  if (v == null) return dash;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

export function daysUntilEarnings(earningsDate: string | null): number | null {
  if (!earningsDate) return null;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(earningsDate + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86400000);
}

function EarningsCell({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <>{dash}</>;
  const daysUntil = daysUntilEarnings(dateStr);
  const bracket = daysUntil == null ? "" : daysUntil < 0 ? `(reported)` : `(${daysUntil}d)`;
  const color = daysUntil != null && daysUntil >= 0 && daysUntil <= 14 ? "text-yellow-600 font-semibold" : "text-gray-700";
  return (
    <span className={color}>
      {dateStr} <span className="text-gray-400 font-normal">{bracket}</span>
    </span>
  );
}

export default function USBreakoutTable({
  stocks, prices, data, shortFloats = {}, advs = {}, earnings = {}, loading = false,
  addTicker = "", addLoading = false, addError = "", onAddTickerChange, onAdd, onRemove, onToggleStar, onTypeChange,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [starredOnly, setStarredOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<Exclude<BreakoutStatus, null>>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<"benchmark" | "new">>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

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

  function toggleStatusFilter(key: Exclude<BreakoutStatus, null>) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleTypeFilter(key: "benchmark" | "new") {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const rows = useMemo(() => {
    return stocks.map((s) => {
      const d = data[s.ticker];
      const price = prices[s.ticker] ?? null;
      const pctAboveLow = price != null && d?.swingLow != null && d.swingLow > 0 ? ((price - d.swingLow) / d.swingLow) * 100 : null;
      const earningsDate = earnings[s.ticker] ?? null;
      return {
        ...s,
        price,
        swingLow: d?.swingLow ?? null,
        swingLowDate: d?.swingLowDate ?? null,
        preLowHigh: d?.preLowHigh ?? null,
        preLowHighDate: d?.preLowHighDate ?? null,
        declineFromHighPct: d?.declineFromHighPct ?? null,
        pctAboveLow,
        rsiCurrent: d?.rsiCurrent ?? null,
        rsiAtLow: d?.rsiAtLow ?? null,
        rsiAnchorPrice: d?.rsiAnchorPrice ?? null,
        priceDeclinePct: d?.priceDeclinePct ?? null,
        rsiAnchor: d?.rsiAnchor ?? null,
        rsiAnchorDate: d?.rsiAnchorDate ?? null,
        rsiDivergencePct: d?.rsiDivergencePct ?? null,
        rsiBandDepthPct: d?.rsiBandDepthPct ?? null,
        histAtAnchor: d?.histAtAnchor ?? null,
        histAtLow: d?.histAtLow ?? null,
        histCompression: d?.histCompression ?? null,
        macdHistCurrent: d?.macdHistCurrent ?? null,
        crossDate: d?.crossDate ?? null,
        crossPrice: d?.crossPrice ?? null,
        pctAboveLowAtCross: d?.pctAboveLowAtCross ?? null,
        daysLowToCross: d?.daysLowToCross ?? null,
        distEma20AtCross: d?.distEma20AtCross ?? null,
        distEma50AtCross: d?.distEma50AtCross ?? null,
        relVolumeAtCross: d?.relVolumeAtCross ?? null,
        status: d?.status ?? null,
        breakoutScore: d?.breakoutScore ?? null,
        atrPct: d?.atrPct ?? null,
        shortFloat: shortFloats[s.ticker] ?? null,
        adv: advs[s.ticker] ?? null,
        earnings: earningsDate,
        earningsDaysUntil: daysUntilEarnings(earningsDate),
      };
    });
  }, [stocks, prices, data, shortFloats, advs, earnings]);

  const filteredRows = useMemo(() => {
    let out = starredOnly ? rows.filter((r) => r.starred) : rows;
    if (search) out = out.filter((r) => r.ticker.toUpperCase().includes(search) || r.name?.toUpperCase().includes(search));
    if (statusFilter.size > 0) out = out.filter((r) => r.status != null && statusFilter.has(r.status));
    if (typeFilter.size > 0) out = out.filter((r) => r.breakoutType != null && typeFilter.has(r.breakoutType));
    return out;
  }, [rows, starredOnly, search, statusFilter, typeFilter]);

  const STATUS_RANK: Record<string, number> = { confirmed: 3, watching: 2, failed: 1, no_divergence: 0 };

  const sortedRows = useMemo(() => {
    const getVal = (r: (typeof rows)[number]): number | string | null => {
      switch (sortKey) {
        case "ticker": return r.ticker;
        case "industry": return r.industry;
        case "addedAt": return r.addedAt ?? null;
        case "status": return r.status != null ? STATUS_RANK[r.status] : -1;
        case "breakoutType": return r.breakoutType ?? null;
        case "price": return r.price;
        case "swingLow": return r.swingLow;
        case "swingLowDate": return r.swingLowDate;
        case "preLowHigh": return r.preLowHigh;
        case "preLowHighDate": return r.preLowHighDate;
        case "declineFromHighPct": return r.declineFromHighPct;
        case "pctAboveLow": return r.pctAboveLow;
        case "rsiCurrent": return r.rsiCurrent;
        case "rsiAtLow": return r.rsiAtLow;
        case "rsiAnchor": return r.rsiAnchor;
        case "rsiAnchorDate": return r.rsiAnchorDate;
        case "rsiAnchorPrice": return r.rsiAnchorPrice;
        case "priceDeclinePct": return r.priceDeclinePct;
        case "rsiDivergencePct": return r.rsiDivergencePct;
        case "rsiBandDepthPct": return r.rsiBandDepthPct;
        case "histAtAnchor": return r.histAtAnchor;
        case "histAtLow": return r.histAtLow;
        case "histCompression": return r.histCompression;
        case "macdHistCurrent": return r.macdHistCurrent;
        case "crossDate": return r.crossDate;
        case "crossPrice": return r.crossPrice;
        case "pctAboveLowAtCross": return r.pctAboveLowAtCross;
        case "daysLowToCross": return r.daysLowToCross;
        case "distEma20AtCross": return r.distEma20AtCross;
        case "distEma50AtCross": return r.distEma50AtCross;
        case "relVolumeAtCross": return r.relVolumeAtCross;
        case "shortFloat": return r.shortFloat;
        case "adv": return r.adv;
        case "earnings": return r.earningsDaysUntil;
        case "breakoutScore": return r.breakoutScore;
        case "atrPct": return r.atrPct;
        default: return null;
      }
    };
    const dataRows = [...filteredRows];
    dataRows.sort((a, b) => {
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
    return dataRows;
  }, [filteredRows, sortKey, sortDir]);

  function exportCsv() {
    const date = new Date().toISOString().slice(0, 10);
    const headers = [
      "Ticker", "Industry", "Added", "Status", "Type", "Price",
      "Swing Low", "Swing Low Date", "Pre-Low High", "Pre-Low High Date", "% Decline From High", "% Above Low",
      "RSI (Now)", "RSI at Low", "Lowest RSI (Pre-Low)", "Anchor Date", "Price at Anchor", "% Decline (Anchor→Low)",
      "RSI Divergence %", "RSI Band Depth %",
      "Hist @ Anchor", "Hist @ Low", "Hist Compression", "MACD Hist (Now)",
      "MACD Cross Date", "Price @ Cross", "% Above Low @ Cross", "Days Low→Cross",
      "Dist EMA20D @ Cross", "Dist EMA50D @ Cross", "Rel Vol @ Cross",
      "Short Float %", "ADV", "ATR%", "Earnings Date", "Breakout Score",
    ];
    const data = sortedRows.map((r) => [
      r.ticker,
      r.industry ?? "",
      r.addedAt ? r.addedAt.slice(0, 10) : "",
      r.status != null ? STATUS_DEF[r.status].label : "",
      r.breakoutType != null ? TYPE_DEF[r.breakoutType].label : "",
      r.price?.toFixed(2) ?? "",
      r.swingLow?.toFixed(2) ?? "",
      r.swingLowDate ?? "",
      r.preLowHigh?.toFixed(2) ?? "",
      r.preLowHighDate ?? "",
      r.declineFromHighPct?.toFixed(1) ?? "",
      r.pctAboveLow?.toFixed(1) ?? "",
      r.rsiCurrent?.toFixed(1) ?? "",
      r.rsiAtLow?.toFixed(1) ?? "",
      r.rsiAnchor?.toFixed(1) ?? "",
      r.rsiAnchorDate ?? "",
      r.rsiAnchorPrice?.toFixed(2) ?? "",
      r.priceDeclinePct?.toFixed(1) ?? "",
      r.rsiDivergencePct?.toFixed(1) ?? "",
      r.rsiBandDepthPct?.toFixed(1) ?? "",
      r.histAtAnchor?.toFixed(3) ?? "",
      r.histAtLow?.toFixed(3) ?? "",
      r.histCompression?.toFixed(3) ?? "",
      r.macdHistCurrent?.toFixed(3) ?? "",
      r.crossDate ?? "",
      r.crossPrice?.toFixed(2) ?? "",
      r.pctAboveLowAtCross?.toFixed(1) ?? "",
      r.daysLowToCross ?? "",
      r.distEma20AtCross?.toFixed(1) ?? "",
      r.distEma50AtCross?.toFixed(1) ?? "",
      r.relVolumeAtCross?.toFixed(2) ?? "",
      r.shortFloat?.toFixed(1) ?? "",
      r.adv?.toFixed(0) ?? "",
      r.atrPct?.toFixed(1) ?? "",
      r.earnings ?? "",
      r.breakoutScore?.toFixed(2) ?? "",
    ]);
    downloadCsv(`us-breakout-${date}.csv`, headers, data);
  }

  const Th = ({ label, k, info, sticky }: { label: string; k: SortKey; info?: string; sticky?: boolean }) => (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap select-none${sticky ? " sticky left-9 z-20 bg-gray-100 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-300 after:content-['']" : ""}`}
    >
      <span className="cursor-pointer hover:text-gray-900" onClick={() => toggleSort(k)}>
        {label}{sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
      </span>
      {info && <InfoDot text={info} />}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="surface-card p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={onAdd} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. TEAM"
              value={addTicker}
              onChange={(e) => onAddTickerChange?.(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="input-field w-28 uppercase"
            />
            <button type="submit" disabled={addLoading} className="btn btn-primary text-sm px-3 py-1.5">
              {addLoading ? "Adding…" : "+ Add"}
            </button>
          </form>
          {addError && <span className="text-xs text-red-500">{addError}</span>}

          <div className="w-px self-stretch bg-gray-200" />

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
              className="input-field w-48"
            />
            {search && (
              <span className={`text-xs font-medium whitespace-nowrap ${isOnList ? "text-green-600" : "text-gray-400"}`}>
                {isOnList ? `✓ ${search} is on your list` : `${search} not on your list`}
              </span>
            )}
          </div>
          {loading && <span className="text-xs text-gray-400 animate-pulse">Loading divergence data…</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStarredOnly((v) => !v)}
            title="Starred only"
            className={`flex items-center gap-1 text-xs cursor-pointer select-none px-2.5 py-1.5 rounded border ${starredOnly ? "border-yellow-400 bg-yellow-50 text-yellow-700" : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"}`}
          >
            ★ Starred
          </button>
          <FilterDropdown
            label="Status"
            options={Object.keys(STATUS_DEF) as (Exclude<BreakoutStatus, null>)[]}
            selected={statusFilter}
            onToggle={toggleStatusFilter}
            describe={(key) => ({ text: STATUS_DEF[key].label, badgeClass: STATUS_DEF[key].badgeClass, title: STATUS_DEF[key].description })}
          />
          <FilterDropdown
            label="Type"
            options={Object.keys(TYPE_DEF) as ("benchmark" | "new")[]}
            selected={typeFilter}
            onToggle={toggleTypeFilter}
            describe={(key) => ({ text: TYPE_DEF[key].label, badgeClass: TYPE_DEF[key].badgeClass })}
          />
          {stocks.length > 0 && (
            <button
              onClick={exportCsv}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-xs font-semibold"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>
      <div className="text-xs text-gray-400 text-right -mt-1">
        {sortedRows.length} of {stocks.length} stocks · daily timeframe · RSI/MACD divergence off a swing low
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-[72vh] rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-30">
            <tr className="border-b border-gray-200">
              <th colSpan={2} className="px-2 py-1 sticky left-0 z-20 bg-gray-100" />
              <th colSpan={10} className="px-3 py-1 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap border-l border-gray-300 bg-gray-50/70">Overview</th>
              <th colSpan={9} className="px-3 py-1 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap border-l border-gray-300 bg-gray-50/70">RSI / MACD Divergence</th>
              <th colSpan={7} className="px-3 py-1 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap border-l border-gray-300 bg-gray-50/70">Confirmation (MACD Cross)</th>
              <th colSpan={4} className="px-3 py-1 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap border-l border-gray-300 bg-gray-50/70">Risk</th>
              <th className="px-3 py-1 border-l border-gray-300 bg-gray-50/70" />
            </tr>
            <tr>
              <th className="w-9 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap sticky left-0 z-20 bg-gray-100">★</th>
              <Th label="Ticker" k="ticker" sticky info="Stock symbol." />
              <Th label="Industry" k="industry" info="Sector/industry classification." />
              <Th label="Added" k="addedAt" info="Date this ticker was added to your Breakout watchlist." />
              <Th label="Status" k="status" info="Divergence lifecycle: No Divergence (RSI at the low wasn't higher than the pre-low anchor) → Watching (divergence confirmed, MACD hasn't crossed bullish yet, price hasn't broken the low either) → Confirmed (MACD crossed above signal without price making a new low first) → Failed (price broke below the swing low before MACD confirmed)." />
              <Th label="Type" k="breakoutType" info="Manual classification tag — Benchmark or New. Filterable via the toggles above the table." />
              <Th label="Breakout Score" k="breakoutScore" info="0-10 composite scored against the benchmark pattern: RSI divergence strength (22%), RSI band depth / how oversold the anchor was (18%), MACD histogram compression into the low (22%, penalized hard if still negative), % decline from pre-low high (12%, full credit at -70% or deeper), days from low to MACD cross (9%), % above low at cross (9%), distance from EMA50D at cross (4%), relative volume at cross (4%). Null until divergence is at least confirmed (Watching/Confirmed/Failed). A rough heuristic, not a guarantee — always sanity-check the underlying columns." />
              <Th label="Price" k="price" info="Latest close." />
              <Th label="Swing Low" k="swingLow" info="Lowest daily close in the trailing 20-month window — the anchor point for the whole divergence read." />
              <Th label="Swing Low Date" k="swingLowDate" info="Date the swing low was set." />
              <Th label="Pre-Low High" k="preLowHigh" info="Highest close anywhere in the fetched window (up to 20 months) before the swing low — the peak the stock fell from. Not a strict calendar 2Y high, just the pre-low high within the window." />
              <Th label="Pre-Low High Date" k="preLowHighDate" info="Date the pre-low high was set." />
              <Th label="% Decline From High" k="declineFromHighPct" info="(swing low − pre-low high) / pre-low high × 100. How many % beaten down the stock was at its lowest point, measured from its pre-low high — a quick read on how violent the drawdown was before the reversal." />
              <Th label="% Above Low" k="pctAboveLow" info="Current price vs the swing low: (price − swing low) / swing low. Shows how far past the low you'd already be paying if entering now." />
              <Th label="RSI (Now)" k="rsiCurrent" info="Current RSI(14), daily." />
              <Th label="RSI at Low" k="rsiAtLow" info="RSI(14) reading on the swing low date — one half of the divergence comparison." />
              <Th label="Lowest RSI (Pre-Low)" k="rsiAnchor" info="The lowest RSI(14) value anywhere before the swing low — the divergence anchor, i.e. the 'more oversold' earlier extreme." />
              <Th label="Anchor Date" k="rsiAnchorDate" info="Date the RSI anchor (lowest pre-low RSI) occurred." />
              <Th label="Price at Anchor" k="rsiAnchorPrice" info="Close price on the RSI-anchor date — the price level where the divergence anchor occurred." />
              <Th label="% Decline (Anchor→Low)" k="priceDeclinePct" info="(swing low − price at anchor) / price at anchor × 100. Shows how much price kept falling while RSI diverged — e.g. TEAM -17.0% price decline while RSI rose +63%. The bigger (more negative) this is alongside a strong RSI Divergence %, the more concrete the divergence story." />
              <Th label="RSI Divergence %" k="rsiDivergencePct" info="(RSI at low − RSI anchor) / RSI anchor × 100. Positive = price made a lower low but RSI made a higher low (bullish divergence). Higher % = stronger divergence, e.g. TEAM +63%, WDAY +59.6%." />
              <Th label="RSI Band Depth %" k="rsiBandDepthPct" info="How far below the standard 30 oversold line the anchor RSI was: (30 − anchor)/30 × 100. Shows how extreme the original oversold read was." />
              <Th label="Hist @ Anchor" k="histAtAnchor" info="MACD histogram value on the RSI-anchor date — the starting bearish-momentum reading (red bar)." />
              <Th label="Hist @ Low" k="histAtLow" info="MACD histogram value on the swing-low date." />
              <Th label="Hist Compression" k="histCompression" info="Hist@Low − Hist@Anchor. Positive = the histogram shrank toward zero (momentum decelerating) even as price fell further into the low — the MACD-side confirmation of the RSI divergence. TEAM +1.07, WDAY +0.30." />
              <Th label="MACD Hist (Now)" k="macdHistCurrent" info="Current MACD histogram value (MACD line minus signal line). Negative = red bar, positive = green bar." />
              <Th label="MACD Cross Date" k="crossDate" info="First date after the swing low where the MACD line crossed above the signal line (histogram flips from negative to positive) — the confirmation trigger, not the low itself." />
              <Th label="Price @ Cross" k="crossPrice" info="Close price on the MACD cross date — the realistic entry price if you wait for confirmation instead of guessing the low." />
              <Th label="% Above Low @ Cross" k="pctAboveLowAtCross" info="(cross price − swing low) / swing low × 100. The cost of waiting for confirmation vs buying right at the low." />
              <Th label="Days Low→Cross" k="daysLowToCross" info="Trading days between the swing low and the MACD cross — how fast the reversal confirmed." />
              <Th label="Dist EMA20D @ Cross" k="distEma20AtCross" info="Price vs EMA20(daily) on the cross date. Near zero = cross happened right at the short-term trend line; far above = price had already run before confirming." />
              <Th label="Dist EMA50D @ Cross" k="distEma50AtCross" info="Price vs EMA50(daily) on the cross date — same idea, medium-term trend line." />
              <Th label="Rel Vol @ Cross" k="relVolumeAtCross" info="Volume on the MACD cross date vs its trailing 20-day average. A cross on a volume surge (≥1.5x) is stronger evidence than one on light volume." />
              <Th label="Short Float %" k="shortFloat" info="% of float sold short. High values mean a more contested/battleground name." />
              <Th label="ADV" k="adv" info="Average daily volume (3-month) — liquidity check." />
              <Th label="ATR%" k="atrPct" info="Average True Range (14, daily) as a % of price. Measures how choppy/erratic the stock's daily range is — matters for stop placement and position sizing on a fresh breakout entry. Very Low &lt;2%, Low-Mod 2-4%, Mod-High 4-7%, High 7-10%, Extreme 10%+." />
              <Th label="Earnings Date" k="earnings" info="Next/last reported earnings date, with days until in brackets. Within 14 days is a proximity risk flag." />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRows.length === 0 && (
              <tr><td colSpan={37} className="px-3 py-6 text-center text-gray-400 text-sm">{starredOnly ? "No starred tickers." : "No tickers yet — add one above."}</td></tr>
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
                  <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                    {r.ticker}
                    {r.addedAt && (Date.now() - new Date(r.addedAt).getTime()) / 86400000 <= 7 && (
                      <span title={`Added ${r.addedAt.slice(0, 10)}`} className="inline-flex items-center rounded-full bg-green-100 text-green-700 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
                        NEW
                      </span>
                    )}
                  </div>
                  {r.name && <div className="text-xs text-gray-400">{r.name}</div>}
                </td>
                <td className="px-3 py-2 text-gray-600">{r.industry}</td>
                <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{r.addedAt ? r.addedAt.slice(0, 10) : dash}</td>
                <td className="px-3 py-2">
                  {r.status != null ? (
                    <span title={STATUS_DEF[r.status].description} className={`inline-flex items-center rounded-full ${STATUS_DEF[r.status].badgeClass} text-xs font-semibold px-2 py-0.5 whitespace-nowrap cursor-help`}>
                      {STATUS_DEF[r.status].label}
                    </span>
                  ) : dash}
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={r.breakoutType ?? ""}
                    onChange={(e) => onTypeChange?.(r.ticker, e.target.value as "benchmark" | "new")}
                    className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white text-gray-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="" disabled>—</option>
                    <option value="benchmark">Benchmark</option>
                    <option value="new">New</option>
                  </select>
                </td>
                <td className={`px-3 py-2 ${breakoutScoreClass(r.breakoutScore)}`}>{r.breakoutScore != null ? r.breakoutScore.toFixed(1) : dash}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{r.price != null ? `$${r.price.toFixed(2)}` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.swingLow != null ? `$${r.swingLow.toFixed(2)}` : dash}</td>
                <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{r.swingLowDate ?? dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.preLowHigh != null ? `$${r.preLowHigh.toFixed(2)}` : dash}</td>
                <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{r.preLowHighDate ?? dash}</td>
                <td className={`px-3 py-2 ${priceDeclineClass(r.declineFromHighPct)}`}>{r.declineFromHighPct != null ? `${r.declineFromHighPct.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 ${pctAboveLowClass(r.pctAboveLow)}`}>{r.pctAboveLow != null ? `${r.pctAboveLow.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 ${rsiClass(r.rsiCurrent)}`}>{r.rsiCurrent != null ? r.rsiCurrent.toFixed(1) : dash}</td>
                <td className={`px-3 py-2 ${rsiClass(r.rsiAtLow)}`}>{r.rsiAtLow != null ? r.rsiAtLow.toFixed(1) : dash}</td>
                <td className={`px-3 py-2 ${rsiClass(r.rsiAnchor)}`}>{r.rsiAnchor != null ? r.rsiAnchor.toFixed(1) : dash}</td>
                <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{r.rsiAnchorDate ?? dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.rsiAnchorPrice != null ? `$${r.rsiAnchorPrice.toFixed(2)}` : dash}</td>
                <td className={`px-3 py-2 ${priceDeclineClass(r.priceDeclinePct)}`}>{r.priceDeclinePct != null ? `${r.priceDeclinePct >= 0 ? "+" : ""}${r.priceDeclinePct.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 ${divergenceClass(r.rsiDivergencePct)}`}>{r.rsiDivergencePct != null ? `${r.rsiDivergencePct >= 0 ? "+" : ""}${r.rsiDivergencePct.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 ${bandDepthClass(r.rsiBandDepthPct)}`}>{r.rsiBandDepthPct != null ? `${r.rsiBandDepthPct.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 ${histClass(r.histAtAnchor)}`}>{r.histAtAnchor != null ? r.histAtAnchor.toFixed(2) : dash}</td>
                <td className={`px-3 py-2 ${histClass(r.histAtLow)}`}>{r.histAtLow != null ? r.histAtLow.toFixed(2) : dash}</td>
                <td className={`px-3 py-2 ${compressionClass(r.histCompression)}`}>{r.histCompression != null ? `${r.histCompression >= 0 ? "+" : ""}${r.histCompression.toFixed(2)}` : dash}</td>
                <td className={`px-3 py-2 ${histClass(r.macdHistCurrent)}`}>{r.macdHistCurrent != null ? r.macdHistCurrent.toFixed(2) : dash}</td>
                <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{r.crossDate ?? dash}</td>
                <td className="px-3 py-2 text-gray-700">{r.crossPrice != null ? `$${r.crossPrice.toFixed(2)}` : dash}</td>
                <td className={`px-3 py-2 ${pctAboveLowClass(r.pctAboveLowAtCross)}`}>{r.pctAboveLowAtCross != null ? `${r.pctAboveLowAtCross.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 ${daysToConfirmClass(r.daysLowToCross)}`}>{r.daysLowToCross != null ? `${r.daysLowToCross}D` : dash}</td>
                <td className={`px-3 py-2 ${distEmaClass(r.distEma20AtCross)}`}>{r.distEma20AtCross != null ? `${r.distEma20AtCross.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 ${distEmaClass(r.distEma50AtCross)}`}>{r.distEma50AtCross != null ? `${r.distEma50AtCross.toFixed(1)}%` : dash}</td>
                <td className={`px-3 py-2 ${relVolClass(r.relVolumeAtCross)}`}>{r.relVolumeAtCross != null ? `${r.relVolumeAtCross.toFixed(2)}x` : dash}</td>
                <td className={`px-3 py-2 ${shortFloatColor(r.shortFloat != null ? r.shortFloat : null)}`}>{r.shortFloat != null ? `${(r.shortFloat * 100).toFixed(1)}%` : dash}</td>
                <td className="px-3 py-2 text-gray-700">{fmtAdv(r.adv)}</td>
                <td className="px-3 py-2">
                  {r.atrPct != null ? (
                    <span className={atrLabel(r.atrPct).color} title={atrLabel(r.atrPct).description}>
                      {r.atrPct.toFixed(1)}%
                    </span>
                  ) : dash}
                </td>
                <td className="px-3 py-2 whitespace-nowrap"><EarningsCell dateStr={r.earnings} /></td>
                <td className="px-3 py-2">
                  <button onClick={() => onRemove?.(r.ticker)} className="text-xs text-red-500 hover:text-red-700">
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
