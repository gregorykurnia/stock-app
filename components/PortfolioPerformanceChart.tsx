"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
  LineSeries,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { PortfolioActivityRow } from "@/lib/portfolioActivity";
import type { LedgerTransaction } from "@/lib/portfolioLedger";
import {
  buildPerformancePoints,
  emptySnapshotBucket,
  snapshotBucketValueIdr,
  snapshotBucketValueUsd,
  snapshotTotalValueIdr,
  snapshotTotalValueUsd,
  type PortfolioBucket,
  type PortfolioSnapshot,
} from "@/lib/portfolioPerformance";
import {
  PORTFOLIO_BUCKET_COLORS,
  PORTFOLIO_BUCKET_DEFINITIONS,
  PORTFOLIO_BUCKET_LABELS,
  PORTFOLIO_BUCKETS,
} from "@/lib/portfolioBuckets";

export type PerformanceSeries = "total" | PortfolioBucket;
export type PerformanceCurrency = "idr" | "usd";
export type PerformanceMetric = "value" | "return";

interface Props {
  snapshots: PortfolioSnapshot[];
  openingSnapshot?: PortfolioSnapshot;
  activityRows?: PortfolioActivityRow[];
  ledgerTransactions?: readonly LedgerTransaction[];
  currency: PerformanceCurrency;
  metric: PerformanceMetric;
  visibleSeries: Set<PerformanceSeries>;
}

const SERIES: { id: PerformanceSeries; label: string; color: string; width: 1 | 2 | 3 }[] = [
  { id: "total", label: "Total", color: "#4f46e5", width: 3 },
  ...PORTFOLIO_BUCKET_DEFINITIONS.map(({ id, label }) => ({
    id,
    label,
    color: PORTFOLIO_BUCKET_COLORS[id],
    width: 2 as const,
  })),
];

const LABELS: Record<PerformanceSeries, string> = {
  total: "Total", ...PORTFOLIO_BUCKET_LABELS,
};

const ACTIVITY_MARKER_STYLES: Record<PortfolioActivityRow["type"], { color: string; shape: "circle" | "square" | "arrowUp" | "arrowDown"; label: string }> = {
  deposit: { color: "#16a34a", shape: "arrowUp", label: "D" },
  withdrawal: { color: "#dc2626", shape: "arrowDown", label: "W" },
  buy: { color: "#2563eb", shape: "arrowUp", label: "B" },
  sell: { color: "#ea580c", shape: "arrowDown", label: "S" },
  transfer: { color: "#7c3aed", shape: "square", label: "T" },
  dividend: { color: "#0891b2", shape: "circle", label: "Div" },
  fee: { color: "#be123c", shape: "arrowDown", label: "F" },
  fx_conversion: { color: "#64748b", shape: "square", label: "FX" },
  opening_balance: { color: "#4f46e5", shape: "circle", label: "O" },
  reconciliation_adjustment: { color: "#ca8a04", shape: "square", label: "R" },
};

function activityMarkers(rows: readonly PortfolioActivityRow[], snapshots: readonly PortfolioSnapshot[]): SeriesMarker<Time>[] {
  const visibleDates = new Set(snapshots.map((snapshot) => snapshot.sessionDate));
  const byDate = new Map<string, PortfolioActivityRow[]>();
  for (const row of rows) {
    const date = row.occurredAt.slice(0, 10);
    if (!visibleDates.has(date)) continue;
    const current = byDate.get(date) ?? [];
    current.push(row);
    byDate.set(date, current);
  }

  return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, dateRows]) => {
    const first = ACTIVITY_MARKER_STYLES[dateRows[0].type];
    const multiple = dateRows.length > 1;
    return {
      id: `activity-${date}`,
      time: date as Time,
      position: "aboveBar",
      shape: multiple ? "circle" : first.shape,
      color: multiple ? "#4f46e5" : first.color,
      text: multiple ? String(dateRows.length) : first.label,
      size: multiple ? 1.5 : 1,
    };
  });
}

function snapshotForSeries(snapshot: PortfolioSnapshot, series: PerformanceSeries): PortfolioSnapshot {
  if (series === "total") return snapshot;
  return {
    ...snapshot,
    total: snapshot.buckets[series] ?? emptySnapshotBucket(),
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

export default function PortfolioPerformanceChart({ snapshots, openingSnapshot, activityRows = [], ledgerTransactions, currency, metric, visibleSeries }: Props) {
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

    const renderedSeries = new Map<PerformanceSeries, ReturnType<typeof chart.addSeries>>();
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
      renderedSeries.set(definition.id, series);

      if (metric === "value") {
        series.setData(snapshots.map((snapshot) => {
          const summary = definition.id === "total" ? snapshot.total : snapshot.buckets[definition.id] ?? emptySnapshotBucket();
          return {
            time: snapshot.sessionDate as Time,
            value: currency === "idr" ? snapshotBucketValueIdr(summary) : snapshotBucketValueUsd(summary),
          };
        }));
      } else {
        const points = buildPerformancePoints(
          snapshots.map((snapshot) => snapshotForSeries(snapshot, definition.id)),
          currency,
          {
            openingSnapshot: openingSnapshot ? snapshotForSeries(openingSnapshot, definition.id) : undefined,
            ledgerTransactions,
            bucket: definition.id === "total" ? undefined : definition.id,
          },
        );
        let growth = 1;
        series.setData(points.map((point) => {
          if (point.returnStatus === "baseline") return { time: point.sessionDate as Time, value: 0 };
          if (point.dailyReturnPct == null) return { time: point.sessionDate as Time };
          growth *= 1 + point.dailyReturnPct / 100;
          return { time: point.sessionDate as Time, value: (growth - 1) * 100 };
        }));
      }
    }

    const markerSeries = renderedSeries.get("total") ?? renderedSeries.get(SERIES.find((definition) => visibleSeries.has(definition.id))?.id ?? "total");
    if (markerSeries && activityRows.length > 0) {
      createSeriesMarkers(markerSeries, activityMarkers(activityRows, snapshots));
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
  }, [snapshots, openingSnapshot, activityRows, ledgerTransactions, currency, metric, visibleSeries]);

  const hovered = hoveredDate ? snapshotMap.get(hoveredDate) : snapshots.at(-1);
  const hoveredIndex = hovered ? snapshots.findIndex((snapshot) => snapshot.sessionDate === hovered.sessionDate) : -1;
  const previous = hoveredIndex > 0 ? snapshots[hoveredIndex - 1] : openingSnapshot ?? null;
  const performancePoints = useMemo(() => buildPerformancePoints(snapshots, currency, { openingSnapshot, ledgerTransactions }), [snapshots, currency, openingSnapshot, ledgerTransactions]);
  const performancePoint = hovered ? performancePoints.find((point) => point.sessionDate === hovered.sessionDate) : undefined;
  const changePct = hovered && previous && snapshotTotalValueUsd(previous) > 0
    ? ((snapshotTotalValueUsd(hovered) / snapshotTotalValueUsd(previous)) - 1) * 100
    : null;

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full min-h-[390px]" />
      {hovered && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-xl border border-[var(--border)] bg-white/95 px-3 py-2 shadow-[var(--shadow-md)] backdrop-blur-sm">
          <div className="text-xs font-semibold text-gray-900">{hovered.sessionDate}</div>
          <div className="mt-1 text-sm font-bold text-indigo-600">{formatMoney(currency === "idr" ? snapshotTotalValueIdr(hovered) : snapshotTotalValueUsd(hovered), currency)}</div>
          <div className="mt-0.5 text-[11px] text-gray-500">
            {formatMoney(snapshotTotalValueUsd(hovered), "usd")} · Rp{hovered.fxRateUsdIdr.toLocaleString("id-ID")}/USD
          </div>
          {changePct != null && <div className={`mt-1 text-xs font-semibold ${changePct >= 0 ? "text-green-600" : "text-red-500"}`}>{changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}% equity change</div>}
          {performancePoint && <div className="mt-1 text-[11px] text-gray-500">Investment return: {performancePoint.returnStatus === "suppressed" ? "suppressed" : performancePoint.dailyReturnPct == null ? "baseline" : `${performancePoint.dailyReturnPct >= 0 ? "+" : ""}${performancePoint.dailyReturnPct.toFixed(2)}%`} · external flow {formatMoney(currency === "idr" ? performancePoint.inferredFlowIdr : performancePoint.inferredFlowUsd, currency)}</div>}
          <div className="mt-2 grid grid-cols-2 gap-3 border-t border-gray-100 pt-1.5 text-[10px] text-gray-500 sm:grid-cols-4">
            {PORTFOLIO_BUCKETS.map((bucket) => (
              <div key={bucket}><span className="block">{LABELS[bucket]}</span><strong className="font-semibold text-gray-700">{formatMoney(currency === "idr" ? snapshotBucketValueIdr(hovered.buckets[bucket] ?? emptySnapshotBucket()) : snapshotBucketValueUsd(hovered.buckets[bucket] ?? emptySnapshotBucket()), currency, true)}</strong></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
