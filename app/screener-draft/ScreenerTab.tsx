"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getWatchlistTickers, getPortfolioTickers, getPortfolioDivisionStocks, getUsSwingStocks, getCustomStocks,
} from "@/lib/firestore";
import { SCREENER_EXCLUDED_TICKERS } from "@/lib/screenerExclusions";
import { SEED_STOCKS } from "@/lib/seedData";
import type { ScreenerDraftEntry } from "@/lib/types";

type Status = "new" | "tracked";

// portfolio/watchlist are the US "List" tab's own owned/watchlisted bookkeeping (every List
// stock sits in exactly one) — not a swing-candidate tracker, so List membership there
// shouldn't mark a screener ticker "already tracked". us_swing_stocks and the Portfolio tab's
// Long Term division are real trackers, so those still count.
const LIST_TICKERS = new Set(SEED_STOCKS.map((s) => s.ticker));

export interface ScreenerTabConfig {
  apiRoute: string;
  criteriaText: string;
  // When false (Beaten Down Screener), no static doc-sourced exclusion list applies —
  // everything is fair game except what's already been excluded from this tab.
  useStaticExclusions: boolean;
  // When false (Beaten Down Screener), US-Swing membership doesn't count toward "already
  // tracked" — US-Swing tracks Swing Screener candidates specifically, not beaten-down ones.
  includeUsSwingInTracked: boolean;
  // Extra "already tracked" source beyond watchlist/portfolio/US-Swing — e.g. Coiling
  // Reversal tickers for the Beaten Down Screener, since that's where it promotes to.
  getExtraTracked?: () => Promise<Record<string, object>>;
  // Where "Add to X" / "Move to X" promotes a ticker to — US-Swing for the Swing Screener,
  // a Beaten Down list (e.g. Coiling Reversal) for the Beaten Down Screener.
  promoteTarget: {
    label: string;
    save: (ticker: string, data: { name: string | null; industry: string | null; added_at: string }) => Promise<void>;
  };
  getDraft: () => Promise<Record<string, { company: string | null; added_at: string; rank?: number }>>;
  importDraftEntries: (entries: { ticker: string; company: string | null; rank?: number }[]) => Promise<void>;
  removeDraftEntry: (ticker: string) => Promise<void>;
  updateDraftRanks: (entries: { ticker: string; company: string | null; rank?: number }[]) => Promise<void>;
  getExcluded: () => Promise<Record<string, { reason: string | null; excluded_at: string }>>;
  excludeTicker: (ticker: string, reason?: string | null) => Promise<void>;
  excludeTickersBulk: (tickers: string[], reason?: string | null) => Promise<void>;
  unexcludeTicker: (ticker: string) => Promise<void>;
  getExclusionOverrides?: () => Promise<Set<string>>;
  addExclusionOverride?: (ticker: string) => Promise<void>;
}

export default function ScreenerTab({ config }: { config: ScreenerTabConfig }) {
  const {
    apiRoute, criteriaText, useStaticExclusions, includeUsSwingInTracked, getExtraTracked, promoteTarget,
    getDraft, importDraftEntries, removeDraftEntry, updateDraftRanks,
    getExcluded, excludeTicker, excludeTickersBulk, unexcludeTicker,
    getExclusionOverrides, addExclusionOverride,
  } = config;

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
  const [manualTicker, setManualTicker] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [massExcluding, setMassExcluding] = useState(false);
  const [massExcludeError, setMassExcludeError] = useState<string | null>(null);
  const [massExcludeDone, setMassExcludeDone] = useState<number | null>(null);
  const [showMassExcludeConfirm, setShowMassExcludeConfirm] = useState(false);
  const [massExcludeReason, setMassExcludeReason] = useState("");

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [draft, watchlist, portfolio, usSwing, portfolioLongTerm, customStocks, excluded, overrides, extraTracked] = await Promise.all([
        getDraft(),
        getWatchlistTickers(),
        getPortfolioTickers(),
        getUsSwingStocks(),
        getPortfolioDivisionStocks("longterm"),
        getCustomStocks(),
        getExcluded(),
        getExclusionOverrides ? getExclusionOverrides() : Promise.resolve(new Set<string>()),
        getExtraTracked ? getExtraTracked() : Promise.resolve({} as Record<string, object>),
      ]);
      const listTickers = new Set([...LIST_TICKERS, ...Object.keys(customStocks)]);
      const tracked = new Set<string>([
        ...[...watchlist].filter((t) => !listTickers.has(t)),
        ...Object.keys(portfolioLongTerm),
        ...[...portfolio].filter((t) => !listTickers.has(t)),
        ...(includeUsSwingInTracked ? Object.keys(usSwing) : []),
        ...Object.keys(extraTracked),
      ]);
      setTrackedTickers(tracked);
      setExcludedTickers(excluded);
      setExclusionOverrides(overrides);
      const list: ScreenerDraftEntry[] = Object.entries(draft).map(([ticker, d]) => ({
        ticker,
        company: d.company ?? null,
        added_at: d.added_at,
        rank: d.rank,
      }));
      // Market cap desc, same as finviz's own sort — entries imported before `rank` existed
      // sort after everything ranked, alphabetically among themselves.
      list.sort((a, b) => {
        if (a.rank !== undefined && b.rank !== undefined) return a.rank - b.rank;
        if (a.rank !== undefined) return -1;
        if (b.rank !== undefined) return 1;
        return a.ticker.localeCompare(b.ticker);
      });
      setEntries(list);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiRoute, includeUsSwingInTracked, getExtraTracked]);

  useEffect(() => { load(true); }, [load]);

  const isExcluded = useCallback(
    (ticker: string) =>
      (useStaticExclusions && SCREENER_EXCLUDED_TICKERS.has(ticker) && !exclusionOverrides.has(ticker)) || ticker in excludedTickers,
    [exclusionOverrides, excludedTickers, useStaticExclusions]
  );

  async function handleRunScreener() {
    setRunStatus(null);
    setRunning(true);
    try {
      const res = await fetch(apiRoute);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Screener run failed (HTTP ${res.status}) — server did not return JSON`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Screener run failed");
      const rows: { ticker: string; company: string; rank: number }[] = data.results ?? [];

      const existingTickers = new Set(entries.map((e) => e.ticker));
      const excluded = rows.filter((r) => isExcluded(r.ticker));
      const notExcluded = rows.filter((r) => !isExcluded(r.ticker));
      const toImport = notExcluded.filter((r) => !existingTickers.has(r.ticker));
      const toRefreshRank = notExcluded.filter((r) => existingTickers.has(r.ticker));

      if (toImport.length > 0) await importDraftEntries(toImport);
      // Refresh rank (and company) on entries already in the draft too — otherwise a
      // re-run never updates rank for tickers already there, and the list looks unsorted
      // since only brand-new entries would carry a fresh rank.
      if (toRefreshRank.length > 0) await updateDraftRanks(toRefreshRank);
      setRunStatus(
        `Screener returned ${rows.length} ticker(s). Added ${toImport.length} new to the draft, ` +
        `${excluded.length} excluded, ${toRefreshRank.length} already in draft (rank refreshed).`
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
    await Promise.all([excludeTicker(ticker, reason), removeDraftEntry(ticker)]);
  }

  // Already-tracked tickers can't be "excluded" (that write is silently dropped from the
  // Excluded tab, which hides anything in trackedTickers) — just drop them from the draft.
  async function handleRemoveFromDraft(ticker: string) {
    setEntries((prev) => prev.filter((e) => e.ticker !== ticker));
    await removeDraftEntry(ticker);
  }

  async function handleManualExclude(e: React.FormEvent) {
    e.preventDefault();
    setManualError(null);
    const ticker = manualTicker.trim().toUpperCase();
    if (!ticker) return;
    if (isExcluded(ticker)) {
      setManualError(`${ticker} is already excluded.`);
      return;
    }
    if (trackedTickers.has(ticker)) {
      setManualError(`${ticker} is already tracked (watchlist/portfolio${includeUsSwingInTracked ? "/US-Swing" : ""}${getExtraTracked ? `/${promoteTarget.label}` : ""}) — remove it from there first.`);
      return;
    }
    const reason = manualReason.trim() || null;
    setEntries((prev) => prev.filter((e2) => e2.ticker !== ticker));
    setExcludedTickers((prev) => ({ ...prev, [ticker]: { reason, excluded_at: new Date().toISOString() } }));
    setManualTicker("");
    setManualReason("");
    await Promise.all([excludeTicker(ticker, reason), removeDraftEntry(ticker)]);
  }

  // Deliberately avoids window.confirm/window.prompt for this action: after several
  // window.prompt calls from single-ticker Exclude clicks in the same session, some
  // browsers silently suppress further dialogs ("prevent this page from creating
  // additional dialogs") — confirm() then returns false with zero visible feedback,
  // which looks exactly like "the button doesn't work". An inline confirm step can't
  // be suppressed that way.
  async function handleMassExclude() {
    setMassExcludeError(null);
    setMassExcludeDone(null);
    const newTickers = entries.filter((e) => !trackedTickers.has(e.ticker)).map((e) => e.ticker);
    if (newTickers.length === 0) return;
    const reason = massExcludeReason.trim() || null;
    setMassExcluding(true);
    try {
      // Write to Firestore first — entries/excludedTickers state is only updated on success,
      // so a failed write leaves every ticker exactly where it was (nothing vanishes).
      await excludeTickersBulk(newTickers, reason);
      const now = new Date().toISOString();
      setEntries((prev) => prev.filter((e) => !newTickers.includes(e.ticker)));
      setExcludedTickers((prev) => {
        const next = { ...prev };
        for (const ticker of newTickers) next[ticker] = { reason, excluded_at: now };
        return next;
      });
      setMassExcludeDone(newTickers.length);
      setShowMassExcludeConfirm(false);
      setMassExcludeReason("");
    } catch (err) {
      setMassExcludeError(err instanceof Error ? err.message : "Mass exclude failed — no tickers were changed.");
    } finally {
      setMassExcluding(false);
    }
  }

  async function handleDeleteExcluded(ticker: string, fromDoc: boolean) {
    if (fromDoc && addExclusionOverride) {
      setExclusionOverrides((prev) => new Set(prev).add(ticker));
      await addExclusionOverride(ticker);
    }
    if (ticker in excludedTickers) {
      setExcludedTickers((prev) => { const next = { ...prev }; delete next[ticker]; return next; });
      await unexcludeTicker(ticker);
    }
  }

  async function handlePromote(ticker: string, fromExcluded = false) {
    setPromoting((prev) => new Set(prev).add(ticker));
    setPromoteErrors((prev) => { const next = { ...prev }; delete next[ticker]; return next; });
    try {
      const res = await fetch(`/api/fundamentals?ticker=${ticker}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch data");
      await promoteTarget.save(ticker, {
        name: data.name ?? null,
        industry: data.industry ?? data.sector ?? null,
        added_at: new Date().toISOString(),
      });
      await removeDraftEntry(ticker);
      setEntries((prev) => prev.filter((e) => e.ticker !== ticker));
      setTrackedTickers((prev) => new Set(prev).add(ticker));
      if (fromExcluded) {
        await handleDeleteExcluded(ticker, useStaticExclusions && SCREENER_EXCLUDED_TICKERS.has(ticker));
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
    if (useStaticExclusions) {
      for (const ticker of SCREENER_EXCLUDED_TICKERS) {
        if (exclusionOverrides.has(ticker)) continue;
        merged[ticker] = { reason: "From exclusion doc", excluded_at: null, fromDoc: true };
      }
    }
    for (const [ticker, d] of Object.entries(excludedTickers)) {
      merged[ticker] = { reason: d.reason, excluded_at: d.excluded_at, fromDoc: false };
    }
    for (const ticker of trackedTickers) delete merged[ticker];
    return Object.entries(merged).sort(([a], [b]) => a.localeCompare(b));
  }, [excludedTickers, exclusionOverrides, trackedTickers, useStaticExclusions]);

  return (
    <div>
      <div className="mb-6 rounded-lg border border-[var(--border)] bg-white p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunScreener}
            disabled={running}
            className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50"
          >
            {running ? "Running Screener..." : "Run Screener"}
          </button>
          <span className="text-xs text-[var(--muted)]">{criteriaText}</span>
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

      {filter === "new" && (newCount > 0 || showMassExcludeConfirm || massExcludeError || massExcludeDone !== null) && (
        <div className="mb-4">
          {showMassExcludeConfirm ? (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 flex flex-wrap items-end gap-3">
              <div>
                <p className="text-sm text-red-700 font-medium mb-2">
                  Exclude all {newCount} &quot;New&quot; ticker(s)? Undo individually from the Excluded tab.
                </p>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">Reason (optional, applies to all)</label>
                <input
                  value={massExcludeReason}
                  onChange={(e) => setMassExcludeReason(e.target.value)}
                  placeholder="e.g. bulk cleanup"
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
              <button
                onClick={handleMassExclude}
                disabled={massExcluding}
                className="text-xs px-3 py-1.5 rounded-md bg-red-600 text-white font-medium disabled:opacity-50"
              >
                {massExcluding ? "Excluding..." : `Confirm Exclude All (${newCount})`}
              </button>
              <button
                onClick={() => { setShowMassExcludeConfirm(false); setMassExcludeReason(""); }}
                disabled={massExcluding}
                className="text-xs px-3 py-1.5 rounded-md text-[var(--muted)] hover:bg-black/[0.04] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : newCount > 0 ? (
            <button
              onClick={() => { setShowMassExcludeConfirm(true); setMassExcludeError(null); setMassExcludeDone(null); }}
              className="text-xs px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 font-medium"
            >
              Mass Exclude All ({newCount})
            </button>
          ) : null}
          {massExcludeError && <p className="text-xs text-red-600 mt-2">{massExcludeError}</p>}
          {massExcludeDone !== null && <p className="text-xs text-green-700 mt-2">Excluded {massExcludeDone} ticker(s).</p>}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      ) : filter === "excluded" ? (
        <>
        <form onSubmit={handleManualExclude} className="mb-4 rounded-lg border border-[var(--border)] bg-white p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">Ticker</label>
            <input
              value={manualTicker}
              onChange={(e) => setManualTicker(e.target.value)}
              placeholder="e.g. XYZ"
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">Reason (optional)</label>
            <input
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              placeholder="e.g. not on Pluang"
              className="w-full rounded-md border border-[var(--border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <button
            type="submit"
            disabled={!manualTicker.trim()}
            className="px-4 py-1.5 rounded-md bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50"
          >
            Add to Excluded
          </button>
          {manualError && <span className="text-sm text-red-600 w-full">{manualError}</span>}
        </form>
        {excludedList.length === 0 ? (
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
                        {promoting.has(ticker) ? "Adding..." : `Move to ${promoteTarget.label}`}
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
        )}
        </>
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
                        {promoting.has(row.ticker) ? "Adding..." : `Add to ${promoteTarget.label}`}
                      </button>
                    )}
                    {row.status === "new" ? (
                      <button
                        onClick={() => handleExclude(row.ticker)}
                        className="text-xs px-2.5 py-1 rounded-md text-[var(--muted)] hover:text-red-600 hover:bg-red-50"
                      >
                        Exclude
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRemoveFromDraft(row.ticker)}
                        className="text-xs px-2.5 py-1 rounded-md text-[var(--muted)] hover:text-red-600 hover:bg-red-50"
                      >
                        Remove from Draft
                      </button>
                    )}
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
