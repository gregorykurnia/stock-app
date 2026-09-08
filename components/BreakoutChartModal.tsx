"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { calcIndicators, macdSeriesFull } from "@/lib/indicators";
import type { OHLCVBar, Indicators } from "@/lib/types";

interface Props {
  ticker: string;
  onClose: () => void;
}

const CHART_OPTIONS = (width: number) => ({
  layout: {
    background: { type: ColorType.Solid, color: "#0f172a" },
    textColor: "#94a3b8",
  },
  grid: {
    vertLines: { color: "#1e293b" },
    horzLines: { color: "#1e293b" },
  },
  width,
  timeScale: { borderColor: "#1e293b" },
  rightPriceScale: { borderColor: "#1e293b" },
});

export default function BreakoutChartModal({ ticker, onClose }: Props) {
  const [bars, setBars] = useState<OHLCVBar[] | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [macd, setMacd] = useState<{ macd: number[]; signal: number[]; hist: number[] } | null>(null);
  const [error, setError] = useState("");

  const priceRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const dmiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const cmfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      setBars(null);
      try {
        const res = await fetch(`/api/daily-bars?ticker=${ticker}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to fetch");
        if (cancelled) return;
        const fetchedBars: OHLCVBar[] = json.bars;
        const ind = calcIndicators(fetchedBars);
        const closes = fetchedBars.map((b) => b.close);
        setBars(fetchedBars);
        setIndicators(ind);
        setMacd(macdSeriesFull(closes));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [ticker]);

  useEffect(() => {
    if (!bars || !indicators || !macd) return;
    if (!priceRef.current || !rsiRef.current || !dmiRef.current || !macdRef.current || !cmfRef.current) return;

    const w = priceRef.current.clientWidth;
    const times = bars.map((b) => b.time as Time);

    const priceChart = createChart(priceRef.current, { ...CHART_OPTIONS(w), height: 320 });
    const candleSeries = priceChart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeries.setData(
      bars.map((b, i) => ({ time: times[i], open: b.open, high: b.high, low: b.low, close: b.close }))
    );
    const ema20Series = priceChart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2, title: "EMA20" });
    ema20Series.setData(bars.map((b, i) => ({ time: times[i], value: indicators.ema20[i] })).filter((d) => !isNaN(d.value)));
    const ema50Series = priceChart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 2, title: "EMA50" });
    ema50Series.setData(bars.map((b, i) => ({ time: times[i], value: indicators.ema50[i] })).filter((d) => !isNaN(d.value)));
    priceChart.timeScale().fitContent();

    // RSI
    const rsiChart = createChart(rsiRef.current, { ...CHART_OPTIONS(w), height: 140 });
    const rsi70 = rsiChart.addSeries(LineSeries, { color: "#475569", lineWidth: 1, lineStyle: 2 });
    rsi70.setData(bars.map((_, i) => ({ time: times[i], value: 70 })));
    const rsi30 = rsiChart.addSeries(LineSeries, { color: "#475569", lineWidth: 1, lineStyle: 2 });
    rsi30.setData(bars.map((_, i) => ({ time: times[i], value: 30 })));
    const rsiSeries = rsiChart.addSeries(LineSeries, { color: "#38bdf8", lineWidth: 2, title: "RSI" });
    rsiSeries.setData(bars.map((b, i) => ({ time: times[i], value: indicators.rsi[i] })).filter((d) => !isNaN(d.value)));
    rsiChart.timeScale().fitContent();

    // DMI (DI+/DI-/ADX)
    const dmiChart = createChart(dmiRef.current, { ...CHART_OPTIONS(w), height: 140 });
    const diPlusSeries = dmiChart.addSeries(LineSeries, { color: "#22c55e", lineWidth: 2, title: "DI+" });
    diPlusSeries.setData(bars.map((b, i) => ({ time: times[i], value: indicators.diPlus[i] })).filter((d) => !isNaN(d.value)));
    const diMinusSeries = dmiChart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 2, title: "DI-" });
    diMinusSeries.setData(bars.map((b, i) => ({ time: times[i], value: indicators.diMinus[i] })).filter((d) => !isNaN(d.value)));
    const adxSeries = dmiChart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 2, lineStyle: 1, title: "ADX" });
    adxSeries.setData(bars.map((b, i) => ({ time: times[i], value: indicators.adx[i] })).filter((d) => !isNaN(d.value)));
    dmiChart.timeScale().fitContent();

    // MACD
    const macdChart = createChart(macdRef.current, { ...CHART_OPTIONS(w), height: 140 });
    const macdZero = macdChart.addSeries(LineSeries, { color: "#475569", lineWidth: 1, lineStyle: 2 });
    macdZero.setData(bars.map((_, i) => ({ time: times[i], value: 0 })));
    const macdHistSeries = macdChart.addSeries(HistogramSeries, {
      priceFormat: { type: "price", precision: 3, minMove: 0.001 },
    });
    macdHistSeries.setData(
      bars
        .map((b, i) => ({ time: times[i], value: macd.hist[i], color: macd.hist[i] >= 0 ? "#22c55e" : "#ef4444" }))
        .filter((d) => !isNaN(d.value))
    );
    const macdLineSeries = macdChart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1, title: "MACD" });
    macdLineSeries.setData(bars.map((b, i) => ({ time: times[i], value: macd.macd[i] })).filter((d) => !isNaN(d.value)));
    const macdSignalSeries = macdChart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1, title: "Signal" });
    macdSignalSeries.setData(bars.map((b, i) => ({ time: times[i], value: macd.signal[i] })).filter((d) => !isNaN(d.value)));
    macdChart.timeScale().fitContent();

    // CMF
    const cmfChart = createChart(cmfRef.current, { ...CHART_OPTIONS(w), height: 140 });
    const cmfZero = cmfChart.addSeries(LineSeries, { color: "#475569", lineWidth: 1, lineStyle: 2 });
    cmfZero.setData(bars.map((_, i) => ({ time: times[i], value: 0 })));
    const cmfSeries = cmfChart.addSeries(HistogramSeries, {
      priceFormat: { type: "price", precision: 3, minMove: 0.001 },
    });
    cmfSeries.setData(
      bars
        .map((b, i) => ({ time: times[i], value: indicators.cmf[i], color: indicators.cmf[i] >= 0 ? "#22c55e" : "#ef4444" }))
        .filter((d) => !isNaN(d.value))
    );
    cmfChart.timeScale().fitContent();

    const charts: IChartApi[] = [priceChart, rsiChart, dmiChart, macdChart, cmfChart];
    charts.forEach((chart) => {
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) charts.forEach((c) => { if (c !== chart) c.timeScale().setVisibleLogicalRange(range); });
      });
    });

    const handleResize = () => {
      const nw = priceRef.current?.clientWidth ?? w;
      charts.forEach((c) => c.applyOptions({ width: nw }));
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      charts.forEach((c) => c.remove());
    };
  }, [bars, indicators, macd]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg bg-[#0f172a] border border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 sticky top-0 bg-[#0f172a] z-10">
          <h2 className="text-lg font-semibold text-slate-100">{ticker} — Daily Chart</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && <div className="p-6 text-red-400 text-sm">{error}</div>}
        {!error && !bars && <div className="p-6 text-slate-400 text-sm">Loading chart data…</div>}

        {!error && bars && indicators && macd && (
          <div className="w-full">
            <div ref={priceRef} className="w-full overflow-hidden" />
            <div className="w-full px-2 pt-1 pb-0 bg-[#0f172a] text-xs text-sky-400 font-semibold tracking-wide">RSI</div>
            <div ref={rsiRef} className="w-full overflow-hidden" />
            <div className="w-full px-2 pt-1 pb-0 bg-[#0f172a] text-xs font-semibold tracking-wide">
              <span className="text-green-400">DI+</span>
              <span className="text-gray-500 mx-1">/</span>
              <span className="text-red-400">DI-</span>
              <span className="text-gray-500 mx-1">/</span>
              <span className="text-amber-400">ADX</span>
              <span className="text-gray-500 ml-1">(DMI)</span>
            </div>
            <div ref={dmiRef} className="w-full overflow-hidden" />
            <div className="w-full px-2 pt-1 pb-0 bg-[#0f172a] text-xs text-blue-400 font-semibold tracking-wide">MACD</div>
            <div ref={macdRef} className="w-full overflow-hidden" />
            <div className="w-full px-2 pt-1 pb-0 bg-[#0f172a] text-xs text-green-400 font-semibold tracking-wide">CMF</div>
            <div ref={cmfRef} className="w-full rounded-b-lg overflow-hidden" />
          </div>
        )}
      </div>
    </div>
  );
}
