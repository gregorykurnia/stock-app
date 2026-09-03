"use client";

import type { FormEvent } from "react";
import { downloadCsv } from "@/lib/exportCsv";

export interface BaggerStock {
  ticker: string;
  name: string | null;
  industry: string | null;
  addedAt?: string | null;
}

interface Props {
  stocks: BaggerStock[];
  prices: Record<string, number | null>;
  loading?: boolean;
  addTicker: string;
  addLoading: boolean;
  addError: string;
  onAddTickerChange: (v: string) => void;
  onAdd: (e: FormEvent) => void;
  onRemove: (ticker: string) => void;
  onMoveToExcluded: (ticker: string) => void;
}

const dash = <span className="text-gray-400">—</span>;

export default function BaggerReversalTable({
  stocks, prices, loading, addTicker, addLoading, addError, onAddTickerChange, onAdd, onRemove, onMoveToExcluded,
}: Props) {
  function exportCsv() {
    const date = new Date().toISOString().slice(0, 10);
    const headers = ["Ticker", "Industry", "Price"];
    const data = stocks.map((r) => [
      r.ticker,
      r.industry ?? "",
      prices[r.ticker]?.toFixed(2) ?? "",
    ]);
    downloadCsv(`bagger-reversal-${date}.csv`, headers, data);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onAdd} className="flex items-center gap-2">
        <input
          value={addTicker}
          onChange={(e) => onAddTickerChange(e.target.value.toUpperCase())}
          placeholder="Add ticker (e.g. AAPL)"
          className="border rounded px-2 py-1 text-sm w-48"
        />
        <button type="submit" disabled={addLoading} className="text-sm bg-blue-600 text-white rounded px-3 py-1 disabled:opacity-50">
          {addLoading ? "Adding..." : "Add"}
        </button>
        {addError && <span className="text-xs text-red-500">{addError}</span>}
        {stocks.length > 0 && (
          <button
            onClick={exportCsv}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm font-semibold ml-auto"
          >
            Export CSV
          </button>
        )}
      </form>

      <div className="text-xs text-gray-400">Columns for this view are still being defined — for now this just tracks the ticker list.</div>

      {loading && <div className="text-sm text-gray-400">Loading...</div>}
      {!loading && stocks.length === 0 && (
        <div className="text-sm text-gray-400">No tickers yet — add one above to start tracking Potential Bagger Reversal setups.</div>
      )}

      {stocks.length > 0 && (
        <div className="overflow-x-auto overflow-y-auto max-h-[72vh] rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Ticker</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Industry</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Price</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stocks.map((r) => (
                <tr key={r.ticker} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-semibold text-gray-900">
                    {r.ticker}
                    {r.name && <div className="text-xs text-gray-400 font-normal">{r.name}</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.industry}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{prices[r.ticker] != null ? `$${prices[r.ticker]!.toFixed(2)}` : dash}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => onRemove(r.ticker)} className="text-xs text-red-500 hover:text-red-700 mr-2">Remove</button>
                    <button onClick={() => onMoveToExcluded(r.ticker)} className="text-xs text-[var(--muted)] hover:text-red-600">Move to Excluded</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
