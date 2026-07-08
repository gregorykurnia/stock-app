"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getWatchlist, saveWatchlistEntry, removeWatchlistEntry, savePortfolioEntry, removePortfolioEntry } from "@/lib/firestore";
import type { WatchlistEntry } from "@/lib/types";

const urgencyStyles: Record<string, string> = {
  urgent: "bg-green-100 text-green-700 border border-green-300",
  watch:  "bg-yellow-100 text-yellow-700 border border-yellow-300",
  hold:   "bg-blue-100 text-blue-700 border border-blue-300",
  avoid:  "bg-red-100 text-red-700 border border-red-300",
};

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    ticker: "",
    alert_price: "",
    entry_zone: "",
    verdict: "watch",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  // Move-to-portfolio modal state
  const [promoteTicker, setPromoteTicker] = useState<string | null>(null);
  const [promoteForm, setPromoteForm] = useState({ entry_price: "", shares: "", stop_level: "" });

  async function load() {
    setLoading(true);
    try {
      const data = await getWatchlist();
      const list = Object.entries(data).map(([ticker, d]) => ({ ticker, ...(d as object) } as WatchlistEntry));
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
      await saveWatchlistEntry(ticker, {
        alert_price: parseFloat(form.alert_price),
        entry_zone: form.entry_zone,
        verdict: form.verdict,
        date_added: new Date().toISOString().split("T")[0],
        notes: form.notes,
      });
      setForm({ ticker: "", alert_price: "", entry_zone: "", verdict: "watch", notes: "" });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(ticker: string) {
    if (!confirm(`Remove ${ticker} from watchlist?`)) return;
    await removeWatchlistEntry(ticker);
    await load();
  }

  async function handlePromote(e: React.FormEvent) {
    e.preventDefault();
    if (!promoteTicker) return;
    setSaving(true);
    try {
      await savePortfolioEntry(promoteTicker, {
        entry_price: parseFloat(promoteForm.entry_price),
        shares: parseFloat(promoteForm.shares),
        stop_level: parseFloat(promoteForm.stop_level),
        date_entered: new Date().toISOString().split("T")[0],
      });
      await removePortfolioEntry(promoteTicker); // no-op if not in portfolio yet; remove from watchlist
      await removeWatchlistEntry(promoteTicker);
      setPromoteTicker(null);
      setPromoteForm({ entry_price: "", shares: "", stop_level: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-screen-xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Home</Link>
              <h1 className="text-2xl font-bold text-gray-900">Watchlist</h1>
            </div>
            <p className="text-gray-500 text-sm mt-0.5">Any ticker · Alert prices · One-click promote to portfolio</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
          >
            + Add to Watchlist
          </button>
        </div>

        {/* Add Form */}
        {showForm && (
          <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Add Stock</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Ticker</label>
                <input
                  required
                  value={form.ticker}
                  onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                  placeholder="TSLA"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Alert Price</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={form.alert_price}
                  onChange={(e) => setForm({ ...form, alert_price: e.target.value })}
                  placeholder="200.00"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Entry Zone</label>
                <input
                  value={form.entry_zone}
                  onChange={(e) => setForm({ ...form, entry_zone: e.target.value })}
                  placeholder="195–205"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Verdict</label>
                <select
                  value={form.verdict}
                  onChange={(e) => setForm({ ...form, verdict: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                >
                  <option value="urgent">Urgent</option>
                  <option value="watch">Watch</option>
                  <option value="hold">Hold</option>
                  <option value="avoid">Avoid</option>
                </select>
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

        {/* Promote to Portfolio Modal */}
        {promoteTicker && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <form
              onSubmit={handlePromote}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4"
            >
              <h2 className="font-bold text-lg text-gray-900">Move {promoteTicker} to Portfolio</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Entry Price</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={promoteForm.entry_price}
                    onChange={(e) => setPromoteForm({ ...promoteForm, entry_price: e.target.value })}
                    placeholder="150.00"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Shares</label>
                  <input
                    required
                    type="number"
                    step="0.001"
                    value={promoteForm.shares}
                    onChange={(e) => setPromoteForm({ ...promoteForm, shares: e.target.value })}
                    placeholder="10"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Stop Level</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={promoteForm.stop_level}
                    onChange={(e) => setPromoteForm({ ...promoteForm, stop_level: e.target.value })}
                    placeholder="130.00"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold"
                >
                  {saving ? "Moving…" : "Move to Portfolio"}
                </button>
                <button
                  type="button"
                  onClick={() => setPromoteTicker(null)}
                  className="flex-1 border border-gray-300 text-gray-600 hover:text-gray-800 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <p className="text-gray-400 animate-pulse text-sm">Loading watchlist…</p>
        ) : entries.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
            Watchlist is empty. Add any ticker with &quot;+ Add to Watchlist&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  {["Ticker", "Current", "Alert Price", "Entry Zone", "Verdict", "Date Added", "Notes", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => {
                  const cur = prices[e.ticker] ?? null;
                  const nearAlert = cur != null && e.alert_price > 0 && Math.abs(cur - e.alert_price) / e.alert_price < 0.03;
                  return (
                    <tr key={e.ticker} className={`hover:bg-gray-50 transition-colors ${nearAlert ? "bg-yellow-50" : ""}`}>
                      <td className="px-3 py-2 font-semibold">
                        <Link href={`/stock/${e.ticker}`} className="text-blue-600 hover:text-blue-800">
                          {e.ticker}
                        </Link>
                        {nearAlert && <span className="ml-2 text-xs text-yellow-600 font-medium">Near alert!</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-900 font-medium">
                        {cur != null ? `$${cur.toFixed(2)}` : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700">${e.alert_price.toFixed(2)}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{e.entry_zone || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${urgencyStyles[e.verdict] ?? "bg-gray-100 text-gray-500"}`}>
                          {e.verdict}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{e.date_added}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs max-w-[140px] truncate">{e.notes || "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setPromoteTicker(e.ticker); setPromoteForm({ entry_price: cur ? cur.toFixed(2) : "", shares: "", stop_level: "" }); }}
                            className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                          >
                            → Portfolio
                          </button>
                          <button
                            onClick={() => handleRemove(e.ticker)}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            Remove
                          </button>
                        </div>
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
