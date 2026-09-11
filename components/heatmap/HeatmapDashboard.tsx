"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GICS_SECTORS, sectorShortLabel, sortSectors } from "@/lib/heatmap/constituents";
import {
  DEFAULT_VIEW_STATE, HEATMAP_PERIODS, aggregateSectors, colorBucket, contributionPct,
  legendThresholds, marketSummary, metricValue, periodReturn, rankBy, scaleForMetric,
  tileFill, tileTextColor, tileWeight, totalMarketCap, viewStateToQuery,
  parseHeatmapViewState, relativeReturn,
} from "@/lib/heatmap/calculations";
import { formatCompactShares, formatLargeUsd, formatPct, formatPrice, formatRatio, formatTimestampET } from "@/lib/heatmap/format";
import { layoutGroups } from "@/lib/heatmap/layout";
import type { HeatmapColorMetric, HeatmapHistoryResponse, HeatmapResponse, HeatmapStock, HeatmapViewState } from "@/lib/heatmap/types";

const METRICS: Array<{ value: HeatmapColorMetric; label: string }> = [
  { value: "performance", label: "Performance" }, { value: "relative", label: "vs S&P 500" },
  { value: "relVolume", label: "Relative volume" }, { value: "dist52wHigh", label: "From 52W high" },
  { value: "distMa20", label: "vs 20D MA" }, { value: "distMa50", label: "vs 50D MA" }, { value: "distMa200", label: "vs 200D MA" },
];

function metricLabel(metric: HeatmapColorMetric, stock: HeatmapStock, state: HeatmapViewState, benchmark: number | null) {
  const value = metricValue(stock, metric, state.period, benchmark);
  return metric === "relVolume" ? formatRatio(value) : formatPct(value);
}

function statusStyle(status: HeatmapResponse["status"]) {
  return status === "recent" ? "border-green-200 bg-green-50 text-green-800" : status === "delayed" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-800";
}

function HeatmapTreemap({ stocks, state, benchmarkReturn, onStock, onSector }: { stocks: HeatmapStock[]; state: HeatmapViewState; benchmarkReturn: number | null; onStock: (stock: HeatmapStock) => void; onSector: (sector: string) => void }) {
  const groups = useMemo(() => {
    const byGroup = new Map<string, HeatmapStock[]>();
    for (const stock of stocks) {
      const key = state.grouping === "sectorIndustry" ? `${stock.sector} | ${stock.industry}` : stock.sector;
      const list = byGroup.get(key) ?? [];
      list.push(stock); byGroup.set(key, list);
    }
    const sectors = sortSectors(new Set(stocks.map((stock) => stock.sector)));
    return [...byGroup.entries()].map(([key, members]) => ({
      key, members, sector: members[0].sector,
      label: state.grouping === "sectorIndustry" ? key : sectorShortLabel(key),
      weight: members.reduce((sum, stock) => sum + (tileWeight(stock, state.sizeMetric) ?? 1), 0),
    })).sort((a, b) => {
      const sectorOrder = sectors.indexOf(a.sector) - sectors.indexOf(b.sector);
      return sectorOrder || a.label.localeCompare(b.label);
    });
  }, [state.grouping, state.sizeMetric, stocks]);
  const rects = useMemo(() => layoutGroups(groups.map((group) => ({ key: group.key, weight: group.weight, items: group.members.map((stock) => ({ key: stock.symbol, weight: tileWeight(stock, state.sizeMetric) ?? 1 })).sort((a, b) => b.weight - a.weight) })), { x: 0, y: 0, width: 1200, height: 680 }, 28), [groups, state.sizeMetric]);
  const map = new Map(stocks.map((stock) => [stock.symbol, stock]));
  const groupLabels = new Map(groups.map((group) => [group.key, group.label]));
  const scale = scaleForMetric(state.colorMetric, state.period);

  return <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-inner">
    <svg viewBox="0 0 1200 680" className="block h-auto w-full" role="img" aria-label="Interactive S&P 500 market heatmap. Tiles are grouped by sector and sized by the selected metric.">
      <defs><pattern id="heatmap-missing" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#475569"/><rect width="3" height="8" fill="#64748b"/></pattern></defs>
      {rects.map((group) => <g key={group.groupKey}>
        <rect x={group.rect.x} y={group.rect.y} width={group.rect.width} height={group.rect.height} fill="#0f172a" stroke="#e2e8f0" strokeWidth="2" />
        {group.rect.height > 56 && <g role="button" tabIndex={0} aria-label={`Zoom to ${group.groupKey}`} onClick={() => onSector(group.groupKey.split(" | ")[0])} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSector(group.groupKey.split(" | ")[0]); } }} className="cursor-pointer"><rect x={group.rect.x} y={group.rect.y} width={group.rect.width} height="28" fill="#172554"/><text x={group.rect.x + 8} y={group.rect.y + 19} fill="#e0e7ff" fontSize="13" fontWeight="700">{groupLabels.get(group.groupKey) ?? group.groupKey}</text></g>}
        {group.items.map((rect) => {
          const stock = map.get(rect.key)!;
          const value = metricValue(stock, state.colorMetric, state.period, benchmarkReturn);
          const fill = tileFill(colorBucket(value, scale), state.palette);
          const text = fill ? tileTextColor(fill) : "#f8fafc";
          const roomy = rect.width >= 72 && rect.height >= 42;
          const named = rect.width >= 120 && rect.height >= 68;
          const label = `${stock.symbol}, ${stock.companyName}, ${metricLabel(state.colorMetric, stock, state, benchmarkReturn)}. ${stock.sector}.`;
          return <g key={stock.symbol} role="button" tabIndex={0} aria-label={label} className="cursor-pointer outline-none" onClick={() => onStock(stock)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onStock(stock); } }}>
            <title>{label}</title><rect x={rect.x + 1} y={rect.y + 1} width={Math.max(0, rect.width - 2)} height={Math.max(0, rect.height - 2)} fill={fill ?? "url(#heatmap-missing)"} stroke="#0f172a" strokeWidth="1" />
            {roomy && <text x={rect.x + 6} y={rect.y + 16} fill={text} fontSize="12" fontWeight="800">{stock.symbol}</text>}
            {roomy && <text x={rect.x + 6} y={rect.y + 31} fill={text} fontSize="11" fontWeight="600">{metricLabel(state.colorMetric, stock, state, benchmarkReturn)}</text>}
            {named && <text x={rect.x + 6} y={rect.y + 47} fill={text} fontSize="9" opacity=".9">{stock.companyName.slice(0, Math.max(8, Math.floor(rect.width / 7)))}</text>}
          </g>;
        })}
      </g>)}
    </svg>
  </div>;
}

function StockDrawer({ stock, benchmark, onClose }: { stock: HeatmapStock; benchmark: number | null; onClose: () => void }) {
  const [history, setHistory] = useState<HeatmapHistoryResponse | null>(null);
  useEffect(() => { let active = true; setHistory(null); fetch(`/api/heatmap?history=${encodeURIComponent(stock.symbol)}`).then((response) => response.ok ? response.json() : null).then((data) => { if (active) setHistory(data); }).catch(() => undefined); return () => { active = false; }; }, [stock.symbol]);
  const closes = history?.bars.map((bar) => bar.close) ?? [];
  const min = Math.min(...closes); const max = Math.max(...closes); const span = max - min || 1;
  const points = closes.map((close, index) => `${(index / Math.max(1, closes.length - 1)) * 300},${80 - ((close - min) / span) * 70}`).join(" ");
  const rows = [["Price", formatPrice(stock.price)], ["Selected return", formatPct(stock.returns.oneDay)], ["vs S&P 500", formatPct(relativeReturn(stock.returns.oneDay, benchmark))], ["Market cap", formatLargeUsd(stock.marketCap)], ["Relative volume", formatRatio(stock.relativeVolume)], ["52W range", stock.position52Week == null ? "—" : `${stock.position52Week.toFixed(0)}%`], ["Above 20 / 50 / 200D", `${stock.price != null && stock.ma20 != null && stock.price > stock.ma20 ? "Yes" : "No"} / ${stock.price != null && stock.ma50 != null && stock.price > stock.ma50 ? "Yes" : "No"} / ${stock.price != null && stock.ma200 != null && stock.price > stock.ma200 ? "Yes" : "No"}`]];
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={`${stock.symbol} details`} onClick={onClose}><aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl sm:rounded-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-xs font-bold text-indigo-600">{stock.symbol}</p><h2 className="mt-1 text-xl font-bold text-gray-900">{stock.companyName}</h2><p className="mt-1 text-xs text-gray-500">{stock.sector} · {stock.industry}</p></div><button className="btn btn-secondary" onClick={onClose}>Close</button></div><div className="mt-5 rounded-xl border border-gray-100 bg-slate-50 p-3"><svg viewBox="0 0 300 90" className="w-full" aria-label={`${stock.symbol} recent price chart`}><polyline points={points} fill="none" stroke="#4f46e5" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></svg></div><dl className="mt-5 divide-y divide-gray-100">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 text-sm"><dt className="text-gray-500">{label}</dt><dd className="text-right font-semibold text-gray-900">{value}</dd></div>)}</dl><p className="mt-4 text-xs text-gray-500">Quote {formatTimestampET(stock.timestamp)}{stock.quoteSource ? ` · ${stock.quoteSource}` : ""}</p><div className="mt-5 flex gap-2"><a className="btn btn-primary" href={`/stock/${encodeURIComponent(stock.symbol)}`}>Stock details</a><a className="btn btn-secondary" href={`/breakout-chart/${encodeURIComponent(stock.symbol)}`}>Breakout chart</a></div></aside></div>;
}

export default function HeatmapDashboard() {
  const searchParams = useSearchParams(); const router = useRouter(); const pathname = usePathname();
  const [data, setData] = useState<HeatmapResponse | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [selected, setSelected] = useState<HeatmapStock | null>(null);
  const state = useMemo(() => parseHeatmapViewState((key) => searchParams.get(key)), [searchParams]);
  const update = (patch: Partial<HeatmapViewState>) => { const next = { ...state, ...patch }; const query = viewStateToQuery(next); router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }); };
  const load = async (refresh = false) => { refresh ? setRefreshing(true) : setLoading(true); setError(""); try { const response = await fetch(`/api/heatmap${refresh ? "?refresh=1" : ""}`); const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Heatmap data could not be loaded."); setData(payload); } catch (reason) { setError(reason instanceof Error ? reason.message : "Heatmap data could not be loaded."); } finally { setLoading(false); setRefreshing(false); } };
  useEffect(() => { void load(); }, []);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") { if (selected) setSelected(null); else if (state.zoomSector) update({ zoomSector: "", zoomIndustry: "" }); } }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); });
  const benchmark = data ? periodReturn(data.benchmark.returns, state.period) : null;
  const visible = useMemo(() => (data?.stocks ?? []).filter((stock) => { const query = state.search.toLowerCase(); if (query && !`${stock.symbol} ${stock.companyName}`.toLowerCase().includes(query)) return false; if (state.sectorFilter && stock.sector !== state.sectorFilter) return false; if (state.zoomSector && stock.sector !== state.zoomSector) return false; const value = periodReturn(stock.returns, state.period); return state.movers === "all" || (state.movers === "gainers" ? (value ?? 0) > 0 : (value ?? 0) < 0); }), [data, state]);
  const summary = useMemo(() => marketSummary(visible, state.period), [visible, state.period]);
  const sectors = useMemo(() => aggregateSectors(visible, state.period, totalMarketCap(visible), sortSectors(new Set(visible.map((stock) => stock.sector)))), [visible, state.period]);
  const leaders = useMemo(() => rankBy(visible, (stock) => periodReturn(stock.returns, state.period), { limit: 5 }), [visible, state.period]);
  if (loading && !data) return <div className="space-y-5"><div className="h-24 animate-pulse rounded-2xl bg-gray-200"/><div className="h-[600px] animate-pulse rounded-2xl bg-gray-200"/></div>;
  if (!data) return <div className="surface-card flex min-h-72 flex-col items-center justify-center p-8 text-center"><h1 className="text-xl font-bold">Market Heatmap</h1><p className="mt-2 text-sm text-red-600">{error || "Heatmap data could not be loaded."}</p><button className="btn btn-primary mt-5" onClick={() => void load()}>Try again</button></div>;
  const threshold = legendThresholds(state.colorMetric, state.period);
  return <div className={`space-y-6 transition-opacity ${refreshing ? "opacity-70" : ""}`}><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">US Equities</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Market Heatmap</h1><p className="mt-2 max-w-2xl text-sm text-gray-500">Sector leadership, breadth, and the stocks driving the S&P 500.</p></div><div className="flex items-end gap-2"><div className="text-right text-[11px] text-gray-500"><span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${statusStyle(data.status)}`}>{data.status}</span><div className="mt-1">{formatTimestampET(data.fetchedAt)} · {data.session}</div></div><button className="btn btn-secondary" disabled={refreshing} onClick={() => void load(true)}>{refreshing ? "Refreshing…" : "↻ Refresh"}</button></div></header>
    {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Refresh failed. Showing the last successful data. {error}</div>}
    {data.refreshFailed && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Provider refresh failed; showing the last usable snapshot.</div>}
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">{[["S&P 500", formatPct(benchmark)], ["Advancing", `${summary.breadth.advancers} / ${summary.breadth.withData}`], ["Breadth", summary.breadth.pctAdvancing == null ? "—" : `${summary.breadth.pctAdvancing.toFixed(0)}%`], ["Cap-weighted", formatPct(summary.capWeightedReturn)], ["Equal-weight", formatPct(summary.equalWeightedReturn)], ["Strongest", summary.strongestSector?.sector ?? "—"], ["Weakest", summary.weakestSector?.sector ?? "—"]].map(([label, value]) => <article key={label} className="surface-card p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 truncate text-sm font-bold text-gray-900">{value}</p></article>)}</section>
    <section className="surface-card p-4"><div className="flex flex-wrap items-center gap-3"><label className="min-w-40 flex-1"><span className="sr-only">Search ticker or company</span><input value={state.search} onChange={(event) => update({ search: event.target.value })} className="input-field w-full" placeholder="Search ticker or company" /></label><div className="segmented max-w-full overflow-x-auto">{HEATMAP_PERIODS.map((period) => <button key={period} className={`segmented-btn ${state.period === period ? "is-active" : ""}`} onClick={() => update({ period })}>{period}</button>)}</div><select className="input-field" value={state.colorMetric} onChange={(event) => update({ colorMetric: event.target.value as HeatmapColorMetric })}>{METRICS.map((metric) => <option key={metric.value} value={metric.value}>{metric.label}</option>)}</select><select className="input-field" value={state.sizeMetric} onChange={(event) => update({ sizeMetric: event.target.value as HeatmapViewState["sizeMetric"] })}><option value="marketCap">Size: Market cap</option><option value="equal">Size: Equal</option><option value="dollarVolume">Size: Dollar volume</option></select><select className="input-field" value={state.sectorFilter} onChange={(event) => update({ sectorFilter: event.target.value, zoomSector: "" })}><option value="">All sectors</option>{GICS_SECTORS.map((sector) => <option key={sector}>{sector}</option>)}</select><button className="btn btn-ghost" onClick={() => update(DEFAULT_VIEW_STATE)}>Reset</button></div></section>
    <section aria-labelledby="heatmap-heading"><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 id="heatmap-heading" className="text-lg font-bold text-gray-900">S&P 500 map</h2><p className="mt-1 text-xs text-gray-500">Area: {state.sizeMetric === "marketCap" ? "market capitalization" : state.sizeMetric}. Color: {METRICS.find((metric) => metric.value === state.colorMetric)?.label}.</p></div><div className="flex items-center gap-1 text-[10px] font-semibold text-gray-600"><span>{threshold.low}</span>{[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((bucket) => <i key={bucket} className="h-4 w-4 rounded-sm border border-black/10" style={{ background: tileFill(bucket as -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4, state.palette) ?? "#ddd" }} />)}<span>{threshold.high}</span><span className="ml-2 text-gray-400">Hatch = unavailable</span></div></div>{state.zoomSector && <div className="mb-3 flex items-center gap-2 text-sm"><button className="font-semibold text-indigo-600 hover:text-indigo-800" onClick={() => update({ zoomSector: "", zoomIndustry: "" })}>All sectors</button><span className="text-gray-300">/</span><span className="font-semibold text-gray-700">{state.zoomSector}</span></div>}<HeatmapTreemap stocks={visible} state={state} benchmarkReturn={benchmark} onStock={setSelected} onSector={(sector) => update({ zoomSector: sector, sectorFilter: "" })}/></section>
    <section className="grid grid-cols-1 gap-5 lg:grid-cols-3"><article className="surface-card p-5 lg:col-span-1"><h2 className="text-lg font-bold text-gray-900">{state.zoomSector || "Market"} leaders</h2><p className="mt-1 text-xs text-gray-500">Top performers for the selected period.</p><ol className="mt-4 divide-y divide-gray-100">{leaders.map((row) => <li key={row.stock.symbol}><button onClick={() => setSelected(row.stock)} className="flex w-full items-center justify-between gap-3 py-3 text-left"><span><b className="font-mono text-sm text-gray-900">{row.rank}. {row.stock.symbol}</b><span className="ml-2 text-xs text-gray-500">{row.stock.companyName}</span></span><strong className={row.value >= 0 ? "text-green-600" : "text-red-600"}>{formatPct(row.value)}</strong></button></li>)}</ol></article><article className="surface-card overflow-hidden lg:col-span-2"><div className="border-b border-gray-100 px-5 py-4"><h2 className="font-bold text-gray-900">Sector intelligence</h2><p className="mt-1 text-xs text-gray-500">Performance is movement; contribution is a market-cap-weighted estimate of influence on this S&P 500 proxy.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-gray-400"><tr><th className="px-4 py-3">Sector</th><th className="px-3 py-3">Cap wt.</th><th className="px-3 py-3">Equal wt.</th><th className="px-3 py-3">Breadth</th><th className="px-3 py-3">Leader</th></tr></thead><tbody>{sectors.map((sector) => <tr key={sector.sector} className="border-t border-gray-100 hover:bg-slate-50"><td className="px-4 py-3"><button className="font-semibold text-indigo-600" onClick={() => update({ zoomSector: sector.sector, sectorFilter: "" })}>{sector.sector}</button></td><td className="px-3 py-3">{formatPct(sector.capWeightedReturn)}</td><td className="px-3 py-3">{formatPct(sector.equalWeightedReturn)}</td><td className="px-3 py-3">{sector.pctAdvancing == null ? "—" : `${sector.pctAdvancing.toFixed(0)}%`}</td><td className="px-3 py-3 font-mono">{sector.strongest?.symbol ?? "—"}</td></tr>)}</tbody></table></div></article></section><footer className="border-t border-[var(--border)] pt-4 text-[11px] leading-5 text-gray-400">Constituents as of {data.constituentsAsOf}. Quotes are sourced through Yahoo Finance and may be delayed. Contribution is an estimate based on reported market capitalization, not official float-adjusted S&P 500 weights.</footer>{selected && <StockDrawer stock={selected} benchmark={benchmark} onClose={() => setSelected(null)} />}</div>;
}
