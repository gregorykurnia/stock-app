"use client";

import { useEffect, useMemo, useState } from "react";
import { classifyRegimes, type RegimeCard } from "@/lib/markets/regime";
import { buildCrossMarketSignals } from "@/lib/markets/signals";
import { INSTRUMENT_BY_ID, KEY_MARKET_IDS, MARKET_SECTIONS, instrumentsForSection } from "@/lib/markets/instruments";
import { formatBp, formatLatest, formatPct, formatSigned, formatTimestampET, trendArrow, trendLabel, usMarketSession } from "@/lib/markets/format";
import type { MarketInstrument, MarketsSnapshotResponse, RegimeState } from "@/lib/markets/types";
import MarketDetailPanel from "./MarketDetailPanel";
import MarketSparkline from "./MarketSparkline";
import MarketTable from "./MarketTable";

const STATE_STYLE: Record<RegimeState, string> = {
  "strong-positive": "border-green-200 bg-green-50 text-green-800",
  positive: "border-green-200 bg-green-50 text-green-800",
  neutral: "border-gray-200 bg-gray-50 text-gray-700",
  negative: "border-amber-200 bg-amber-50 text-amber-800",
  "strong-negative": "border-red-200 bg-red-50 text-red-800",
  unavailable: "border-gray-200 bg-gray-50 text-gray-500",
};

function RegimeSummary({ card }: { card: RegimeCard }) {
  return (
    <article className="surface-card p-4">
      <div className="flex items-start justify-between gap-3"><h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.title}</h3><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATE_STYLE[card.state]}`}>{card.label}</span></div>
      <p className="mt-3 text-sm leading-5 text-gray-700">{card.explanation}</p>
      <details className="mt-3 text-xs text-gray-500"><summary className="cursor-pointer rounded font-semibold text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Signals used ({card.signals.length})</summary><ul className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">{card.signals.map((signal) => <li key={signal.label} className="flex justify-between gap-3"><span>{signal.label}</span><span className="text-right font-mono text-gray-700">{signal.reading}</span></li>)}</ul></details>
    </article>
  );
}

function KeyCard({ instrument, onSelect }: { instrument: MarketInstrument; onSelect: () => void }) {
  const definition = INSTRUMENT_BY_ID[instrument.id];
  const isYield = instrument.instrumentType === "yield";
  const positive = instrument.changePct == null ? null : instrument.changePct >= 0;
  const periodValue = (value: number | null) => {
    if (!isYield) return formatPct(value);
    if (value == null || instrument.price == null || value <= -100) return "—";
    const prior = instrument.price / (1 + value / 100);
    return formatBp((instrument.price - prior) * 100);
  };
  return (
    <button onClick={onSelect} className="surface-card min-w-0 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 motion-reduce:transform-none">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-semibold text-gray-900">{instrument.shortName}</div><div className="mt-0.5 text-[10px] text-gray-400">{instrument.symbol}</div></div><span className={`text-xs font-semibold ${positive == null ? "text-gray-400" : positive ? "text-green-600" : "text-red-500"}`}>{instrument.changePct == null ? "—" : `${positive ? "+" : ""}${instrument.changePct.toFixed(2)}%`}</span></div>
      <div className="mt-3 font-mono text-xl font-bold text-gray-900">{formatLatest(instrument, definition?.decimals ?? 2)}</div>
      <div className="mt-0.5 truncate text-[10px] text-gray-400">{instrument.unit}</div>
      <div className="mt-3"><MarketSparkline points={instrument.sparkline} positive={instrument.return1m == null ? null : instrument.return1m >= 0} /></div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-[10px]"><div><span className="block text-gray-400">1D</span><strong className={positive == null ? "text-gray-500" : positive ? "text-green-600" : "text-red-500"}>{isYield ? formatBp(instrument.change == null ? null : instrument.change * 100) : formatSigned(instrument.change, definition?.decimals ?? 2)}</strong></div><div><span className="block text-gray-400">1W</span><strong className={instrument.return1w != null && instrument.return1w >= 0 ? "text-green-600" : "text-red-500"}>{periodValue(instrument.return1w)}</strong></div><div><span className="block text-gray-400">1M</span><strong className={instrument.return1m != null && instrument.return1m >= 0 ? "text-green-600" : "text-red-500"}>{periodValue(instrument.return1m)}</strong></div></div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400"><span className={instrument.trend === "rising" ? "text-green-600" : instrument.trend === "falling" ? "text-red-500" : "text-gray-500"}>{trendArrow(instrument.trend)} {trendLabel(instrument.trend)}</span><span>{formatTimestampET(instrument.timestamp)}</span></div>
    </button>
  );
}

function DashboardSkeleton() {
  return <div aria-label="Loading market dashboard" className="space-y-6"><div className="h-24 animate-pulse motion-reduce:animate-none rounded-2xl bg-gray-200"/><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({length:4},(_,i)=><div key={i} className="h-40 animate-pulse motion-reduce:animate-none rounded-2xl bg-gray-200"/>)}</div><div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">{Array.from({length:10},(_,i)=><div key={i} className="h-64 animate-pulse motion-reduce:animate-none rounded-2xl bg-gray-200"/>)}</div></div>;
}

export default function MarketDashboard() {
  const [snapshot, setSnapshot] = useState<MarketsSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<MarketInstrument | null>(null);
  const [sessionLabel, setSessionLabel] = useState("");

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true); setError("");
    try {
      const response = await fetch(`/api/markets${force ? "?refresh=1" : ""}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Market data could not be loaded.");
      setSnapshot(payload as MarketsSnapshotResponse);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Market data could not be loaded."); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { void load(); setSessionLabel(usMarketSession().label); }, []);
  useEffect(() => {
    if (!selected) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("market-detail-heading")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected]);

  const map = useMemo(() => Object.fromEntries((snapshot?.instruments ?? []).map((item) => [item.id, item])), [snapshot]);
  const regimes = useMemo(() => classifyRegimes(map), [map]);
  const signals = useMemo(() => buildCrossMarketSignals(map), [map]);
  const failed = snapshot?.instruments.filter((item) => item.error).length ?? 0;
  const timestamps = snapshot?.instruments.map((item) => item.timestamp ? new Date(item.timestamp).getTime() : 0).filter(Boolean) ?? [];
  const newestTimestamp = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
  const ageDays = newestTimestamp ? (Date.now() - new Date(newestTimestamp).getTime()) / 86400000 : null;
  const delayed = snapshot?.instruments.some((item) => item.quoteSource?.toLowerCase().includes("delay")) ?? false;
  const status = failed > 0 ? `Partially unavailable · ${failed} failed` : ageDays != null && ageDays > 3 ? "Stale data" : delayed ? "Delayed quotes" : "Recent data";

  if (loading && !snapshot) return <DashboardSkeleton />;
  if (!snapshot) return <div className="surface-card flex min-h-64 flex-col items-center justify-center p-8 text-center"><h1 className="text-xl font-bold">Global Market Pulse</h1><p className="mt-2 text-sm text-red-600">{error || "Market data could not be loaded."}</p><button className="btn btn-primary mt-5" onClick={() => void load()}>Try again</button></div>;

  return (
    <div className={`space-y-8 transition-opacity ${refreshing ? "opacity-70" : ""}`}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Markets</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Global Market Pulse</h1><p className="mt-2 max-w-2xl text-sm text-gray-500">Commodities, rates, volatility, currencies, and global risk conditions</p></div>
        <div className="flex flex-wrap items-center gap-2"><div className="text-right text-[11px] text-gray-500"><div className="font-semibold text-gray-700">{status}</div><div>{newestTimestamp ? `Latest quote ${formatTimestampET(newestTimestamp)}` : "Quote time unavailable"}{sessionLabel ? ` · ${sessionLabel}` : ""}</div></div><button className="btn btn-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" disabled={refreshing} onClick={() => void load(true)}><span aria-hidden="true">↻</span>{refreshing ? "Refreshing…" : "Refresh"}</button></div>
      </header>

      {error && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Refresh failed. Showing the last successful data. {error}</div>}

      <section aria-labelledby="regime-heading"><div className="mb-3 flex items-end justify-between gap-4"><div><h2 id="regime-heading" className="text-lg font-bold text-gray-900">Market Regime</h2><p className="mt-1 text-xs text-gray-500">Transparent, rule-based indicators from current price and trend data.</p></div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{regimes.map((card) => <RegimeSummary key={card.key} card={card} />)}</div><p className="mt-2 text-[11px] text-gray-400">Market indicators only; not investment recommendations.</p></section>

      <section aria-labelledby="key-markets-heading"><h2 id="key-markets-heading" className="mb-3 text-lg font-bold text-gray-900">Key Markets</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">{KEY_MARKET_IDS.map((id) => map[id]).filter(Boolean).map((instrument) => <KeyCard key={instrument.id} instrument={instrument} onSelect={() => setSelected(instrument)} />)}</div></section>

      {selected && <MarketDetailPanel key={selected.id} instrument={selected} onClose={() => setSelected(null)} />}

      <section aria-labelledby="signals-heading"><div className="mb-3"><h2 id="signals-heading" className="text-lg font-bold text-gray-900">Cross-Market Signals</h2><p className="mt-1 text-xs text-gray-500">Relationships that help place individual markets in context.</p></div><div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">{signals.map((signal) => <article key={signal.key} className="surface-card p-4"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold text-gray-900">{signal.title}</h3><span className="font-mono text-lg font-bold text-indigo-600">{signal.value ?? "—"}</span></div><p className="mt-1 text-[11px] text-gray-500">{signal.valueNote}</p><div className="mt-3 flex gap-4 text-xs"><span><span className="text-gray-400">1W </span><strong>{signal.weekLabel ?? "—"}</strong></span><span><span className="text-gray-400">1M </span><strong>{signal.monthLabel ?? "—"}</strong></span></div><p className="mt-3 text-xs leading-5 text-gray-600">{signal.interpretation}</p><details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Formula</summary><p className="mt-2 border-t border-gray-100 pt-2 text-gray-500">{signal.formula}</p></details></article>)}</div></section>

      <section aria-labelledby="market-groups-heading" className="space-y-5"><div><h2 id="market-groups-heading" className="text-lg font-bold text-gray-900">All Markets</h2><p className="mt-1 text-xs text-gray-500">Select any row to inspect its chart and longer-term context.</p></div>{MARKET_SECTIONS.map((section) => { const ids = new Set(instrumentsForSection(section).map((item) => item.id)); const instruments = snapshot.instruments.filter((item) => ids.has(item.id)); return <article key={section.key} className="surface-card overflow-hidden"><div className="border-b border-[var(--border)] px-4 py-4 sm:px-5"><h3 className="font-bold text-gray-900">{section.title}</h3><p className="mt-1 text-xs text-gray-500">{section.description}</p>{section.key === "rates-bonds" && <p className="mt-2 text-[11px] text-amber-700">Treasury indices below are yields; SHY, IEF, and TLT are ETF prices. 2Y–10Y spread unavailable because this provider has no reliable 2-year yield.</p>}</div><MarketTable instruments={instruments} onSelect={setSelected} /></article>; })}</section>

      <footer className="border-t border-[var(--border)] pt-4 text-[11px] leading-5 text-gray-400">Quotes are sourced through Yahoo Finance and may be delayed. Futures are continuous/front-month market series and are not spot prices. Missing values are left blank rather than estimated.</footer>
    </div>
  );
}
