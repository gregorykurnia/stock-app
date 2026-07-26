"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getPriceAlerts, savePriceAlert, removePriceAlert, updatePriceAlertState, updatePriceAlertNotes, updatePriceAlertPrice } from "@/lib/firestore";
import { subscribeToPush } from "@/lib/push";
import type { PriceAlert } from "@/lib/types";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [tickerInput, setTickerInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("push_subscribed") === "true"
  );
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await getPriceAlerts();
      const list = Object.values(data) as PriceAlert[];
      list.sort((a, b) => a.ticker.localeCompare(b.ticker));
      setAlerts(list);

      if (list.length > 0) {
        const tickers = list.map((a) => a.ticker).join(",");
        const res = await fetch(`/api/prices?tickers=${tickers}`);
        const json = await res.json();
        setPrices(json.prices ?? {});
      } else {
        setPrices({});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load, same pattern as watchlist/portfolio pages
  useEffect(() => { load(true); }, [load]);

  async function handleEnableAlerts() {
    setPushStatus(null);
    const result = await subscribeToPush();
    setPushStatus(result.message);
    setPushSubscribed(result.ok);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const ticker = tickerInput.trim().toUpperCase();
    const price = parseFloat(priceInput);

    if (!ticker) { setFormError("Enter a ticker."); return; }
    if (isNaN(price) || price <= 0) { setFormError("Enter a valid price."); return; }

    await savePriceAlert(ticker, price);
    setTickerInput("");
    setPriceInput("");
    await load();
  }

  async function handleRemove(ticker: string) {
    if (!confirm(`Remove price alert for ${ticker}?`)) return;
    await removePriceAlert(ticker);
    await load();
  }

  async function handleReset(ticker: string) {
    await updatePriceAlertState(ticker, { triggered: false, last_price_side: undefined });
    await load();
  }

  async function handleNotesBlur(ticker: string, value: string) {
    const current = alerts.find((a) => a.ticker === ticker)?.notes ?? "";
    if (value === current) return;
    await updatePriceAlertNotes(ticker, value);
    setAlerts((prev) => prev.map((a) => (a.ticker === ticker ? { ...a, notes: value } : a)));
  }

  async function handlePriceBlur(ticker: string, value: string) {
    const current = alerts.find((a) => a.ticker === ticker)?.alert_price;
    const price = parseFloat(value);
    if (isNaN(price) || price <= 0 || price === current) {
      setPriceDraft((prev) => { const next = { ...prev }; delete next[ticker]; return next; });
      return;
    }
    await updatePriceAlertPrice(ticker, price);
    setAlerts((prev) => prev.map((a) => (a.ticker === ticker ? { ...a, alert_price: price, triggered: false, last_price_side: undefined } : a)));
    setPriceDraft((prev) => { const next = { ...prev }; delete next[ticker]; return next; });
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-screen-md mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Price Alerts</h1>
            <p className="text-gray-500 text-sm mt-0.5">Set a price alert for any ticker — checked every 5 min during market hours.</p>
          </div>
          <div className="flex flex-col items-end">
            <button
              onClick={handleEnableAlerts}
              className={`text-xs px-3 py-1.5 rounded border ${pushSubscribed ? "border-green-300 text-green-700 bg-green-50" : "border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 bg-white"}`}
            >
              {pushSubscribed ? "🔔 Notifications Enabled" : "Enable Notifications"}
            </button>
            {pushStatus && <span className="text-xs text-gray-400 mt-0.5">{pushStatus}</span>}
          </div>
        </div>

        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-4 flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ticker</label>
            <input
              type="text" value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              placeholder="e.g. AAPL"
              className="w-32 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Alert Price</label>
            <input
              type="number" step="0.01" value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="0.00"
              className="w-32 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <button type="submit" className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            Add Alert
          </button>
          {formError && <span className="text-xs text-red-500">{formError}</span>}
        </form>

        {loading ? (
          <p className="text-gray-400 animate-pulse text-sm">Loading alerts…</p>
        ) : alerts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
            No price alerts set yet. Add one above.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm bg-white">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticker</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Price</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Alert Price</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">% Distance</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alerts.map((a) => {
                  const cur = prices[a.ticker] ?? null;
                  const pctDistance = cur != null && a.alert_price > 0 ? ((cur - a.alert_price) / a.alert_price) * 100 : null;
                  return (
                    <tr key={a.ticker} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold">
                        <Link href={`/stock/${a.ticker}`} className="text-blue-600 hover:text-blue-800">{a.ticker}</Link>
                      </td>
                      <td className="px-3 py-2 text-gray-900 font-medium">
                        {cur != null ? `$${cur.toFixed(2)}` : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        <div className="flex items-center gap-1">
                          <span>$</span>
                          <input
                            type="number" step="0.01"
                            value={priceDraft[a.ticker] ?? a.alert_price.toFixed(2)}
                            onChange={(e) => setPriceDraft((prev) => ({ ...prev, [a.ticker]: e.target.value }))}
                            onBlur={(e) => handlePriceBlur(a.ticker, e.target.value)}
                            className="w-20 border border-transparent hover:border-gray-200 focus:border-blue-400 rounded px-1.5 py-1 text-xs text-gray-700 focus:outline-none bg-transparent focus:bg-white"
                          />
                        </div>
                      </td>
                      <td className={`px-3 py-2 font-medium ${pctDistance == null ? "text-gray-400" : pctDistance >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {pctDistance != null ? `${pctDistance >= 0 ? "+" : ""}${pctDistance.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {a.triggered
                          ? <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase bg-green-100 text-green-700 border border-green-300">Triggered</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase bg-blue-100 text-blue-700 border border-blue-300">Active</span>}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={notesDraft[a.ticker] ?? a.notes ?? ""}
                          onChange={(e) => setNotesDraft((prev) => ({ ...prev, [a.ticker]: e.target.value }))}
                          onBlur={(e) => handleNotesBlur(a.ticker, e.target.value)}
                          placeholder="What to do…"
                          className="w-48 border border-transparent hover:border-gray-200 focus:border-blue-400 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none bg-transparent focus:bg-white"
                        />
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {a.triggered && (
                          <button onClick={() => handleReset(a.ticker)} className="text-blue-500 hover:text-blue-700 text-xs mr-3">Re-arm</button>
                        )}
                        <button onClick={() => handleRemove(a.ticker)} className="text-red-300 hover:text-red-500 text-xs">Remove</button>
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
