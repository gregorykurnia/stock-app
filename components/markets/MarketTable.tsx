"use client";

import { useMemo, useState } from "react";
import { INSTRUMENT_BY_ID } from "@/lib/markets/instruments";
import { formatChangeCell, formatDateShort, formatLatest, formatPosition52w, instrumentTypeLabel, trendArrow, trendLabel } from "@/lib/markets/format";
import type { MarketInstrument } from "@/lib/markets/types";

type SortKey = "name" | "price" | "changePct" | "return1w" | "return1m" | "returnYtd" | "position52w" | "trend" | "timestamp";

interface Props {
  instruments: MarketInstrument[];
  onSelect: (instrument: MarketInstrument) => void;
}

const COLUMNS: Array<{ key: SortKey; label: string; align?: "left" | "right" }> = [
  { key: "name", label: "Instrument", align: "left" },
  { key: "price", label: "Latest" },
  { key: "changePct", label: "1D" },
  { key: "return1w", label: "1W" },
  { key: "return1m", label: "1M" },
  { key: "returnYtd", label: "YTD" },
  { key: "position52w", label: "52W position" },
  { key: "trend", label: "Trend" },
  { key: "timestamp", label: "Updated" },
];

function valueClass(value: number | null) {
  if (value == null || value === 0) return "text-gray-500";
  return value > 0 ? "text-green-600" : "text-red-500";
}

function periodDisplay(instrument: MarketInstrument, value: number | null) {
  if (instrument.instrumentType !== "yield") return formatChangeCell(instrument, value);
  if (value == null || instrument.price == null || value <= -100) return "—";
  const prior = instrument.price / (1 + value / 100);
  return formatChangeCell(instrument, instrument.price - prior);
}

export default function MarketTable({ instruments, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [descending, setDescending] = useState(true);
  const rows = useMemo(() => {
    if (!sortKey) return instruments;
    return [...instruments].sort((a, b) => {
      const av = sortKey === "name" ? a.shortName : a[sortKey];
      const bv = sortKey === "name" ? b.shortName : b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return descending ? -comparison : comparison;
    });
  }, [instruments, sortKey, descending]);

  function changeSort(key: SortKey) {
    if (sortKey === key) setDescending((value) => !value);
    else { setSortKey(key); setDescending(key !== "name"); }
  }

  return (
    <div className="overflow-x-auto rounded-b-2xl">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-gray-50/80 text-[11px] uppercase tracking-wide text-gray-500">
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" aria-sort={sortKey === column.key ? (descending ? "descending" : "ascending") : "none"}
                className={`${column.align === "left" ? "text-left sticky left-0 z-10 bg-gray-50" : "text-right"} px-4 py-3 font-semibold`}>
                <button className="inline-flex items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={() => changeSort(column.key)}>
                  {column.label}<span aria-hidden="true" className="text-[9px]">{sortKey === column.key ? (descending ? "▼" : "▲") : "↕"}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((instrument) => {
            const definition = INSTRUMENT_BY_ID[instrument.id];
            return (
              <tr key={instrument.id} tabIndex={0} role="button" onClick={() => onSelect(instrument)} onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(instrument); }
              }} className="group cursor-pointer border-b border-gray-100 last:border-0 hover:bg-indigo-50/40 focus:outline-none focus-visible:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500">
                <td className="sticky left-0 z-[1] bg-white px-4 py-3 group-hover:bg-[#f8f8ff] group-focus-visible:bg-indigo-50">
                  <div className="font-semibold text-gray-900">{instrument.shortName}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                    <span>{instrument.symbol}</span><span>·</span><span>{instrumentTypeLabel(instrument.instrumentType)}</span>
                  </div>
                  {definition?.quoteDirectionNote && <div className="mt-1 max-w-[260px] text-[10px] text-gray-400">{definition.quoteDirectionNote}</div>}
                </td>
                <td className="px-4 py-3 text-right"><div className="font-mono font-semibold text-gray-900">{formatLatest(instrument, definition?.decimals ?? 2)}</div><div className="text-[10px] text-gray-400">{instrument.unit}</div></td>
                <td className={`px-4 py-3 text-right font-mono font-semibold ${valueClass(instrument.changePct)}`}>{formatChangeCell(instrument, instrument.instrumentType === "yield" ? instrument.change : instrument.changePct)}</td>
                <td className={`px-4 py-3 text-right font-mono ${valueClass(instrument.return1w)}`}>{periodDisplay(instrument, instrument.return1w)}</td>
                <td className={`px-4 py-3 text-right font-mono ${valueClass(instrument.return1m)}`}>{periodDisplay(instrument, instrument.return1m)}</td>
                <td className={`px-4 py-3 text-right font-mono ${valueClass(instrument.returnYtd)}`}>{periodDisplay(instrument, instrument.returnYtd)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="ml-auto flex w-24 items-center justify-end gap-2"><div className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, instrument.position52w ?? 0))}%` }} /></div><span className="w-8 font-mono text-xs text-gray-600">{formatPosition52w(instrument.position52w)}</span></div>
                </td>
                <td className="px-4 py-3 text-right"><span className={`inline-flex items-center gap-1 font-medium ${instrument.trend === "rising" ? "text-green-600" : instrument.trend === "falling" ? "text-red-500" : "text-gray-500"}`}><span aria-hidden="true">{trendArrow(instrument.trend)}</span>{trendLabel(instrument.trend)}</span></td>
                <td className="px-4 py-3 text-right text-xs text-gray-500">{formatDateShort(instrument.timestamp)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
