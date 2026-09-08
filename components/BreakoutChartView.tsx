"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { calcIndicators, macdSeriesFull } from "@/lib/indicators";
import type { OHLCVBar, Indicators } from "@/lib/types";

interface Props {
  ticker: string;
}

const AXIS_WIDTH = 72;

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
  rightPriceScale: { borderColor: "#1e293b", minimumWidth: AXIS_WIDTH },
  crosshair: {
    vertLine: { labelBackgroundColor: "#334155" },
    horzLine: { labelBackgroundColor: "#334155" },
  },
});

const fmt = (v: number | null | undefined, dec = 2) =>
  v == null || isNaN(v) ? "—" : v.toFixed(dec);

interface Legend {
  date: string;
  price: number | null;
  ema20: number | null;
  ema50: number | null;
  rsi: number | null;
  diPlus: number | null;
  diMinus: number | null;
  adx: number | null;
  macd: number | null;
  signal: number | null;
  hist: number | null;
  cmf: number | null;
}

export default function BreakoutChartView({ ticker }: Props) {
  const [bars, setBars] = useState<OHLCVBar[] | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [macd, setMacd] = useState<{ macd: number[]; signal: number[]; hist: number[] } | null>(null);
  const [error, setError] = useState("");
  const [legend, setLegend] = useState<Legend | null>(null);

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
    const timeIndex = new Map<number, number>(bars.map((b, i) => [b.time, i]));

    const priceChart = createChart(priceRef.current, { ...CHART_OPTIONS(w), height: 360 });
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
    const rsiChart = createChart(rsiRef.current, { ...CHART_OPTIONS(w), height: 160 });
    const rsi70 = rsiChart.addSeries(LineSeries, { color: "#475569", lineWidth: 1, lineStyle: 2 });
    rsi70.setData(bars.map((_, i) => ({ time: times[i], value: 70 })));
    const rsi30 = rsiChart.addSeries(LineSeries, { color: "#475569", lineWidth: 1, lineStyle: 2 });
    rsi30.setData(bars.map((_, i) => ({ time: times[i], value: 30 })));
    const rsiSeries = rsiChart.addSeries(LineSeries, { color: "#38bdf8", lineWidth: 2, title: "RSI" });
    rsiSeries.setData(bars.map((b, i) => ({ time: times[i], value: indicators.rsi[i] })).filter((d) => !isNaN(d.value)));
    rsiChart.timeScale().fitContent();

    // DMI (DI+/DI-/ADX)
    const dmiChart = createChart(dmiRef.current, { ...CHART_OPTIONS(w), height: 160 });
    const diPlusSeries = dmiChart.addSeries(LineSeries, { color: "#22c55e", lineWidth: 2, title: "DI+" });
    diPlusSeries.setData(bars.map((b, i) => ({ time: times[i], value: indicators.diPlus[i] })).filter((d) => !isNaN(d.value)));
    const diMinusSeries = dmiChart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 2, title: "DI-" });
    diMinusSeries.setData(bars.map((b, i) => ({ time: times[i], value: indicators.diMinus[i] })).filter((d) => !isNaN(d.value)));
    const adxSeries = dmiChart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 2, lineStyle: 1, title: "ADX" });
    adxSeries.setData(bars.map((b, i) => ({ time: times[i], value: indicators.adx[i] })).filter((d) => !isNaN(d.value)));
    dmiChart.timeScale().fitContent();

    // MACD
    const macdChart = createChart(macdRef.current, { ...CHART_OPTIONS(w), height: 160 });
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
    const cmfChart = createChart(cmfRef.current, { ...CHART_OPTIONS(w), height: 160 });
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
    const primarySeries: ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> = candleSeries;

    // Sync visible time range across all panes
    let syncing = false;
    charts.forEach((chart) => {
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (!range || syncing) return;
        syncing = true;
        charts.forEach((c) => { if (c !== chart) c.timeScale().setVisibleLogicalRange(range); });
        syncing = false;
      });
    });

    // Sync crosshair across all panes + build legend from hovered bar
    let movingCrosshair = false;
    const updateLegend = (idx: number | null) => {
      if (idx == null) { setLegend(null); return; }
      const b = bars[idx];
      setLegend({
        date: new Date(b.time * 1000).toISOString().slice(0, 10),
        price: b.close,
        ema20: indicators.ema20[idx],
        ema50: indicators.ema50[idx],
        rsi: indicators.rsi[idx],
        diPlus: indicators.diPlus[idx],
        diMinus: indicators.diMinus[idx],
        adx: indicators.adx[idx],
        macd: macd.macd[idx],
        signal: macd.signal[idx],
        hist: macd.hist[idx],
        cmf: indicators.cmf[idx],
      });
    };

    charts.forEach((chart, chartIdx) => {
      chart.subscribeCrosshairMove((param) => {
        if (movingCrosshair) return;
        if (!param.time) {
          updateLegend(null);
          return;
        }
        const idx = timeIndex.get(param.time as number);
        if (idx == null) return;
        updateLegend(idx);
        movingCrosshair = true;
        charts.forEach((c, i) => {
          if (i === chartIdx) return;
          const series = i === 0 ? primarySeries : (c === rsiChart ? rsiSeries : c === dmiChart ? diPlusSeries : c === macdChart ? macdLineSeries : cmfSeries);
          c.setCrosshairPosition(0, param.time as Time, series);
        });
        movingCrosshair = false;
      });
    });

    // Default legend = latest bar
    updateLegend(bars.length - 1);

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
    <div className="w-full">
      {error && <div className="p-6 text-red-400 text-sm">{error}</div>}
      {!error && !bars && <div className="p-6 text-slate-400 text-sm">Loading chart data…</div>}

      {!error && bars && indicators && macd && (
        <div className="w-full">
          <div className="w-full px-3 py-2 bg-[#0f172a] border-b border-slate-700 flex flex-wrap gap-x-6 gap-y-1 text-xs font-mono">
            <span className="text-slate-300 font-semibold">{legend?.date ?? "—"}</span>
            <span className="text-slate-200">Price <b>{fmt(legend?.price)}</b></span>
            <span className="text-blue-400">EMA20 <b>{fmt(legend?.ema20)}</b></span>
            <span className="text-amber-400">EMA50 <b>{fmt(legend?.ema50)}</b></span>
            <span className="text-sky-400">RSI <b>{fmt(legend?.rsi, 1)}</b></span>
            <span className="text-green-400">DI+ <b>{fmt(legend?.diPlus, 1)}</b></span>
            <span className="text-red-400">DI- <b>{fmt(legend?.diMinus, 1)}</b></span>
            <span className="text-amber-400">ADX <b>{fmt(legend?.adx, 1)}</b></span>
            <span className="text-blue-400">MACD <b>{fmt(legend?.macd, 3)}</b></span>
            <span className="text-amber-400">Signal <b>{fmt(legend?.signal, 3)}</b></span>
            <span className={(legend?.hist ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>Hist <b>{fmt(legend?.hist, 3)}</b></span>
            <span className={(legend?.cmf ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>CMF <b>{fmt(legend?.cmf, 3)}</b></span>
          </div>

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
          <div ref={cmfRef} className="w-full overflow-hidden" />
        </div>
      )}
    </div>
  );
}
