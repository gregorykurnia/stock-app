"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getWatchlist, saveWatchlistEntry, removeWatchlistEntry, getCustomStocks, loadStockData } from "@/lib/firestore";
import { downloadCsv } from "@/lib/exportCsv";
import { getCached, setCached, invalidateCache } from "@/lib/pageCache";
import { SEED_STOCKS, FUNDAMENTALS_RAW, VALUATION_RAW } from "@/lib/seedData";
import { atrLabel } from "@/lib/indicators";
import type { CustomStock } from "@/lib/types";

const SEED_MAP = new Set(SEED_STOCKS.map((s) => s.ticker));

const pct = (v: number | null | undefined) => v == null ? "—" : `${(v * 100).toFixed(1)}%`;
const num = (v: number | null | undefined, dec = 1) => v == null ? "—" : v.toFixed(dec);

const urgencyStyles: Record<string, string> = {
  urgent: "bg-green-100 text-green-700 border border-green-300",
  watch:  "bg-yellow-100 text-yellow-700 border border-yellow-300",
  hold:   "bg-blue-100 text-blue-700 border border-blue-300",
  avoid:  "bg-red-100 text-red-700 border border-red-300",
};

const setupCfg: Record<string, { label: string; cls: string }> = {
  beaten_down: { label: "Beaten Down", cls: "bg-orange-100 text-orange-700" },
  pullback:    { label: "Pullback",    cls: "bg-blue-100 text-blue-700"     },
  parabolic:   { label: "Parabolic",   cls: "bg-purple-100 text-purple-700" },
};

interface WatchlistRow {
  ticker: string;
  name: string | null;
  industry: string | null;
  alert_price: number;
  entry_zone: string;
  verdict: string;
  notes: string;
  date_added: string;
  gross_margin: number | null;
  op_margin: number | null;
  net_margin: number | null;
  fcf_margin: number | null;
  rev_growth: number | null;
  fwd_pe: number | null;
  peg: number | null;
  ev_ebitda: number | null;
  price: number | null;
}

type SortKey =
  | "ticker" | "setup" | "price"
  | "ema20" | "dist20" | "ema50" | "dist50"
  | "alert_price" | "verdict"
  | "rev_growth" | "gross_margin" | "op_margin" | "net_margin" | "fcf_margin"
  | "fwd_pe" | "peg" | "ev_ebitda"
  | "date_added";

function EditCell({ value, onSave, prefix = "" }: { value: number; onSave: (v: number) => void; prefix?: string }) {
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
        autoFocus type="number" step="0.01" value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-24 border border-blue-400 rounded px-1 py-0.5 text-sm focus:outline-none"
      />
    );
  }
  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="text-left hover:bg-blue-50 hover:text-blue-700 rounded px-1 -mx-1 transition-colors cursor-text"
      title="Click to edit"
    >
      {prefix}{value > 0 ? value.toFixed(2) : <span className="text-gray-400 italic">click to set</span>}
    </button>
  );
}

function EditTextCell({ value, onSave, placeholder = "—" }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    if (draft !== value) onSave(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus type="text" value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-28 border border-blue-400 rounded px-1 py-0.5 text-sm focus:outline-none"
      />
    );
  }
  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="text-left hover:bg-blue-50 hover:text-blue-700 rounded px-1 -mx-1 transition-colors cursor-text max-w-[120px] truncate"
      title={value || placeholder}
    >
      {value || <span className="text-gray-400 italic">{placeholder}</span>}
    </button>
  );
}

function VerdictCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <select
        autoFocus
        value={value}
        onChange={(e) => { onSave(e.target.value); setEditing(false); }}
        onBlur={() => setEditing(false)}
        className="border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none"
      >
        {["urgent", "watch", "hold", "avoid"].map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    );
  }
  return (
    <button onClick={() => setEditing(true)} title="Click to change">
      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase cursor-pointer ${urgencyStyles[value] ?? "bg-gray-100 text-gray-500"}`}>
        {value}
      </span>
    </button>
  );
}

export default function WatchlistPage() {
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [ema20s, setEma20s] = useState<Record<string, number | null>>({});
  const [ema50s, setEma50s] = useState<Record<string, number | null>>({});
  const [atrPcts, setAtrPcts] = useState<Record<string, number | null>>({});
  const [setups, setSetups] = useState<Record<string, string>>({});
  const [emaLoading, setEmaLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  function handleSort(key: SortKey) {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => d === 1 ? -1 : 1); return key; }
      setSortDir(1); return key;
    });
  }

  function getSortValue(r: WatchlistRow, key: SortKey): number | string {
    const cur = prices[r.ticker] ?? null;
    const ema20 = ema20s[r.ticker] ?? null;
    const ema50 = ema50s[r.ticker] ?? null;
    const NULL_HIGH = 1e15, NULL_LOW = -1e15;
    switch (key) {
      case "ticker":      return r.ticker;
      case "setup":       return setups[r.ticker] ?? "";
      case "price":       return cur ?? NULL_LOW;
      case "ema20":       return ema20 ?? NULL_LOW;
      case "dist20":      return cur != null && ema20 != null ? (cur - ema20) / ema20 : NULL_LOW;
      case "ema50":       return ema50 ?? NULL_LOW;
      case "dist50":      return cur != null && ema50 != null ? (cur - ema50) / ema50 : NULL_LOW;
      case "alert_price": return r.alert_price;
      case "verdict":     return r.verdict;
      case "rev_growth":  return r.rev_growth ?? NULL_LOW;
      case "gross_margin":return r.gross_margin ?? NULL_LOW;
      case "op_margin":   return r.op_margin ?? NULL_LOW;
      case "net_margin":  return r.net_margin ?? NULL_LOW;
      case "fcf_margin":  return r.fcf_margin ?? NULL_LOW;
      case "fwd_pe":      return r.fwd_pe ?? NULL_HIGH;
      case "peg":         return r.peg ?? NULL_HIGH;
      case "ev_ebitda":   return r.ev_ebitda ?? NULL_HIGH;
      case "date_added":  return r.date_added;
    }
  }

  const load = useCallback(async (background = false) => {
    if (!background) {
      const hit = getCached<{ rows: WatchlistRow[]; prices: Record<string, number | null> }>("watchlist");
      if (hit) {
        setRows(hit.rows);
        setPrices(hit.prices);
        setLoading(false);
        load(true);
        return;
      }
    }
    if (!background) setLoading(true);
    try {
      const [watchlistData, customData] = await Promise.all([
        getWatchlist(),
        getCustomStocks(),
      ]);

      const customMap = new Map(
        Object.entries(customData).map(([t, d]) => [t, d as CustomStock])
      );

      const built: WatchlistRow[] = Object.entries(watchlistData).map(([ticker, raw]) => {
        const w = raw as Record<string, unknown>;
        const fr = FUNDAMENTALS_RAW[ticker];
        const vr = VALUATION_RAW[ticker];
        const custom = customMap.get(ticker);
        const isSeed = SEED_MAP.has(ticker);

        return {
          ticker,
          name: custom?.name ?? null,
          industry: isSeed ? null : (custom?.industry ?? custom?.sector ?? null),
          alert_price: Number(w.alert_price ?? 0),
          entry_zone: String(w.entry_zone ?? ""),
          verdict: String(w.verdict ?? "watch"),
          notes: String(w.notes ?? ""),
          date_added: String(w.date_added ?? ""),
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
        const pricesData = json.prices ?? {};
        setPrices(pricesData);
        setCached("watchlist", { rows: built, prices: pricesData });

        // Fetch setups from Firestore latest_verdict
        const setupResults = await Promise.all(
          built.map(async (row) => {
            const data = await loadStockData(row.ticker).catch(() => null);
            return [row.ticker, (data as Record<string, Record<string, string>> | null)?.latest_verdict?.setup ?? ""] as [string, string];
          })
        );
        setSetups(Object.fromEntries(setupResults));

        setEmaLoading(true);
        fetch(`/api/ema?tickers=${tickers}`)
          .then((r) => r.json())
          .then((d) => {
            setEma20s(d.ema20 ?? {});
            setEma50s(d.ema50 ?? {});
            setAtrPcts(d.atrPct ?? {});
          })
          .catch(() => {})
          .finally(() => setEmaLoading(false));
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
      alert_price: row.alert_price, entry_zone: row.entry_zone,
      verdict: row.verdict, notes: row.notes, date_added: row.date_added,
      [field]: value,
    };
    await saveWatchlistEntry(ticker, updated);
    setRows((prev) => prev.map((r) => r.ticker === ticker ? { ...r, [field]: value } : r));
  }

  async function handleRemove(ticker: string) {
    if (!confirm(`Remove ${ticker} from watchlist? (It stays in the master table.)`)) return;
    await removeWatchlistEntry(ticker);
    invalidateCache("watchlist");
    await load();
  }

  const headersLeft: [SortKey, string][] = [
    ["ticker", "Ticker"], ["setup", "Setup"], ["price", "Price"],
    ["ema20", "EMA20w"], ["dist20", "Dist 20w"], ["ema50", "EMA50w"], ["dist50", "Dist 50w"],
    ["alert_price", "Alert ✎"], ["verdict", "Verdict ✎"],
  ];
  const headersRight: [SortKey, string][] = [
    ["rev_growth", "Rev Gr"], ["gross_margin", "Gross%"], ["op_margin", "Op%"], ["net_margin", "Net%"], ["fcf_margin", "FCF%"],
    ["fwd_pe", "Fwd PE"], ["peg", "PEG"], ["ev_ebitda", "EV/EBITDA"],
    ["date_added", "Date Added"],
  ];

  const sorted = [...rows].sort((a, b) => {
    const av = getSortValue(a, sortKey);
    const bv = getSortValue(b, sortKey);
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * sortDir;
    return ((av as number) - (bv as number)) * sortDir;
  });

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Watchlist</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Added from master table · Click any value to edit inline{emaLoading && <span className="ml-2 text-blue-400 animate-pulse">Fetching EMAs…</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const headers = ["Ticker", "Setup", "Price", "EMA20w", "Dist 20w%", "EMA50w", "Dist 50w%", "ATR%", "Alert Price", "Verdict", "Rev Gr%", "Gross%", "Op%", "Net%", "FCF%", "Fwd PE", "PEG", "EV/EBITDA", "Notes", "Date Added"];
                const data = sorted.map((r) => {
                  const cur = prices[r.ticker] ?? null;
                  const ema20 = ema20s[r.ticker] ?? null;
                  const ema50 = ema50s[r.ticker] ?? null;
                  const dist20 = cur != null && ema20 != null ? ((cur - ema20) / ema20 * 100).toFixed(1) : "";
                  const dist50 = cur != null && ema50 != null ? ((cur - ema50) / ema50 * 100).toFixed(1) : "";
                  return [
                    r.ticker, setups[r.ticker] ?? "",
                    cur?.toFixed(2) ?? "",
                    ema20?.toFixed(2) ?? "", dist20,
                    ema50?.toFixed(2) ?? "", dist50,
                    atrPcts[r.ticker]?.toFixed(1) ?? "",
                    r.alert_price > 0 ? r.alert_price : "", r.verdict,
                    r.rev_growth != null ? (r.rev_growth * 100).toFixed(1) : "",
                    r.gross_margin != null ? (r.gross_margin * 100).toFixed(1) : "",
                    r.op_margin != null ? (r.op_margin * 100).toFixed(1) : "",
                    r.net_margin != null ? (r.net_margin * 100).toFixed(1) : "",
                    r.fcf_margin != null ? (r.fcf_margin * 100).toFixed(1) : "",
                    r.fwd_pe?.toFixed(2) ?? "", r.peg?.toFixed(2) ?? "",
                    r.ev_ebitda?.toFixed(1) ?? "",
                    r.notes, r.date_added,
                  ];
                });
                downloadCsv(`watchlist-${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
              }}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 bg-white"
            >
              Export CSV
            </button>
            <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
              ← Back to Master Table
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 animate-pulse text-sm">Loading watchlist…</p>
        ) : rows.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
            Watchlist is empty. Go to the <Link href="/" className="text-blue-500 hover:underline">Master Table</Link> and click &quot;+ Watchlist&quot; on any stock.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  {headersLeft.map(([key, label]) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-800 hover:bg-gray-200 transition-colors"
                    >
                      {label}
                      {sortKey === key && <span className="ml-1">{sortDir === 1 ? "↑" : "↓"}</span>}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" title="Weekly ATR% — volatility as % of price">ATR%</th>
                  {headersRight.map(([key, label]) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-800 hover:bg-gray-200 transition-colors"
                    >
                      {label}
                      {sortKey === key && <span className="ml-1">{sortDir === 1 ? "↑" : "↓"}</span>}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Notes ✎</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((r) => {
                  const cur = prices[r.ticker] ?? null;
                  const ema20 = ema20s[r.ticker] ?? null;
                  const ema50 = ema50s[r.ticker] ?? null;
                  const dist20 = cur != null && ema20 != null ? (cur - ema20) / ema20 : null;
                  const dist50 = cur != null && ema50 != null ? (cur - ema50) / ema50 : null;
                  const nearAlert = cur != null && r.alert_price > 0 && Math.abs(cur - r.alert_price) / r.alert_price < 0.03;
                  const setup = setups[r.ticker];
                  const setupStyle = setupCfg[setup];
                  return (
                    <tr key={r.ticker} className={`hover:bg-gray-50 transition-colors ${nearAlert ? "bg-yellow-50" : ""}`}>
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">
                        <Link href={`/stock/${r.ticker}`} className="text-blue-600 hover:text-blue-800">{r.ticker}</Link>
                        {nearAlert && <span className="ml-1 text-xs text-yellow-600 font-medium">Near!</span>}
                        {r.name && <span className="block text-xs text-gray-400 font-normal">{r.name}</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {setupStyle
                          ? <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${setupStyle.cls}`}>{setupStyle.label}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-900 font-medium whitespace-nowrap">
                        {cur != null ? `$${cur.toFixed(2)}` : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {ema20 != null ? `$${ema20.toFixed(2)}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className={`px-3 py-2 font-medium whitespace-nowrap ${dist20 != null ? (dist20 > 0 ? "text-green-600" : "text-red-500") : "text-gray-300"}`}>
                        {dist20 != null ? `${(dist20 * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {ema50 != null ? `$${ema50.toFixed(2)}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className={`px-3 py-2 font-medium whitespace-nowrap ${dist50 != null ? (dist50 > 0 ? "text-green-600" : "text-red-500") : "text-gray-300"}`}>
                        {dist50 != null ? `${(dist50 * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <EditCell value={r.alert_price} prefix="$" onSave={(v) => updateField(r.ticker, "alert_price", v)} />
                      </td>
                      <td className="px-3 py-2">
                        <VerdictCell value={r.verdict} onSave={(v) => updateField(r.ticker, "verdict", v)} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {(() => {
                          const v = atrPcts[r.ticker];
                          if (v == null) return <span className="text-gray-300">—</span>;
                          const al = atrLabel(v);
                          return (
                            <div>
                              <span className={`font-semibold ${al.color}`}>{v.toFixed(1)}%</span>
                              <span className={`block text-xs leading-tight ${al.color} opacity-80`}>{al.label}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{pct(r.rev_growth)}</td>
                      <td className="px-3 py-2 text-gray-600">{pct(r.gross_margin)}</td>
                      <td className="px-3 py-2 text-gray-600">{pct(r.op_margin)}</td>
                      <td className="px-3 py-2 text-gray-600">{pct(r.net_margin)}</td>
                      <td className="px-3 py-2 text-gray-600">{pct(r.fcf_margin)}</td>
                      <td className="px-3 py-2 text-gray-600">{num(r.fwd_pe)}</td>
                      <td className="px-3 py-2 text-gray-600">{num(r.peg, 2)}</td>
                      <td className="px-3 py-2 text-gray-600">{num(r.ev_ebitda)}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{r.date_added}</td>
                      <td className="px-3 py-2">
                        <EditTextCell value={r.notes} placeholder="add notes" onSave={(v) => updateField(r.ticker, "notes", v)} />
                      </td>
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
