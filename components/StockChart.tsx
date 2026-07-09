"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
} from "lightweight-charts";
import type { OHLCVBar, Indicators } from "@/lib/types";

interface Props {
  bars: OHLCVBar[];
  indicators: Indicators;
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

export default function StockChart({ bars, indicators }: Props) {
  const priceRef = useRef<HTMLDivElement>(null);
  const obvRef = useRef<HTMLDivElement>(null);
  const cmfRef = useRef<HTMLDivElement>(null);
  const dmiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!priceRef.current || !obvRef.current || !cmfRef.current || !dmiRef.current || bars.length === 0) return;

    const w = priceRef.current.clientWidth;
    const times = bars.map((b) => b.time as import("lightweight-charts").Time);

    // --- Price chart ---
    const priceChart = createChart(priceRef.current, { ...CHART_OPTIONS(w), height: 360 });

    const candleSeries = priceChart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeries.setData(
      bars.map((b) => ({ time: b.time as import("lightweight-charts").Time, open: b.open, high: b.high, low: b.low, close: b.close }))
    );

    const ema20Series = priceChart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2, title: "EMA20" });
    ema20Series.setData(
      bars.map((b, i) => ({ time: times[i], value: indicators.ema20[i] })).filter((d) => !isNaN(d.value))
    );

    const ema50Series = priceChart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 2, title: "EMA50" });
    ema50Series.setData(
      bars.map((b, i) => ({ time: times[i], value: indicators.ema50[i] })).filter((d) => !isNaN(d.value))
    );

    priceChart.timeScale().fitContent();

    // --- OBV chart ---
    const obvChart = createChart(obvRef.current, { ...CHART_OPTIONS(w), height: 160 });
    const obvSeries = obvChart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 2, title: "OBV" });
    obvSeries.setData(
      bars.map((b, i) => ({ time: times[i], value: indicators.obv[i] })).filter((d) => !isNaN(d.value))
    );
    obvChart.timeScale().fitContent();

    // --- CMF chart ---
    const cmfChart = createChart(cmfRef.current, { ...CHART_OPTIONS(w), height: 140 });

    // Zero line
    const zeroSeries = cmfChart.addSeries(LineSeries, { color: "#475569", lineWidth: 1, lineStyle: 2 });
    zeroSeries.setData(bars.map((b, i) => ({ time: times[i], value: 0 })));

    const cmfSeries = cmfChart.addSeries(HistogramSeries, {
      color: "#22c55e",
      priceFormat: { type: "price", precision: 3, minMove: 0.001 },
    });
    cmfSeries.setData(
      bars
        .map((b, i) => ({
          time: times[i],
          value: indicators.cmf[i],
          color: indicators.cmf[i] >= 0 ? "#22c55e" : "#ef4444",
        }))
        .filter((d) => !isNaN(d.value))
    );
    cmfChart.timeScale().fitContent();

    // --- DMI chart (ADX + DI+ + DI-) ---
    const dmiChart = createChart(dmiRef.current, { ...CHART_OPTIONS(w), height: 160 });

    const diPlusSeries = dmiChart.addSeries(LineSeries, { color: "#22c55e", lineWidth: 2, title: "DI+" });
    diPlusSeries.setData(
      bars.map((b, i) => ({ time: times[i], value: indicators.diPlus[i] })).filter((d) => !isNaN(d.value))
    );

    const diMinusSeries = dmiChart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 2, title: "DI-" });
    diMinusSeries.setData(
      bars.map((b, i) => ({ time: times[i], value: indicators.diMinus[i] })).filter((d) => !isNaN(d.value))
    );

    const adxSeries = dmiChart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 2, lineStyle: 1, title: "ADX" });
    adxSeries.setData(
      bars.map((b, i) => ({ time: times[i], value: indicators.adx[i] })).filter((d) => !isNaN(d.value))
    );

    dmiChart.timeScale().fitContent();

    // Sync time scales
    const charts = [priceChart, obvChart, cmfChart, dmiChart];
    charts.forEach((chart) => {
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) charts.forEach((c) => { if (c !== chart) c.timeScale().setVisibleLogicalRange(range); });
      });
    });

    const handleResize = () => {
      const nw = priceRef.current?.clientWidth ?? w;
      priceChart.applyOptions({ width: nw });
      obvChart.applyOptions({ width: nw });
      cmfChart.applyOptions({ width: nw });
      dmiChart.applyOptions({ width: nw });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      priceChart.remove();
      obvChart.remove();
      cmfChart.remove();
      dmiChart.remove();
    };
  }, [bars, indicators]);

  return (
    <div className="w-full space-y-0">
      <div ref={priceRef} className="w-full rounded-t-lg overflow-hidden" />
      <div className="w-full px-2 pt-1 pb-0 bg-[#0f172a] text-xs text-violet-400 font-semibold tracking-wide">OBV</div>
      <div ref={obvRef} className="w-full overflow-hidden" />
      <div className="w-full px-2 pt-1 pb-0 bg-[#0f172a] text-xs text-green-400 font-semibold tracking-wide">CMF</div>
      <div ref={cmfRef} className="w-full overflow-hidden" />
      <div className="w-full px-2 pt-1 pb-0 bg-[#0f172a] text-xs font-semibold tracking-wide">
        <span className="text-green-400">DI+</span>
        <span className="text-gray-500 mx-1">/</span>
        <span className="text-red-400">DI-</span>
        <span className="text-gray-500 mx-1">/</span>
        <span className="text-amber-400">ADX</span>
        <span className="text-gray-500 ml-1">(DMI)</span>
      </div>
      <div ref={dmiRef} className="w-full rounded-b-lg overflow-hidden" />
    </div>
  );
}
