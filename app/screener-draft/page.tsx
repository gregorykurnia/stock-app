"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getScreenerDraft, importScreenerDraftEntries, removeScreenerDraftEntry,
  getWatchlistTickers, getPortfolioTickers, getUsSwingStocks, saveUsSwingStock,
  getScreenerExcludedTickers, excludeScreenerTicker, unexcludeScreenerTicker,
  getScreenerExclusionOverrides, addScreenerExclusionOverride,
} from "@/lib/firestore";
import { SCREENER_EXCLUDED_TICKERS } from "@/lib/screenerExclusions";
import type { ScreenerDraftEntry } from "@/lib/types";

type Status = "new" | "tracked";

export default function ScreenerDraftPage() {
  const [entries, setEntries] = useState<ScreenerDraftEntry[]>([]);
  const [trackedTickers, setTrackedTickers] = useState<Set<string>>(new Set());
  const [excludedTickers, setExcludedTickers] = useState<Record<string, { reason: string | null; excluded_at: string }>>({});
  const [exclusionOverrides, setExclusionOverrides] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<Set<string>>(new Set());
  const [promoteErrors, setPromoteErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | Status | "excluded">("new");

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [draft, watchlist, portfolio, usSwing, excluded, overrides] = await Promise.all([
        getScreenerDraft(),
        getWatchlistTickers(),
        getPortfolioTickers(),
        getUsSwingStocks(),
        getScreenerExcludedTickers(),
        getScreenerExclusionOverrides(),
      ]);
      const tracked = new Set<string>([...watchlist, ...portfolio, ...Object.keys(usSwing)]);
      setTrackedTickers(tracked);
      setExcludedTickers(excluded);
      setExclusionOverrides(overrides);
      const list: ScreenerDraftEntry[] = Object.entries(draft).map(([ticker, d]) => ({
        ticker,
        company: d.company ?? null,
        added_at: d.added_at,
      }));
      list.sort((a, b) => a.ticker.localeCompare(b.ticker));
      setEntries(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  const isExcluded = useCallback(
    (ticker: string) =>
      (SCREENER_EXCLUDED_TICKERS.has(ticker) && !exclusionOverrides.has(ticker)) || ticker in excludedTickers,
    [exclusionOverrides, excludedTickers]
  );

  async function handleRunScreener() {
    setRunStatus(null);
    setRunning(true);
    try {
      const res = await fetch("/api/screener");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Screener run failed");
      const rows: { ticker: string; company: string }[] = data.results ?? [];

      const existingTickers = new Set(entries.map((e) => e.ticker));
      const excluded = rows.filter((r) => isExcluded(r.ticker));
      const toImport = rows.filter((r) => !isExcluded(r.ticker) && !existingTickers.has(r.ticker));
      const skippedExisting = rows.length - excluded.length - toImport.length;

      if (toImport.length > 0) await importScreenerDraftEntries(toImport);
      setRunStatus(
        `Screener returned ${rows.length} ticker(s). Added ${toImport.length} new to the draft, ` +
        `${excluded.length} excluded, ${skippedExisting} already in draft.`
      );
      await load();
    } catch (err) {
      setRunStatus(err instanceof Error ? err.message : "Screener run failed");
    } finally {
      setRunning(false);
    }
  }

  async function handleExclude(ticker: string) {
    const reason = window.prompt(`Reason for excluding ${ticker}? (optional)`, "") || null;
    setEntries((prev) => prev.filter((e) => e.ticker !== ticker));
    setExcludedTickers((prev) => ({ ...prev, [ticker]: { reason, excluded_at: new Date().toISOString() } }));
    await Promise.all([excludeScreenerTicker(ticker, reason), removeScreenerDraftEntry(ticker)]);
  }

  async function handleDeleteExcluded(ticker: string, fromDoc: boolean) {
    if (fromDoc) {
      setExclusionOverrides((prev) => new Set(prev).add(ticker));
      await addScreenerExclusionOverride(ticker);
    }
    if (ticker in excludedTickers) {
      setExcludedTickers((prev) => { const next = { ...prev }; delete next[ticker]; return next; });
      await unexcludeScreenerTicker(ticker);
    }
  }

  async function handlePromote(ticker: string, fromExcluded = false) {
    setPromoting((prev) => new Set(prev).add(ticker));
    setPromoteErrors((prev) => { const next = { ...prev }; delete next[ticker]; return next; });
    try {
      const res = await fetch(`/api/fundamentals?ticker=${ticker}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch data");
      await saveUsSwingStock(ticker, {
        name: data.name ?? null,
        industry: data.industry ?? data.sector ?? null,
        added_at: new Date().toISOString(),
      });
      await removeScreenerDraftEntry(ticker);
      setEntries((prev) => prev.filter((e) => e.ticker !== ticker));
      setTrackedTickers((prev) => new Set(prev).add(ticker));
      if (fromExcluded) {
        await handleDeleteExcluded(ticker, SCREENER_EXCLUDED_TICKERS.has(ticker));
      }
    } catch (err) {
      setPromoteErrors((prev) => ({ ...prev, [ticker]: err instanceof Error ? err.message : "Unknown error" }));
    } finally {
      setPromoting((prev) => { const next = new Set(prev); next.delete(ticker); return next; });
    }
  }

  const rows = useMemo(() => {
    return entries
      .map((e) => ({ ...e, status: (trackedTickers.has(e.ticker) ? "tracked" : "new") as Status }))
      .filter((e) => filter === "all" || e.status === filter);
  }, [entries, trackedTickers, filter]);

  const newCount = entries.filter((e) => !trackedTickers.has(e.ticker)).length;
  const trackedCount = entries.length - newCount;
  const excludedList = useMemo(() => {
    const merged: Record<string, { reason: string | null; excluded_at: string | null; fromDoc: boolean }> = {};
    for (const ticker of SCREENER_EXCLUDED_TICKERS) {
      if (exclusionOverrides.has(ticker)) continue;
      merged[ticker] = { reason: "From exclusion doc", excluded_at: null, fromDoc: true };
    }
    for (const [ticker, d] of Object.entries(excludedTickers)) {
      merged[ticker] = { reason: d.reason, excluded_at: d.excluded_at, fromDoc: false };
    }
    return Object.entries(merged).sort(([a], [b]) => a.localeCompare(b));
  }, [excludedTickers, exclusionOverrides]);

  return (
    <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--foreground)]">Screener Draft</h1>
      </div>

      <div className="mb-6 rounded-lg border border-[var(--border)] bg-white p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunScreener}
            disabled={running}
            className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50"
          >
            {running ? "Running Screener..." : "Run Screener"}
          </button>
          <span className="text-xs text-[var(--muted)]">
            Market cap ≥ $1B, 0-3% below 50-day high, sorted by market cap desc — same criteria as the finviz screener.
          </span>
        </div>
        {runStatus && <p className="text-sm text-[var(--muted)] mt-3">{runStatus}</p>}
      </div>

      <div className="flex items-center gap-2 mb-4 text-sm">
        {(["new", "tracked", "excluded", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              filter === f ? "bg-[var(--accent)] text-white" : "bg-black/[0.04] text-[var(--muted)] hover:bg-black/[0.07]"
            }`}
          >
            {f === "new" ? `New (${newCount})`
              : f === "tracked" ? `Already Tracked (${trackedCount})`
              : f === "excluded" ? `Excluded (${excludedList.length})`
              : `All Draft (${entries.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      ) : filter === "excluded" ? (
        excludedList.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No excluded tickers.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-4 py-2.5">Ticker</th>
                  <th className="px-4 py-2.5">Reason</th>
                  <th className="px-4 py-2.5">Excluded</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {excludedList.map(([ticker, d]) => (
                  <tr key={ticker} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{ticker}</td>
                    <td className="px-4 py-2.5 text-[var(--muted)]">{d.reason ?? "—"}</td>
                    <td className="px-4 py-2.5 text-[var(--muted)] text-xs">{d.excluded_at ? d.excluded_at.slice(0, 10) : "—"}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {promoteErrors[ticker] && (
                        <div className="text-xs text-red-600 mb-1">{promoteErrors[ticker]}</div>
                      )}
                      <button
                        onClick={() => handlePromote(ticker, true)}
                        disabled={promoting.has(ticker)}
                        className="text-xs px-2.5 py-1 rounded-md bg-[var(--accent)] text-white font-medium mr-2 disabled:opacity-50"
                      >
                        {promoting.has(ticker) ? "Adding..." : "Move to US-Swing"}
                      </button>
                      <button
                        onClick={() => handleDeleteExcluded(ticker, d.fromDoc)}
                        className="text-xs px-2.5 py-1 rounded-md text-[var(--muted)] hover:text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing here yet — run the screener above to pull in tickers.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="px-4 py-2.5">Ticker</th>
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Added</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ticker} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2.5 font-semibold">{row.ticker}</td>
                  <td className="px-4 py-2.5 text-[var(--muted)]">{row.company ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {row.status === "new" ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 border border-green-300">New</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500 border border-gray-200">Already Tracked</span>
                    )}
                    {promoteErrors[row.ticker] && (
                      <div className="text-xs text-red-600 mt-1">{promoteErrors[row.ticker]}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--muted)] text-xs">{row.added_at.slice(0, 10)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {row.status === "new" && (
                      <button
                        onClick={() => handlePromote(row.ticker)}
                        disabled={promoting.has(row.ticker)}
                        className="text-xs px-2.5 py-1 rounded-md bg-[var(--accent)] text-white font-medium mr-2 disabled:opacity-50"
                      >
                        {promoting.has(row.ticker) ? "Adding..." : "Add to US-Swing"}
                      </button>
                    )}
                    <button
                      onClick={() => handleExclude(row.ticker)}
                      className="text-xs px-2.5 py-1 rounded-md text-[var(--muted)] hover:text-red-600 hover:bg-red-50"
                    >
                      Exclude
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
