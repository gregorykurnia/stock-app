"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getPortfolio, savePortfolioEntry, removePortfolioEntry } from "@/lib/firestore";
import type { PortfolioEntry } from "@/lib/types";

const pctColor = (v: number) =>
  v > 0 ? "text-green-600" : v < 0 ? "text-red-500" : "text-gray-500";

const dollarColor = (v: number) =>
  v > 0 ? "text-green-600 font-semibold" : v < 0 ? "text-red-500 font-semibold" : "text-gray-500";

export default function PortfolioPage() {
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    ticker: "",
    entry_price: "",
    shares: "",
    stop_level: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getPortfolio();
      const list = Object.entries(data).map(([ticker, d]) => ({ ticker, ...(d as object) } as PortfolioEntry));
      list.sort((a, b) => a.ticker.localeCompare(b.ticker));
      setEntries(list);

      if (list.length > 0) {
        const tickers = list.map((e) => e.ticker).join(",");
        const res = await fetch(`/api/prices?tickers=${tickers}`);
        const json = await res.json();
        setPrices(json.prices ?? {});
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const ticker = form.ticker.trim().toUpperCase();
    if (!ticker) return;
    setSaving(true);
    try {
      await savePortfolioEntry(ticker, {
        entry_price: parseFloat(form.entry_price),
        shares: parseFloat(form.shares),
        stop_level: parseFloat(form.stop_level),
        date_entered: new Date().toISOString().split("T")[0],
        notes: form.notes,
      });
      setForm({ ticker: "", entry_price: "", shares: "", stop_level: "", notes: "" });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(ticker: string) {
    if (!confirm(`Remove ${ticker} from portfolio?`)) return;
    await removePortfolioEntry(ticker);
    await load();
  }

  // Totals
  const totalCost = entries.reduce((sum, e) => sum + e.entry_price * e.shares, 0);
  const totalValue = entries.reduce((sum, e) => {
    const cur = prices[e.ticker];
    return cur != null ? sum + cur * e.shares : sum;
  }, 0);
  const totalPL = entries.reduce((sum, e) => {
    const cur = prices[e.ticker];
    return cur != null ? sum + (cur - e.entry_price) * e.shares : sum;
  }, 0);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-screen-xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portfolio</h1>
            <p className="text-gray-500 text-sm mt-0.5">Track your positions · P&L · Stop distances</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
          >
            + Add Position
          </button>
        </div>

        {/* Summary bar */}
        {entries.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Cost Basis</p>
              <p className="text-lg font-bold text-gray-900">${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Market Value</p>
              <p className="text-lg font-bold text-gray-900">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total P&L</p>
              <p className={`text-lg font-bold ${totalPL >= 0 ? "text-green-600" : "text-red-500"}`}>
                {totalPL >= 0 ? "+" : ""}${totalPL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        {/* Add Form */}
        {showForm && (
          <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">New Position</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Ticker</label>
                <input
                  required
                  value={form.ticker}
                  onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                  placeholder="NVDA"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Entry Price</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={form.entry_price}
                  onChange={(e) => setForm({ ...form, entry_price: e.target.value })}
                  placeholder="150.00"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Shares</label>
                <input
                  required
                  type="number"
                  step="0.001"
                  value={form.shares}
                  onChange={(e) => setForm({ ...form, shares: e.target.value })}
                  placeholder="10"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Stop Level</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={form.stop_level}
                  onChange={(e) => setForm({ ...form, stop_level: e.target.value })}
                  placeholder="130.00"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Notes</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            {/* Live cost preview */}
            {form.entry_price && form.shares && (
              <p className="text-xs text-gray-500">
                Cost basis: <span className="font-semibold text-gray-700">${(parseFloat(form.entry_price) * parseFloat(form.shares)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm font-semibold"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded text-sm border border-gray-300"
              >
                Cancel
          </button>
            </div>
          </form>
        )}

        {/* Table */}
        {loading ? (
          <p className="text-gray-400 animate-pulse text-sm">Loading portfolio…</p>
        ) : entries.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
            No positions yet. Click &quot;+ Add Position&quot; to start.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  {["Ticker", "Entry", "Shares", "Cost Basis", "Current", "Mkt Value", "P&L $", "P&L %", "Stop", "Stop Dist", "Date", "Notes", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => {
                  const cur = prices[e.ticker] ?? null;
                  const costBasis = e.entry_price * e.shares;
                  const mktValue = cur != null ? cur * e.shares : null;
                  const plDollar = mktValue != null ? mktValue - costBasis : null;
                  const plPct = plDollar != null ? plDollar / costBasis : null;
                  const stopDist = cur != null ? (cur - e.stop_level) / cur : null;
                  return (
                    <tr key={e.ticker} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 font-semibold">
                        <Link href={`/stock/${e.ticker}`} className="text-blue-600 hover:text-blue-800">
                          {e.ticker}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-gray-700">${e.entry_price.toFixed(2)}</td>
                      <td className="px-3 py-2 text-gray-700">{e.shares % 1 === 0 ? e.shares : e.shares.toFixed(3)}</td>
                      <td className="px-3 py-2 text-gray-700">${costBasis.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-gray-900 font-medium">
                        {cur != null ? `$${cur.toFixed(2)}` : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {mktValue != null ? `$${mktValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="text-gray-400">—</span>}
                      </td>
                      <td className={`px-3 py-2 ${plDollar != null ? dollarColor(plDollar) : "text-gray-400"}`}>
                        {plDollar != null ? `${plDollar >= 0 ? "+" : ""}$${Math.abs(plDollar).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className={`px-3 py-2 ${plPct != null ? pctColor(plPct) : "text-gray-400"}`}>
                        {plPct != null ? `${plPct >= 0 ? "+" : ""}${(plPct * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-700">${e.stop_level.toFixed(2)}</td>
                      <td className={`px-3 py-2 font-medium ${stopDist != null ? (stopDist < 0.05 ? "text-red-500" : stopDist < 0.10 ? "text-yellow-600" : "text-green-600") : "text-gray-400"}`}>
                        {stopDist != null ? `${(stopDist * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{e.date_entered}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs max-w-[120px] truncate">{e.notes || "—"}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleRemove(e.ticker)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          Remove
                        </button>
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
