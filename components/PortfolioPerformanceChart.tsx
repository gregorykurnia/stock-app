"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ColorType, CrosshairMode, createChart, LineSeries, type Time } from "lightweight-charts";
import {
  buildPerformancePoints,
  type PortfolioBucket,
  type PortfolioSnapshot,
} from "@/lib/portfolioPerformance";

export type PerformanceSeries = "total" | PortfolioBucket;
export type PerformanceCurrency = "idr" | "usd";
export type PerformanceMetric = "value" | "return";

interface Props {
  snapshots: PortfolioSnapshot[];
  currency: PerformanceCurrency;
  metric: PerformanceMetric;
  visibleSeries: Set<PerformanceSeries>;
}

const SERIES: { id: PerformanceSeries; label: string; color: string; width: 1 | 2 | 3 }[] = [
  { id: "total", label: "Total", color: "#4f46e5", width: 3 },
  { id: "longterm", label: "Long Term", color: "#0ea5e9", width: 2 },
  { id: "index", label: "Index", color: "#8b5cf6", width: 2 },
  { id: "swing", label: "Swing", color: "#f59e0b", width: 2 },
];

const LABELS: Record<PerformanceSeries, string> = {
  total: "Total", longterm: "Long Term", index: "Index", swing: "Swing",
};

function snapshotForSeries(snapshot: PortfolioSnapshot, series: PerformanceSeries): PortfolioSnapshot {
  if (series === "total") return snapshot;
  return {
    ...snapshot,
    total: snapshot.buckets[series],
    positions: snapshot.positions.filter((position) => position.bucket === series),
  };
}

function formatMoney(value: number, currency: PerformanceCurrency, compact = false) {
  if (currency === "idr") {
    return new Intl.NumberFormat("id-ID", {
      style: "currency", currency: "IDR", maximumFractionDigits: 0,
      notation: compact ? "compact" : "standard",
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

export default function PortfolioPerformanceChart({ snapshots, currency, metric, visibleSeries }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const snapshotMap = useMemo(() => new Map(snapshots.map((snapshot) => [snapshot.sessionDate, snapshot])), [snapshots]);

  useEffect(() => {
    if (!containerRef.current || snapshots.length === 0) return;
    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 390,
      layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#6b7280" },
      grid: { vertLines: { color: "#f1f1f6" }, horzLines: { color: "#f1f1f6" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#e6e6ee", scaleMargins: { top: 0.15, bottom: 0.12 } },
      timeScale: { borderColor: "#e6e6ee", timeVisible: false },
      localization: {
        priceFormatter: (value: number) => metric === "return"
          ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
          : formatMoney(value, currency, true),
      },
    });

    for (const definition of SERIES) {
      if (!visibleSeries.has(definition.id)) continue;
      const series = chart.addSeries(LineSeries, {
        color: definition.color,
        lineWidth: definition.width,
        title: definition.label,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerRadius: definition.id === "total" ? 5 : 4,
      });

      if (metric === "value") {
        series.setData(snapshots.map((snapshot) => {
          const summary = definition.id === "total" ? snapshot.total : snapshot.buckets[definition.id];
          return {
            time: snapshot.sessionDate as Time,
            value: currency === "idr" ? summary.valueIdr : summary.valueUsd,
          };
        }));
      } else {
        const points = buildPerformancePoints(snapshots.map((snapshot) => snapshotForSeries(snapshot, definition.id)), currency);
        let growth = 1;
        series.setData(points.map((point) => {
          if (point.dailyReturnPct != null) growth *= 1 + point.dailyReturnPct / 100;
          return { time: point.sessionDate as Time, value: (growth - 1) * 100 };
        }));
      }
    }

    chart.timeScale().fitContent();
    chart.subscribeCrosshairMove((param) => {
      setHoveredDate(typeof param.time === "string" ? param.time : null);
    });
    const observer = new ResizeObserver(() => chart.applyOptions({ width: container.clientWidth }));
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [snapshots, currency, metric, visibleSeries]);

  const hovered = hoveredDate ? snapshotMap.get(hoveredDate) : snapshots.at(-1);
  const hoveredIndex = hovered ? snapshots.findIndex((snapshot) => snapshot.sessionDate === hovered.sessionDate) : -1;
  const previous = hoveredIndex > 0 ? snapshots[hoveredIndex - 1] : null;
  const changePct = hovered && previous && previous.total.valueUsd > 0
    ? ((hovered.total.valueUsd / previous.total.valueUsd) - 1) * 100
    : null;

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full min-h-[390px]" />
      {hovered && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-xl border border-[var(--border)] bg-white/95 px-3 py-2 shadow-[var(--shadow-md)] backdrop-blur-sm">
          <div className="text-xs font-semibold text-gray-900">{hovered.sessionDate}</div>
          <div className="mt-1 text-sm font-bold text-indigo-600">{formatMoney(currency === "idr" ? hovered.total.valueIdr : hovered.total.valueUsd, currency)}</div>
          <div className="mt-0.5 text-[11px] text-gray-500">
            {formatMoney(hovered.total.valueUsd, "usd")} · Rp{hovered.fxRateUsdIdr.toLocaleString("id-ID")}/USD
          </div>
          {changePct != null && <div className={`mt-1 text-xs font-semibold ${changePct >= 0 ? "text-green-600" : "text-red-500"}`}>{changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}% value change</div>}
          <div className="mt-2 grid grid-cols-3 gap-3 border-t border-gray-100 pt-1.5 text-[10px] text-gray-500">
            {(["longterm", "index", "swing"] as PortfolioBucket[]).map((bucket) => (
              <div key={bucket}><span className="block">{LABELS[bucket]}</span><strong className="font-semibold text-gray-700">{formatMoney(currency === "idr" ? hovered.buckets[bucket].valueIdr : hovered.buckets[bucket].valueUsd, currency, true)}</strong></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
