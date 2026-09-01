"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PortfolioDivision } from "@/lib/firestore";

export interface PortfolioStock {
  ticker: string;
  name: string | null;
  industry: string | null;
  entry_price: number | null;
  entry_value: number | null;
}

export const PORTFOLIO_DIVISIONS: { id: PortfolioDivision; label: string }[] = [
  { id: "longterm", label: "Long Term" },
  { id: "index", label: "Index" },
  { id: "swing", label: "Swing" },
];

type SortKey = "ticker" | "industry" | "price" | "priceChangePct" | "entryPrice" | "entryValue" | "totalPct" | "unrealized";
type SortDir = "asc" | "desc";

interface Props {
  division: PortfolioDivision;
  stocks: PortfolioStock[];
  prices: Record<string, number | null>;
  prevCloses: Record<string, number | null>;
  loading?: boolean;
  addTicker?: string;
  addLoading?: boolean;
  addError?: string;
  onAddTickerChange?: (v: string) => void;
  onAdd?: (e: FormEvent) => void;
  onRemove?: (ticker: string) => void;
  onEntryChange?: (ticker: string, field: "entry_price" | "entry_value", value: number | null) => void;
}

const dash = <span className="text-gray-400">—</span>;

// Editable number cell — local text state so the user can type freely (including "", "-", "1.")
// without the parent's parsed number bouncing the input; commits (and clears on blur if invalid) onBlur.
function EditableNumberCell({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState(value != null ? String(value) : "");

  useEffect(() => {
    setText(value != null ? String(value) : "");
  }, [value]);

  function commit() {
    const trimmed = text.trim();
    if (trimmed === "") {
      if (value != null) onCommit(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!isNaN(parsed) && parsed !== value) onCommit(parsed);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder="—"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      onClick={(e) => e.stopPropagation()}
      className="w-20 bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-400 focus:bg-white rounded px-1.5 py-0.5 text-sm text-gray-900 outline-none"
    />
  );
}

export default function PortfolioTable({
  division, stocks, prices, prevCloses, loading = false,
  addTicker = "", addLoading = false, addError = "", onAddTickerChange, onAdd, onRemove, onEntryChange,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "ticker" || key === "industry" ? "asc" : "desc"); }
  }

  const rows = useMemo(() => {
    return stocks.map((s) => {
      const price = prices[s.ticker] ?? null;
      const prevClose = prevCloses[s.ticker] ?? null;
      const priceChangePct = price != null && prevClose != null && prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : null;
      const totalPct = price != null && s.entry_price != null && s.entry_price > 0 ? ((price - s.entry_price) / s.entry_price) * 100 : null;
      const unrealized = totalPct != null && s.entry_value != null ? (totalPct / 100) * s.entry_value : null;
      return { ...s, price, priceChangePct, totalPct, unrealized };
    });
  }, [stocks, prices, prevCloses]);

  const sortedRows = useMemo(() => {
    const getVal = (r: (typeof rows)[number]): number | string | null => {
      switch (sortKey) {
        case "ticker": return r.ticker;
        case "industry": return r.industry;
        case "price": return r.price;
        case "priceChangePct": return r.priceChangePct;
        case "entryPrice": return r.entry_price;
        case "entryValue": return r.entry_value;
        case "totalPct": return r.totalPct;
        case "unrealized": return r.unrealized;
        default: return null;
      }
    };
    const data = [...rows];
    data.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return data;
  }, [rows, sortKey, sortDir]);

  const totals = useMemo(() => {
    const entryValue = rows.reduce((sum, r) => sum + (r.entry_value ?? 0), 0);
    const unrealized = rows.reduce((sum, r) => sum + (r.unrealized ?? 0), 0);
    return { entryValue, unrealized };
  }, [rows]);

  const Th = ({ label, k, title }: { label: string; k: SortKey; title?: string }) => (
    <th
      title={title}
      className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 whitespace-nowrap select-none"
      onClick={() => toggleSort(k)}
    >
      {label}{sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={onAdd} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. TSLA"
            value={addTicker}
            onChange={(e) => onAddTickerChange?.(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 w-32 uppercase"
          />
          <button
            type="submit"
            disabled={addLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm font-semibold"
          >
            {addLoading ? "Adding…" : "+ Add"}
          </button>
        </form>
        {addError && <span className="text-xs text-red-500">{addError}</span>}
        {loading && <span className="text-xs text-gray-400 animate-pulse">Loading…</span>}
        <span className="text-xs text-gray-400 ml-auto">{sortedRows.length} position{sortedRows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-[72vh] rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <Th label="Ticker" k="ticker" />
              <Th label="Industry" k="industry" />
              <Th label="Price" k="price" />
              <Th label="Chg %" k="priceChangePct" title="% change vs previous close" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Entry Price</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Entry Value</th>
              <Th label="Total %" k="totalPct" title="% change from entry price to current price" />
              <Th label="Unrealized" k="unrealized" title="Unrealized gain/loss in $, based on entry value" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400 text-sm">No positions in {PORTFOLIO_DIVISIONS.find((d) => d.id === division)?.label} yet — add one above.</td></tr>
            )}
            {sortedRows.map((r) => (
              <tr key={r.ticker} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <div className="font-semibold text-gray-900">{r.ticker}</div>
                  {r.name && <div className="text-xs text-gray-400">{r.name}</div>}
                </td>
                <td className="px-3 py-2 text-gray-600">{r.industry}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{r.price != null ? `$${r.price.toFixed(2)}` : dash}</td>
                <td className={`px-3 py-2 font-medium ${r.priceChangePct == null ? "text-gray-400" : r.priceChangePct >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {r.priceChangePct != null ? `${r.priceChangePct >= 0 ? "+" : ""}${r.priceChangePct.toFixed(2)}%` : dash}
                </td>
                <td className="px-3 py-2">
                  <EditableNumberCell value={r.entry_price} onCommit={(v) => onEntryChange?.(r.ticker, "entry_price", v)} />
                </td>
                <td className="px-3 py-2">
                  <EditableNumberCell value={r.entry_value} onCommit={(v) => onEntryChange?.(r.ticker, "entry_value", v)} />
                </td>
                <td className={`px-3 py-2 font-medium ${r.totalPct == null ? "text-gray-400" : r.totalPct >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {r.totalPct != null ? `${r.totalPct >= 0 ? "+" : ""}${r.totalPct.toFixed(1)}%` : dash}
                </td>
                <td className={`px-3 py-2 font-medium ${r.unrealized == null ? "text-gray-400" : r.unrealized >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {r.unrealized != null ? `${r.unrealized >= 0 ? "+" : "-"}$${Math.abs(r.unrealized).toFixed(2)}` : dash}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => onRemove?.(r.ticker)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {sortedRows.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td className="px-3 py-2 font-semibold text-gray-700" colSpan={5}>Total</td>
                <td className="px-3 py-2 font-semibold text-gray-900">${totals.entryValue.toFixed(2)}</td>
                <td></td>
                <td className={`px-3 py-2 font-semibold ${totals.unrealized >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {totals.unrealized >= 0 ? "+" : "-"}${Math.abs(totals.unrealized).toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
