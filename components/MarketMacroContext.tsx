"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ColorType, CrosshairMode, createChart, LineSeries, type Time } from "lightweight-charts";
import type {
  CurveStatus,
  MacroBar,
  MacroContextResponse,
  MacroRange,
  MacroRating,
  MacroSeries,
  MacroTrend,
  ShortCyclePhase,
} from "@/lib/macroContext";

const RANGES: MacroRange[] = ["1Y", "5Y", "10Y"];
const SHORT_CYCLE_PHASES: ShortCyclePhase[] = [
  "early expansion / recovery",
  "mid-cycle expansion",
  "late-cycle tightening",
  "contraction / recession risk",
  "easing / renewed recovery",
];
const LONG_CYCLE_PHASES = [
  "Credit expansion",
  "Leverage builds",
  "Debt pressure",
  "Deleveraging",
  "New easing cycle",
];

function formatYield(value: number | null) {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(2)}%`;
}

function formatBasisPoints(value: number | null) {
  return value == null || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(0)} bp`;
}

function ratingLabel(value: MacroRating) {
  if (value === "low") return "Low";
  if (value === "moderate") return "Moderate";
  if (value === "high") return "High";
  return "Not enough data";
}

function ratingTone(value: MacroRating) {
  if (value === "low") return "text-green-600";
  if (value === "moderate") return "text-amber-600";
  if (value === "high") return "text-red-600";
  return "text-gray-500";
}

function curveLabel(value: CurveStatus) {
  if (value === "normal") return "Normal";
  if (value === "flat") return "Flat";
  if (value === "inverted") return "Inverted";
  return "Not enough data";
}

function trendLabel(value: MacroTrend) {
  if (value === "rising") return "Rising";
  if (value === "falling") return "Falling";
  if (value === "range-bound") return "Stable";
  return "Not enough data";
}

function normalizeTime(time: Time | undefined): string | null {
  return typeof time === "string" ? time : null;
}

function spreadBars(series: MacroSeries[]): MacroBar[] {
  const short = new Map((series.find((item) => item.id === "us3m")?.bars ?? []).map((bar) => [bar.date, bar.value]));
  return (series.find((item) => item.id === "us10y")?.bars ?? [])
    .filter((bar) => short.has(bar.date))
    .map((bar) => ({ date: bar.date, value: bar.value - short.get(bar.date)! }));
}

function MacroCharts({ data }: { data: MacroContextResponse }) {
  const ratesRef = useRef<HTMLDivElement>(null);
  const spreadRef = useRef<HTMLDivElement>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const spread = useMemo(() => spreadBars(data.series), [data.series]);
  const spreadByDate = useMemo(() => new Map(spread.map((bar) => [bar.date, bar.value])), [spread]);
  const displayedDate = hoveredDate ?? data.assessment.latestDate;

  useEffect(() => {
    if (!ratesRef.current || !spreadRef.current) return;
    const ratesContainer = ratesRef.current;
    const spreadContainer = spreadRef.current;
    const chartOptions = {
      layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#6b7280" },
      grid: { vertLines: { color: "#f1f1f6" }, horzLines: { color: "#f1f1f6" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#e6e6ee", scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: "#e6e6ee", timeVisible: false },
    } as const;
    const ratesChart = createChart(ratesContainer, { ...chartOptions, width: ratesContainer.clientWidth, height: 320, localization: { priceFormatter: (value: number) => `${value.toFixed(2)}%` } });
    const spreadChart = createChart(spreadContainer, { ...chartOptions, width: spreadContainer.clientWidth, height: 180, localization: { priceFormatter: (value: number) => `${value.toFixed(2)}%` } });

    for (const item of data.series) {
      if (!item.bars.length) continue;
      const line = ratesChart.addSeries(LineSeries, { color: item.color, lineWidth: 2, title: item.label, priceLineVisible: false, lastValueVisible: false });
      line.setData(item.bars.map((bar) => ({ time: bar.date as Time, value: bar.value })));
    }
    if (spread.length) {
      const spreadLine = spreadChart.addSeries(LineSeries, { color: "#4f46e5", lineWidth: 2, title: "3M–10Y spread", priceLineVisible: false, lastValueVisible: false });
      spreadLine.setData(spread.map((bar) => ({ time: bar.date as Time, value: bar.value })));
      const zeroLine = spreadChart.addSeries(LineSeries, { color: "#9ca3af", lineWidth: 1, title: "Zero", priceLineVisible: false, lastValueVisible: false });
      zeroLine.setData(spread.map((bar) => ({ time: bar.date as Time, value: 0 })));
    }
    ratesChart.timeScale().fitContent();
    spreadChart.timeScale().fitContent();
    const handleMove = (param: { time?: Time }) => setHoveredDate(normalizeTime(param.time));
    ratesChart.subscribeCrosshairMove(handleMove);
    spreadChart.subscribeCrosshairMove(handleMove);
    const observer = new ResizeObserver(() => {
      ratesChart.applyOptions({ width: ratesContainer.clientWidth });
      spreadChart.applyOptions({ width: spreadContainer.clientWidth });
    });
    observer.observe(ratesContainer);
    observer.observe(spreadContainer);
    return () => {
      observer.disconnect();
      ratesChart.remove();
      spreadChart.remove();
    };
  }, [data.series, spread]);

  const tooltipValues = data.series
    .map((item) => ({ label: item.label, color: item.color, value: item.bars.find((bar) => bar.date === displayedDate)?.value ?? null }))
    .filter((item) => item.value != null);
  const hoveredSpread = displayedDate ? spreadByDate.get(displayedDate) ?? null : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.75fr)]">
      <div>
        <div className="relative rounded-xl border border-gray-100 bg-white p-2">
          <div ref={ratesRef} className="min-h-[320px] w-full" />
          {displayedDate && tooltipValues.length > 0 && (
            <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-[var(--border)] bg-white/95 px-3 py-2 shadow-[var(--shadow-md)] backdrop-blur-sm">
              <div className="text-xs font-semibold text-gray-900">{displayedDate}</div>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-600">
                {tooltipValues.map((item) => <div key={item.label}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />{item.label.replace(" Treasury", "")} <strong className="font-mono text-gray-800">{formatYield(item.value)}</strong></div>)}
              </div>
              {hoveredSpread != null && <div className="mt-1 border-t border-gray-100 pt-1 text-[11px] text-gray-500">3M–10Y spread <strong className="font-mono text-gray-700">{formatYield(hoveredSpread)}</strong></div>}
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
          {data.series.map((item) => <span key={item.id}><i className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ background: item.color }} />{item.label}</span>)}
        </div>
        <div className="mt-5 rounded-xl border border-gray-100 bg-white p-2">
          <div className="px-2 pt-1"><div className="text-xs font-semibold text-gray-700">Available curve spread</div><div className="text-[11px] text-gray-400">3M minus 10Y, percentage points · zero line marks flat</div></div>
          <div ref={spreadRef} className="min-h-[180px] w-full" />
          <div className="flex gap-4 px-2 pb-1 text-[11px] text-gray-500"><span><i className="mr-1 inline-block h-0.5 w-3 bg-indigo-600 align-middle" />3M–10Y spread</span><span><i className="mr-1 inline-block h-px w-3 bg-gray-400 align-middle" />Zero</span></div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Curve read</div><div className="mt-1 text-2xl font-bold text-gray-900">{curveLabel(data.assessment.curve.status)}</div></div><span className={`badge ${data.assessment.curve.status === "inverted" ? "bg-red-100 text-red-700" : data.assessment.curve.status === "normal" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{formatBasisPoints(data.assessment.curve.spreadBp)}</span></div>
          <p className="mt-3 text-xs leading-5 text-gray-600">{data.assessment.curve.explanation}</p>
          <p className="mt-3 border-t border-indigo-100 pt-3 text-[11px] leading-5 text-indigo-700">The standard 2Y–10Y spread is not shown because the current Yahoo catalog marks its 2Y source as unreliable. This is a 3M–10Y market-yield signal.</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Market-rate trend</div><span className="font-mono text-sm font-bold text-gray-900">{trendLabel(data.assessment.rateTrend)}</span></div>
          <p className="mt-2 text-xs leading-5 text-gray-600">{data.assessment.rateTrendExplanation}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
          <div className="flex items-center justify-between gap-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Rate outlook</div><span className="badge bg-amber-100 text-amber-700">Unavailable</span></div>
          <p className="mt-2 text-xs leading-5 text-amber-800">{data.outlook.explanation}</p>
        </div>
      </div>
    </div>
  );
}

export default function MarketMacroContext() {
  const [range, setRange] = useState<MacroRange>("5Y");
  const [data, setData] = useState<MacroContextResponse | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ range });
    if (reloadKey > 0) query.set("refresh", "1");
    fetch(`/api/macro-context?${query.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Macro data could not be loaded.");
        return payload as MacroContextResponse;
      })
      .then((payload) => { setData(payload); setError(""); })
      .catch((reason: unknown) => { if (reason instanceof DOMException && reason.name === "AbortError") return; setError(reason instanceof Error ? reason.message : "Macro data could not be loaded."); })
      .finally(() => setRefreshing(false));
    return () => controller.abort();
  }, [range, reloadKey]);

  const visibleData = data?.range === range ? data : null;
  const loading = !visibleData && !error;
  const regime = visibleData?.assessment.regime;

  return (
    <section className="surface-card overflow-hidden" aria-labelledby="macro-context-heading">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Macro context</p><span className="badge bg-gray-100 text-gray-600">Read-only</span></div><h2 id="macro-context-heading" className="mt-1 text-lg font-bold tracking-tight text-gray-900">Rates, cycle signals, and regime</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-gray-500">A market-context layer for interpreting portfolio conditions. Debt-cycle phases are educational heuristics, not forecasts.</p></div>
        <div className="flex flex-wrap items-center gap-2"><div className="segmented" aria-label="Macro chart range">{RANGES.map((item) => <button key={item} className={`segmented-btn ${range === item ? "is-active" : ""}`} onClick={() => setRange(item)}>{item}</button>)}</div><button className="btn btn-secondary" disabled={refreshing} onClick={() => { setRefreshing(true); setReloadKey((value) => value + 1); }}>{refreshing ? "Refreshing…" : "Refresh"}</button></div>
      </div>

      {error && <div role="status" className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:mx-5">{error}</div>}
      {loading && <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5"><div className="h-[420px] animate-pulse motion-reduce:animate-none rounded-xl bg-gray-100 sm:col-span-2" /><div className="h-24 animate-pulse motion-reduce:animate-none rounded-xl bg-gray-100" /><div className="h-24 animate-pulse motion-reduce:animate-none rounded-xl bg-gray-100" /></div>}

      {visibleData && regime && (
        <div className="space-y-5 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { label: "Inflation pressure", value: regime.inflationPressure, detail: regime.inflationExplanation },
              { label: "Recession risk", value: regime.recessionRisk, detail: regime.recessionExplanation },
              { label: "Growth momentum", value: regime.growthMomentum, detail: regime.growthExplanation },
              { label: "Policy stance", value: regime.monetaryPolicy, detail: regime.monetaryPolicyExplanation },
              { label: "Yield curve", value: regime.yieldCurve, detail: visibleData.assessment.curve.explanation },
            ].map((item) => {
              const value = item.label === "Policy stance" ? item.value === "unavailable" ? "Not enough data" : item.value : item.label === "Yield curve" ? curveLabel(item.value as CurveStatus) : ratingLabel(item.value as MacroRating);
              const tone = item.label === "Yield curve" ? item.value === "inverted" ? "text-red-600" : item.value === "normal" ? "text-green-600" : "text-gray-500" : ratingTone(item.value as MacroRating);
              return <article key={item.label} className="surface-card min-w-0 border-gray-100 bg-gray-50/70 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</div><div className={`mt-1 truncate text-base font-bold ${tone}`}>{value}</div><p className="mt-1 line-clamp-3 text-[10px] leading-4 text-gray-500">{item.detail}</p></article>;
            })}
          </div>

          <div><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-sm font-bold text-gray-900">US interest-rate outlook</h3><p className="mt-1 text-xs text-gray-500">Historical Treasury market yields from {visibleData.source} · latest observation {visibleData.assessment.latestDate ?? "—"}</p></div><span className="text-[11px] text-gray-400">{range} view</span></div><MacroCharts data={visibleData} /></div>

          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-xl border border-gray-100 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-gray-900">Short-term debt cycle</h3><p className="mt-1 text-xs leading-5 text-gray-500">A multi-year credit-cycle teaching model, positioned only from the available rate signals.</p></div><span className="badge bg-indigo-50 text-indigo-700">{visibleData.assessment.shortCycle.confidence} confidence</span></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{SHORT_CYCLE_PHASES.map((phase, index) => <div key={phase} className={`rounded-lg border px-2 py-2 text-center text-[10px] font-semibold leading-4 ${index === visibleData.assessment.shortCycle.phaseIndex ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm" : "border-gray-100 bg-gray-50 text-gray-500"}`}><span className="mb-1 block font-mono text-[9px]">{index + 1}</span>{phase}</div>)}</div><p className="mt-3 text-xs leading-5 text-gray-600"><strong>Current heuristic:</strong> {visibleData.assessment.shortCycle.phase}. {visibleData.assessment.shortCycle.explanation}</p><div className="mt-3 grid gap-2 border-t border-gray-100 pt-3">{visibleData.assessment.shortCycle.signals.map((signal) => <div key={signal.label} className="flex gap-2 text-[11px] leading-4"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${signal.status === "caution" ? "bg-amber-400" : signal.status === "supportive" ? "bg-green-400" : signal.status === "neutral" ? "bg-gray-300" : "bg-gray-200"}`} /><div><strong className="text-gray-700">{signal.label}</strong><span className="ml-1 text-gray-500">{signal.detail}</span></div></div>)}</div></article>

            <article className="rounded-xl border border-gray-100 p-4"><div><h3 className="text-sm font-bold text-gray-900">Long-term debt cycle</h3><p className="mt-1 text-xs leading-5 text-gray-500">A conceptual 50–75 year framework. The app does not yet have debt, credit, or debt-service history to locate the current economy on it.</p></div><div className="mt-5 grid grid-cols-5 gap-1">{LONG_CYCLE_PHASES.map((phase, index) => <div key={phase} className="relative text-center"><div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${index < 2 ? "bg-indigo-100 text-indigo-700" : index === 2 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>{index + 1}</div><div className="mt-2 text-[10px] font-semibold leading-4 text-gray-600">{phase}</div>{index < LONG_CYCLE_PHASES.length - 1 && <div className="absolute left-[calc(50%+20px)] right-[calc(-50%+20px)] top-4 h-px bg-gray-200" />}</div>)}</div><div className="mt-5 rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-600"><strong>Not measured in this version.</strong> {visibleData.assessment.longCycle.explanation}</div></article>
          </div>

          <footer className="border-t border-[var(--border)] pt-3 text-[10px] leading-5 text-gray-400">Source: {visibleData.source}. {visibleData.sourceNote} Data is cached server-side for 15 minutes; missing observations remain blank. This is market analysis, not personalized financial advice.</footer>
        </div>
      )}
    </section>
  );
}
