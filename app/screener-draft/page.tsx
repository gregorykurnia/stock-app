"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getScreenerDraft, importScreenerDraftEntries, removeScreenerDraftEntry,
  getWatchlistTickers, getPortfolioTickers, getUsSwingStocks, saveUsSwingStock,
  getScreenerExcludedTickers, excludeScreenerTicker, unexcludeScreenerTicker,
} from "@/lib/firestore";
import { SCREENER_EXCLUDED_TICKERS } from "@/lib/screenerExclusions";
import type { ScreenerDraftEntry } from "@/lib/types";

type Status = "new" | "tracked";

export default function ScreenerDraftPage() {
  const [entries, setEntries] = useState<ScreenerDraftEntry[]>([]);
  const [trackedTickers, setTrackedTickers] = useState<Set<string>>(new Set());
  const [excludedTickers, setExcludedTickers] = useState<Record<string, { reason: string | null; excluded_at: string }>>({});
  const [loading, setLoading] = useState(true);
  const [pasteInput, setPasteInput] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [promoting, setPromoting] = useState<Set<string>>(new Set());
  const [promoteErrors, setPromoteErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | Status | "excluded">("new");

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [draft, watchlist, portfolio, usSwing, excluded] = await Promise.all([
        getScreenerDraft(),
        getWatchlistTickers(),
        getPortfolioTickers(),
        getUsSwingStocks(),
        getScreenerExcludedTickers(),
      ]);
      const tracked = new Set<string>([...watchlist, ...portfolio, ...Object.keys(usSwing)]);
      setTrackedTickers(tracked);
      setExcludedTickers(excluded);
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

  function parsePaste(raw: string): { ticker: string; company: string | null }[] {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows: { ticker: string; company: string | null }[] = [];
    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      // Accepts finviz_results.csv format ("#,Ticker,Company"), a bare "Ticker,Company" pair,
      // or a single ticker per line. Skip the header row.
      let ticker: string | undefined;
      let company: string | null = null;
      if (parts.length >= 3 && /^\d+$/.test(parts[0])) {
        ticker = parts[1];
        company = parts[2] || null;
      } else if (parts.length === 2 && parts[0].toLowerCase() !== "ticker") {
        ticker = parts[0];
        company = parts[1] || null;
      } else if (parts.length === 1 && parts[0].toLowerCase() !== "ticker" && parts[0] !== "#") {
        ticker = parts[0];
      }
      if (!ticker) continue;
      ticker = ticker.toUpperCase();
      if (!/^[A-Z.]{1,10}$/.test(ticker)) continue;
      rows.push({ ticker, company });
    }
    return rows;
  }

  async function handleImport() {
    setImportStatus(null);
    const rows = parsePaste(pasteInput);
    if (rows.length === 0) {
      setImportStatus("No valid tickers found in the pasted text.");
      return;
    }
    const existingTickers = new Set(entries.map((e) => e.ticker));
    const isExcluded = (t: string) => SCREENER_EXCLUDED_TICKERS.has(t) || t in excludedTickers;
    const excluded = rows.filter((r) => isExcluded(r.ticker));
    const toImport = rows.filter((r) => !isExcluded(r.ticker) && !existingTickers.has(r.ticker));

    setImporting(true);
    try {
      if (toImport.length > 0) await importScreenerDraftEntries(toImport);
      const skippedExisting = rows.length - excluded.length - toImport.length;
      setImportStatus(
        `Imported ${toImport.length} new ticker(s). Excluded ${excluded.length} (on exclusion list). ` +
        `Skipped ${skippedExisting} already in draft.`
      );
      setPasteInput("");
      await load();
    } finally {
      setImporting(false);
    }
  }

  async function handleExclude(ticker: string) {
    const reason = window.prompt(`Reason for excluding ${ticker}? (optional)`, "") || null;
    setEntries((prev) => prev.filter((e) => e.ticker !== ticker));
    setExcludedTickers((prev) => ({ ...prev, [ticker]: { reason, excluded_at: new Date().toISOString() } }));
    await Promise.all([excludeScreenerTicker(ticker, reason), removeScreenerDraftEntry(ticker)]);
  }

  async function handleUnexclude(ticker: string) {
    setExcludedTickers((prev) => { const next = { ...prev }; delete next[ticker]; return next; });
    await unexcludeScreenerTicker(ticker);
  }

  async function handlePromote(ticker: string) {
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
  const excludedList = useMemo(
    () => Object.entries(excludedTickers).sort(([a], [b]) => a.localeCompare(b)),
    [excludedTickers]
  );

  return (
    <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--foreground)]">Screener Draft</h1>
      </div>

      <div className="mb-6 rounded-lg border border-[var(--border)] bg-white p-4">
        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Paste screener output (finviz_results.csv contents, or one ticker per line)
        </label>
        <textarea
          value={pasteInput}
          onChange={(e) => setPasteInput(e.target.value)}
          rows={6}
          placeholder={"#,Ticker,Company\n1,NVDA,NVIDIA Corp\n2,JPM,JPMorgan Chase & Co\n..."}
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleImport}
            disabled={importing || !pasteInput.trim()}
            className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import"}
          </button>
          {importStatus && <span className="text-sm text-[var(--muted)]">{importStatus}</span>}
        </div>
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
          <p className="text-sm text-[var(--muted)]">No tickers excluded from within the app yet (the static doc-sourced exclusion list is applied automatically and isn&apos;t shown here).</p>
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
                    <td className="px-4 py-2.5 text-[var(--muted)] text-xs">{d.excluded_at.slice(0, 10)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleUnexclude(ticker)}
                        className="text-xs px-2.5 py-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/[0.04]"
                      >
                        Un-exclude
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing here yet — paste a screener run above to import it.</p>
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
