"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getPortfolio, savePortfolioEntry, removePortfolioEntry, getCustomStocks } from "@/lib/firestore";
import { SEED_STOCKS, FUNDAMENTALS_RAW, VALUATION_RAW } from "@/lib/seedData";
import type { CustomStock } from "@/lib/types";

const SEED_MAP = new Set(SEED_STOCKS.map((s) => s.ticker));

const pctColor = (v: number) => v > 0 ? "text-green-600" : v < 0 ? "text-red-500" : "text-gray-500";
const pct = (v: number | null | undefined) => v == null ? "—" : `${(v * 100).toFixed(1)}%`;
const num = (v: number | null | undefined, dec = 1) => v == null ? "—" : v.toFixed(dec);

interface PortfolioRow {
  ticker: string;
  name: string | null;
  industry: string | null;
  // Editable portfolio fields
  shares: number;
  entry_price: number;
  stop_level: number;
  date_entered: string;
  notes: string;
  // Fundamentals
  gross_margin: number | null;
  op_margin: number | null;
  net_margin: number | null;
  fcf_margin: number | null;
  rev_growth: number | null;
  fwd_pe: number | null;
  peg: number | null;
  ev_ebitda: number | null;
  // Live
  price: number | null;
}

// Inline-editable number cell
function EditCell({
  value, onSave, prefix = "", suffix = "", step = "0.01", placeholder = "0",
}: {
  value: number; onSave: (v: number) => void;
  prefix?: string; suffix?: string; step?: string; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  function commit() {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed !== value) onSave(parsed);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-24 border border-blue-400 rounded px-1 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    );
  }
  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="text-left hover:bg-blue-50 hover:text-blue-700 rounded px-1 -mx-1 transition-colors cursor-text"
      title="Click to edit"
    >
      {prefix}{value > 0 || suffix ? value.toFixed(suffix === "%" ? 0 : 2) : <span className="text-gray-400 italic">click to set</span>}{suffix}
    </button>
  );
}

function EditTextCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    if (draft !== value) onSave(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-32 border border-blue-400 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    );
  }
  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="text-left hover:bg-blue-50 hover:text-blue-700 rounded px-1 -mx-1 transition-colors cursor-text max-w-[120px] truncate"
      title={value || "Click to add notes"}
    >
      {value || <span className="text-gray-400 italic">add notes</span>}
    </button>
  );
}

export default function PortfolioPage() {
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [portfolioData, customData] = await Promise.all([
        getPortfolio(),
        getCustomStocks(),
      ]);

      const customMap = new Map(
        Object.entries(customData).map(([t, d]) => [t, d as CustomStock])
      );

      const built: PortfolioRow[] = Object.entries(portfolioData).map(([ticker, raw]) => {
        const p = raw as Record<string, unknown>;
        const isSeed = SEED_MAP.has(ticker);
        const fr = FUNDAMENTALS_RAW[ticker];
        const vr = VALUATION_RAW[ticker];
        const custom = customMap.get(ticker);

        return {
          ticker,
          name: custom?.name ?? null,
          industry: isSeed ? null : (custom?.industry ?? custom?.sector ?? null),
          shares: Number(p.shares ?? 0),
          entry_price: Number(p.entry_price ?? 0),
          stop_level: Number(p.stop_level ?? 0),
          date_entered: String(p.date_entered ?? ""),
          notes: String(p.notes ?? ""),
          gross_margin: fr?.gross_margin ?? custom?.gross_margin ?? null,
          op_margin: fr?.op_margin ?? custom?.op_margin ?? null,
          net_margin: custom?.net_margin ?? null,
          fcf_margin: fr?.fcf_margin ?? custom?.fcf_margin ?? null,
          rev_growth: fr?.rev_growth ?? custom?.rev_growth ?? null,
          fwd_pe: vr?.fwd_pe ?? custom?.fwd_pe ?? null,
          peg: vr?.peg ?? custom?.peg ?? null,
          ev_ebitda: vr?.ev_ebitda ?? custom?.ev_ebitda ?? null,
          price: null,
        };
      });

      built.sort((a, b) => a.ticker.localeCompare(b.ticker));
      setRows(built);

      if (built.length > 0) {
        const tickers = built.map((r) => r.ticker).join(",");
        const res = await fetch(`/api/prices?tickers=${tickers}`);
        const json = await res.json();
        setPrices(json.prices ?? {});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateField(ticker: string, field: string, value: unknown) {
    const row = rows.find((r) => r.ticker === ticker);
    if (!row) return;
    const updated = {
      shares: row.shares, entry_price: row.entry_price, stop_level: row.stop_level,
      date_entered: row.date_entered, notes: row.notes,
      [field]: value,
    };
    await savePortfolioEntry(ticker, updated);
    setRows((prev) => prev.map((r) => r.ticker === ticker ? { ...r, [field]: value } : r));
  }

  async function handleRemove(ticker: string) {
    if (!confirm(`Remove ${ticker} from portfolio? (It stays in the master table.)`)) return;
    await removePortfolioEntry(ticker);
    await load();
  }

  const totalCost = rows.reduce((s, r) => s + r.entry_price * r.shares, 0);
  const totalValue = rows.reduce((s, r) => {
    const cur = prices[r.ticker];
    return cur != null ? s + cur * r.shares : s;
  }, 0);
  const totalPL = totalValue - totalCost;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portfolio</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Added from master table · Click any value to edit inline
            </p>
          </div>
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
            ← Back to Master Table
          </Link>
        </div>

        {/* Summary */}
        {rows.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Cost Basis</p>
              <p className="text-lg font-bold">${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Market Value</p>
              <p className="text-lg font-bold">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total P&L</p>
              <p className={`text-lg font-bold ${totalPL >= 0 ? "text-green-600" : "text-red-500"}`}>
                {totalPL >= 0 ? "+" : ""}${totalPL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-400 animate-pulse text-sm">Loading portfolio…</p>
        ) : rows.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
            No positions yet. Go to the <Link href="/" className="text-blue-500 hover:underline">Master Table</Link> and click &quot;+ Portfolio&quot; on any stock.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  {[
                    "Ticker", "Price", "Shares ✎", "Entry ✎", "Cost Basis",
                    "Mkt Value", "P&L $", "P&L %", "Stop ✎", "Stop Dist",
                    "Rev Gr", "Gross%", "Op%", "Net%", "FCF%",
                    "Fwd PE", "PEG", "EV/EBITDA",
                    "Notes ✎", "Date", "",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const cur = prices[r.ticker] ?? null;
                  const cost = r.entry_price * r.shares;
                  const mktVal = cur != null ? cur * r.shares : null;
                  const plDollar = mktVal != null ? mktVal - cost : null;
                  const plPct = plDollar != null && cost > 0 ? plDollar / cost : null;
                  const stopDist = cur != null && r.stop_level > 0 ? (cur - r.stop_level) / cur : null;
                  return (
                    <tr key={r.ticker} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">
                        <Link href={`/stock/${r.ticker}`} className="text-blue-600 hover:text-blue-800">{r.ticker}</Link>
                        {r.name && <span className="block text-xs text-gray-400 font-normal">{r.name}</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">
                        {cur != null ? `$${cur.toFixed(2)}` : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <EditCell value={r.shares} step="0.001" placeholder="0" onSave={(v) => updateField(r.ticker, "shares", v)} />
                      </td>
                      <td className="px-3 py-2">
                        <EditCell value={r.entry_price} prefix="$" onSave={(v) => updateField(r.ticker, "entry_price", v)} />
                      </td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        {cost > 0 ? `$${cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        {mktVal != null ? `$${mktVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className={`px-3 py-2 font-semibold whitespace-nowrap ${plDollar != null ? pctColor(plDollar) : "text-gray-400"}`}>
                        {plDollar != null ? `${plDollar >= 0 ? "+" : ""}$${Math.abs(plDollar).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className={`px-3 py-2 ${plPct != null ? pctColor(plPct) : "text-gray-400"}`}>
                        {plPct != null ? `${plPct >= 0 ? "+" : ""}${(plPct * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <EditCell value={r.stop_level} prefix="$" onSave={(v) => updateField(r.ticker, "stop_level", v)} />
                      </td>
                      <td className={`px-3 py-2 font-medium whitespace-nowrap ${stopDist != null ? (stopDist < 0.05 ? "text-red-500" : stopDist < 0.10 ? "text-yellow-600" : "text-green-600") : "text-gray-400"}`}>
                        {stopDist != null ? `${(stopDist * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{pct(r.rev_growth)}</td>
                      <td className="px-3 py-2 text-gray-600">{pct(r.gross_margin)}</td>
                      <td className="px-3 py-2 text-gray-600">{pct(r.op_margin)}</td>
                      <td className="px-3 py-2 text-gray-600">{pct(r.net_margin)}</td>
                      <td className="px-3 py-2 text-gray-600">{pct(r.fcf_margin)}</td>
                      <td className="px-3 py-2 text-gray-600">{num(r.fwd_pe)}</td>
                      <td className="px-3 py-2 text-gray-600">{num(r.peg, 2)}</td>
                      <td className="px-3 py-2 text-gray-600">{num(r.ev_ebitda)}</td>
                      <td className="px-3 py-2">
                        <EditTextCell value={r.notes} onSave={(v) => updateField(r.ticker, "notes", v)} />
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{r.date_entered}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => handleRemove(r.ticker)} className="text-red-300 hover:text-red-500 text-xs">Remove</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
