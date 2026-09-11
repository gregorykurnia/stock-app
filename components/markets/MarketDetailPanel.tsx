"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ColorType, CrosshairMode, createChart, LineSeries, type ISeriesApi, type Time } from "lightweight-charts";
import { INSTRUMENT_BY_ID } from "@/lib/markets/instruments";
import { formatLatest, formatPct, formatPrice, formatTimestampET, instrumentTypeLabel } from "@/lib/markets/format";
import type { DetailRange, MarketDetailResponse, MarketInstrument } from "@/lib/markets/types";

interface Props { instrument: MarketInstrument; onClose: () => void; }
const RANGES: DetailRange[] = ["1M", "3M", "6M", "1Y", "5Y"];

function movingAverage(bars: Array<{ date: string; close: number }>, period: number) {
  const result: Array<{ time: Time; value: number }> = [];
  let sum = 0;
  for (let index = 0; index < bars.length; index++) {
    sum += bars[index].close;
    if (index >= period) sum -= bars[index - period].close;
    if (index >= period - 1) result.push({ time: bars[index].date as Time, value: sum / period });
  }
  return result;
}

export default function MarketDetailPanel({ instrument, onClose }: Props) {
  const [range, setRange] = useState<DetailRange>("1Y");
  const [data, setData] = useState<MarketDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const definition = INSTRUMENT_BY_ID[instrument.id];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/markets?detail=${encodeURIComponent(instrument.id)}&range=${range}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Chart data unavailable.");
        return payload as MarketDetailResponse;
      })
      .then(setData)
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message || "Chart data unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [instrument.id, range]);

  const stats = useMemo(() => {
    const bars = data?.bars ?? [];
    if (!bars.length) return null;
    const closes = bars.map((bar) => bar.close);
    const first = closes[0]; const last = closes.at(-1)!;
    return { high: Math.max(...closes), low: Math.min(...closes), returnPct: first === 0 ? null : (last / first - 1) * 100 };
  }, [data]);

  useEffect(() => {
    if (!containerRef.current || !data?.bars.length) return;
    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth, height: 340,
      layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#6b7280" },
      grid: { vertLines: { color: "#f1f1f6" }, horzLines: { color: "#f1f1f6" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#e6e6ee", scaleMargins: { top: 0.12, bottom: 0.1 } },
      timeScale: { borderColor: "#e6e6ee", timeVisible: false },
      localization: { priceFormatter: (value: number) => definition?.instrumentType === "yield" ? `${value.toFixed(3)}%` : value.toFixed(definition?.decimals ?? 2) },
    });
    const addLine = (title: string, color: string, width: 1 | 2, values: Array<{ time: Time; value: number }>): ISeriesApi<"Line"> => {
      const series = chart.addSeries(LineSeries, { title, color, lineWidth: width, priceLineVisible: false, lastValueVisible: false });
      series.setData(values); return series;
    };
    addLine("Price", "#4f46e5", 2, data.bars.map((bar) => ({ time: bar.date as Time, value: bar.close })));
    addLine("MA20", "#0284c7", 1, movingAverage(data.bars, 20));
    addLine("MA50", "#d97706", 1, movingAverage(data.bars, 50));
    chart.timeScale().fitContent();
    const observer = new ResizeObserver(() => chart.applyOptions({ width: container.clientWidth }));
    observer.observe(container);
    return () => { observer.disconnect(); chart.remove(); };
  }, [data, definition]);

  return (
    <section className="surface-card scroll-mt-20 overflow-hidden" aria-labelledby="market-detail-heading">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h2 id="market-detail-heading" className="text-lg font-bold text-gray-900">{instrument.name}</h2><span className="badge bg-indigo-50 text-indigo-700">{instrumentTypeLabel(instrument.instrumentType)}</span></div>
          <p className="mt-1 text-xs text-gray-500">{instrument.symbol} · {instrument.unit || instrument.currency} · Updated {formatTimestampET(instrument.timestamp)}</p>
          {definition?.quoteDirectionNote && <p className="mt-1 text-xs text-gray-500">{definition.quoteDirectionNote}</p>}
        </div>
        <button className="btn btn-ghost self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={onClose} aria-label="Close market detail">Close</button>
      </div>
      <div className="p-5">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Latest</div><div className="mt-1 text-2xl font-bold font-mono">{formatLatest(instrument, definition?.decimals ?? 2)}</div></div>
          <div className="segmented overflow-x-auto" aria-label="Chart range">
            {RANGES.map((item) => <button key={item} className={`segmented-btn ${range === item ? "is-active" : ""}`} onClick={() => setRange(item)}>{item}</button>)}
          </div>
        </div>
        {loading && !data && <div className="h-[340px] animate-pulse motion-reduce:animate-none rounded-xl bg-gray-100" />}
        {error && !data && <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}
        {data && <div className={loading ? "opacity-60" : ""}><div ref={containerRef} className="min-h-[340px] w-full" /></div>}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500"><span><i className="mr-1 inline-block h-0.5 w-3 bg-indigo-600 align-middle" />Price</span><span><i className="mr-1 inline-block h-0.5 w-3 bg-sky-600 align-middle" />MA20</span><span><i className="mr-1 inline-block h-0.5 w-3 bg-amber-600 align-middle" />MA50</span></div>
        {stats && <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-4"><div><div className="text-[10px] uppercase text-gray-500">Period return</div><div className={`mt-1 font-mono font-semibold ${stats.returnPct != null && stats.returnPct >= 0 ? "text-green-600" : "text-red-500"}`}>{formatPct(stats.returnPct)}</div></div><div><div className="text-[10px] uppercase text-gray-500">Period high</div><div className="mt-1 font-mono font-semibold">{formatPrice(stats.high, definition?.decimals ?? 2)}</div></div><div><div className="text-[10px] uppercase text-gray-500">Period low</div><div className="mt-1 font-mono font-semibold">{formatPrice(stats.low, definition?.decimals ?? 2)}</div></div></div>}
        {instrument.instrumentType === "future" && <p className="mt-4 text-xs leading-5 text-gray-500">This is a futures price, not a spot price. The displayed Yahoo symbol may roll between front-month contracts.</p>}
      </div>
    </section>
  );
}
