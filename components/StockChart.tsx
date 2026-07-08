"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
} from "lightweight-charts";
import type { OHLCVBar, Indicators } from "@/lib/types";

interface Props {
  bars: OHLCVBar[];
  indicators: Indicators;
}

export default function StockChart({ bars, indicators }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0f172a" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      width: containerRef.current.clientWidth,
      height: 400,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    candleSeries.setData(
      bars.map((b) => ({
        time: b.time as import("lightweight-charts").Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    );

    const ema20Series = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
      title: "EMA20",
    });
    ema20Series.setData(
      bars
        .map((b, i) => ({ time: b.time as import("lightweight-charts").Time, value: indicators.ema20[i] }))
        .filter((d) => !isNaN(d.value))
    );

    const ema50Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
      title: "EMA50",
    });
    ema50Series.setData(
      bars
        .map((b, i) => ({ time: b.time as import("lightweight-charts").Time, value: indicators.ema50[i] }))
        .filter((d) => !isNaN(d.value))
    );

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [bars, indicators]);

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />;
}
