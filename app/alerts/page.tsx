"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getPriceAlerts, savePriceAlert, savePostEarningsAlert, removePriceAlert, updatePriceAlertState, updatePriceAlertNotes, updatePriceAlertPrice, updatePriceAlertEarnings } from "@/lib/firestore";
import { subscribeToPush } from "@/lib/push";
import type { PriceAlert } from "@/lib/types";

function EarningsBadge({ dateStr, fired }: { dateStr: string | null | undefined; fired?: boolean }) {
  if (!dateStr) return <span className="text-gray-300 text-xs">Not armed yet</span>;
  const todayStr = new Date().toISOString().slice(0, 10);
  const daysUntil = Math.round((new Date(dateStr + "T00:00:00Z").getTime() - new Date(todayStr + "T00:00:00Z").getTime()) / 86400000);

  if (daysUntil < 0) {
    return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${fired ? "bg-green-100 text-green-700 border border-green-300" : "bg-gray-100 text-gray-500 border border-gray-200"}`}>{fired ? "Notified" : "Reported"}</span>;
  }
  if (daysUntil === 0) return <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700 border border-red-300">Today</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300">{dateStr} ({daysUntil}d)</span>;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [earningsDates, setEarningsDates] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [alertMode, setAlertMode] = useState<"price" | "post_earnings">("price");
  const [tickerInput, setTickerInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("push_subscribed") === "true"
  );
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<"price" | "distance" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

        const earningsTickers = list.filter((a) => a.earnings_alert).map((a) => a.ticker);
        if (earningsTickers.length > 0) {
          fetch(`/api/earnings?tickers=${earningsTickers.join(",")}`)
            .then((r) => r.json())
            .then((d) => setEarningsDates(d.earnings ?? {}))
            .catch(() => {});
        }
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

    if (!ticker) { setFormError("Enter a ticker."); return; }

    if (alertMode === "post_earnings") {
      if (!notesInput.trim()) { setFormError("Enter how much you want to put in (e.g. \"$2000 after earnings\")."); return; }
      await savePostEarningsAlert(ticker, notesInput.trim());
    } else {
      const price = parseFloat(priceInput);
      if (isNaN(price) || price <= 0) { setFormError("Enter a valid price."); return; }
      await savePriceAlert(ticker, price);
    }

    setTickerInput("");
    setPriceInput("");
    setNotesInput("");
    await load();
  }

  async function handleRemove(id: string, ticker: string) {
    if (!confirm(`Remove this alert for ${ticker}?`)) return;
    await removePriceAlert(id);
    await load();
  }

  async function handleReset(id: string) {
    await updatePriceAlertState(id, { triggered: false, last_price_side: undefined });
    await load();
  }

  async function handleToggleEarningsAlert(id: string, ticker: string, enabled: boolean) {
    await updatePriceAlertEarnings(id, { earnings_alert: enabled, ...(enabled ? { earnings_alert_fired: false } : {}) });
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, earnings_alert: enabled } : a)));

    if (enabled) {
      const res = await fetch(`/api/earnings?tickers=${ticker}`);
      const d = await res.json();
      const dateStr: string | null = d.earnings?.[ticker] ?? null;
      setEarningsDates((prev) => ({ ...prev, [ticker]: dateStr }));
      await updatePriceAlertEarnings(id, { earnings_date: dateStr });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, earnings_date: dateStr } : a)));
    }
  }

  async function handleNotesBlur(id: string, value: string) {
    const current = alerts.find((a) => a.id === id)?.notes ?? "";
    if (value === current) return;
    await updatePriceAlertNotes(id, value);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, notes: value } : a)));
  }

  function handleExportCsv() {
    const headers = ["Ticker", "Current Price", "Alert Price", "% Distance", "Status", "Earnings Alert", "Earnings Date", "Notes"];
    const rows = alerts.map((a) => {
      const cur = prices[a.ticker] ?? null;
      const hasAlertPrice = !!a.alert_price && a.alert_price > 0;
      const pctDistance = cur != null && hasAlertPrice ? ((cur - a.alert_price!) / a.alert_price!) * 100 : null;
      const status = !hasAlertPrice ? "Post-Earnings" : a.triggered ? "Triggered" : "Active";
      return [
        a.ticker,
        cur != null ? cur.toFixed(2) : "",
        hasAlertPrice ? a.alert_price!.toFixed(2) : "",
        pctDistance != null ? pctDistance.toFixed(1) : "",
        status,
        a.earnings_alert ? "Yes" : "No",
        a.earnings_alert ? (earningsDates[a.ticker] ?? "") : "",
        a.notes ?? "",
      ];
    });

    const escapeCell = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
    const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `price-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleSort(key: "price" | "distance") {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function getPctDistance(a: PriceAlert): number | null {
    const cur = prices[a.ticker] ?? null;
    const hasAlertPrice = !!a.alert_price && a.alert_price > 0;
    return cur != null && hasAlertPrice ? ((cur - a.alert_price!) / a.alert_price!) * 100 : null;
  }

  const sortedAlerts = (() => {
    if (!sortKey) return alerts;
    const withValues = alerts.map((a) => ({
      a,
      value: sortKey === "price" ? prices[a.ticker] ?? null : getPctDistance(a),
    }));
    withValues.sort((x, y) => {
      if (x.value == null && y.value == null) return 0;
      if (x.value == null) return 1;
      if (y.value == null) return -1;
      return sortDir === "asc" ? x.value - y.value : y.value - x.value;
    });
    return withValues.map((w) => w.a);
  })();

  async function handlePriceBlur(id: string, value: string) {
    const current = alerts.find((a) => a.id === id)?.alert_price;
    const price = parseFloat(value);
    if (isNaN(price) || price <= 0 || price === current) {
      setPriceDraft((prev) => { const next = { ...prev }; delete next[id]; return next; });
      return;
    }
    await updatePriceAlertPrice(id, price);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, alert_price: price, triggered: false, last_price_side: undefined } : a)));
    setPriceDraft((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-screen-md mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Price Alerts</h1>
            <p className="text-gray-500 text-sm mt-0.5">Set a price alert for any ticker — checked every 5 min during market hours.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <button
                onClick={handleExportCsv}
                disabled={alerts.length === 0}
                className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Export CSV
              </button>
              <button
                onClick={handleEnableAlerts}
                className={`text-xs px-3 py-1.5 rounded border ${pushSubscribed ? "border-green-300 text-green-700 bg-green-50" : "border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 bg-white"}`}
              >
                {pushSubscribed ? "🔔 Notifications Enabled" : "Enable Notifications"}
              </button>
            </div>
            {pushStatus && <span className="text-xs text-gray-400 mt-0.5">{pushStatus}</span>}
          </div>
        </div>

        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAlertMode("price")}
              className={`text-xs px-3 py-1 rounded-full font-medium border ${alertMode === "price" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-300 hover:border-gray-400"}`}
            >
              Price Alert
            </button>
            <button
              type="button"
              onClick={() => setAlertMode("post_earnings")}
              className={`text-xs px-3 py-1 rounded-full font-medium border ${alertMode === "post_earnings" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-300 hover:border-gray-400"}`}
            >
              Post-Earnings Entry
            </button>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ticker</label>
              <input
                type="text" value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                placeholder="e.g. AAPL"
                className="w-32 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            {alertMode === "price" ? (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Alert Price</label>
                <input
                  type="number" step="0.01" value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="0.00"
                  className="w-32 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            ) : (
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes ($ to put in)</label>
                <input
                  type="text" value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder='e.g. "$2000 after earnings if reaction is good"'
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            )}
            <button type="submit" className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
              Add Alert
            </button>
            {formError && <span className="text-xs text-red-500">{formError}</span>}
          </div>
          {alertMode === "post_earnings" && (
            <p className="text-xs text-gray-400">No target price needed — you&apos;ll get pinged the moment earnings is reported, then you can decide the entry and set a price alert if you want one.</p>
          )}
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
                  <th
                    className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort("price")}
                  >
                    Current Price{sortKey === "price" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Alert Price</th>
                  <th
                    className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort("distance")}
                  >
                    % Distance{sortKey === "distance" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide" title="Ping once after earnings is reported">Earnings Alert</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedAlerts.map((a) => {
                  const cur = prices[a.ticker] ?? null;
                  const hasAlertPrice = !!a.alert_price && a.alert_price > 0;
                  const pctDistance = getPctDistance(a);
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
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
                            value={priceDraft[a.id] ?? (hasAlertPrice ? a.alert_price!.toFixed(2) : "")}
                            onChange={(e) => setPriceDraft((prev) => ({ ...prev, [a.id]: e.target.value }))}
                            onBlur={(e) => handlePriceBlur(a.id, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                            placeholder="set after earnings"
                            className="w-24 border border-transparent hover:border-gray-200 focus:border-blue-400 rounded px-1.5 py-1 text-xs text-gray-700 focus:outline-none bg-transparent focus:bg-white placeholder:text-gray-300"
                          />
                        </div>
                      </td>
                      <td className={`px-3 py-2 font-medium ${pctDistance == null ? "text-gray-400" : pctDistance >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {pctDistance != null ? `${pctDistance >= 0 ? "+" : ""}${pctDistance.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {!hasAlertPrice
                          ? <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase bg-purple-100 text-purple-700 border border-purple-300">Post-Earnings</span>
                          : a.triggered
                          ? <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase bg-green-100 text-green-700 border border-green-300">Triggered</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase bg-blue-100 text-blue-700 border border-blue-300">Active</span>}
                      </td>
                      <td className="px-3 py-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!a.earnings_alert}
                            onChange={(e) => handleToggleEarningsAlert(a.id, a.ticker, e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          {a.earnings_alert && <EarningsBadge dateStr={earningsDates[a.ticker]} fired={a.earnings_alert_fired} />}
                        </label>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={notesDraft[a.id] ?? a.notes ?? ""}
                          onChange={(e) => setNotesDraft((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          onBlur={(e) => handleNotesBlur(a.id, e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                          placeholder="What to do…"
                          className="w-48 border border-transparent hover:border-gray-200 focus:border-blue-400 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none bg-transparent focus:bg-white"
                        />
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {a.triggered && (
                          <button onClick={() => handleReset(a.id)} className="text-blue-500 hover:text-blue-700 text-xs mr-3">Re-arm</button>
                        )}
                        <button onClick={() => handleRemove(a.id, a.ticker)} className="text-red-300 hover:text-red-500 text-xs">Remove</button>
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
