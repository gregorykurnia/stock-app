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

  useEffect(() => {
    if (!priceRef.current || !obvRef.current || !cmfRef.current || bars.length === 0) return;

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

    // Sync time scales
    priceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) {
        obvChart.timeScale().setVisibleLogicalRange(range);
        cmfChart.timeScale().setVisibleLogicalRange(range);
      }
    });
    obvChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) {
        priceChart.timeScale().setVisibleLogicalRange(range);
        cmfChart.timeScale().setVisibleLogicalRange(range);
      }
    });
    cmfChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) {
        priceChart.timeScale().setVisibleLogicalRange(range);
        obvChart.timeScale().setVisibleLogicalRange(range);
      }
    });

    const handleResize = () => {
      const nw = priceRef.current?.clientWidth ?? w;
      priceChart.applyOptions({ width: nw });
      obvChart.applyOptions({ width: nw });
      cmfChart.applyOptions({ width: nw });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      priceChart.remove();
      obvChart.remove();
      cmfChart.remove();
    };
  }, [bars, indicators]);

  return (
    <div className="w-full space-y-0">
      <div ref={priceRef} className="w-full rounded-t-lg overflow-hidden" />
      <div className="w-full px-2 pt-1 pb-0 bg-[#0f172a] text-xs text-violet-400 font-semibold tracking-wide">OBV</div>
      <div ref={obvRef} className="w-full overflow-hidden" />
      <div className="w-full px-2 pt-1 pb-0 bg-[#0f172a] text-xs text-green-400 font-semibold tracking-wide">CMF</div>
      <div ref={cmfRef} className="w-full rounded-b-lg overflow-hidden" />
    </div>
  );
}
