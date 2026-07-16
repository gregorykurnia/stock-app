"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MasterTable from "@/components/MasterTable";
import { SEED_STOCKS } from "@/lib/seedData";
import {
  loadStockData, getCustomStocks, saveCustomStock, removeCustomStock,
  getPortfolioTickers, getWatchlistTickers,
  savePortfolioEntry, removePortfolioEntry,
  saveWatchlistEntry, removeWatchlistEntry,
  getMarkedTickers, markTicker, unmarkTicker,
} from "@/lib/firestore";
import type { CustomStock } from "@/lib/types";
import type { FundData } from "@/app/api/funddata/route";

const SEED_TICKERS = new Set(SEED_STOCKS.map((s) => s.ticker));

export default function Home() {
  const router = useRouter();
  const [inputTicker, setInputTicker] = useState("");
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [verdicts, setVerdicts] = useState<Record<string, { urgency: string; setup: string } | null>>({});
  const [atrs, setAtrs] = useState<Record<string, number | null>>({});
  const [ema20s, setEma20s] = useState<Record<string, number | null>>({});
  const [ema50s, setEma50s] = useState<Record<string, number | null>>({});
  const [supportLows, setSupportLows] = useState<Record<string, number | null>>({});
  const [rsis, setRsis] = useState<Record<string, number | null>>({});
  const [diPluses, setDiPluses] = useState<Record<string, number | null>>({});
  const [diMinuses, setDiMinuses] = useState<Record<string, number | null>>({});
  const [cmfs, setCmfs] = useState<Record<string, number | null>>({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const [customStocks, setCustomStocks] = useState<CustomStock[]>([]);
  const [fundData, setFundData] = useState<Record<string, FundData>>({});
  const [portfolioSet, setPortfolioSet] = useState<Set<string>>(new Set());
  const [watchlistSet, setWatchlistSet] = useState<Set<string>>(new Set());
  const [markedSet, setMarkedSet] = useState<Set<string>>(new Set());

  // Add stock modal
  const [showAdd, setShowAdd] = useState(false);
  const [addTicker, setAddTicker] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  async function loadSets() {
    const [p, w, m] = await Promise.all([getPortfolioTickers(), getWatchlistTickers(), getMarkedTickers()]);
    setPortfolioSet(p);
    setWatchlistSet(w);
    setMarkedSet(m);
  }

  async function handleToggleMark(ticker: string) {
    if (markedSet.has(ticker)) {
      await unmarkTicker(ticker);
      setMarkedSet((prev) => { const s = new Set(prev); s.delete(ticker); return s; });
    } else {
      await markTicker(ticker);
      setMarkedSet((prev) => new Set(prev).add(ticker));
    }
  }

  async function loadCustomStocks() {
    const data = await getCustomStocks().catch(() => ({}));
    const list = Object.entries(data).map(([ticker, d]) => ({ ticker, ...(d as object) } as CustomStock));
    list.sort((a, b) => a.ticker.localeCompare(b.ticker));
    setCustomStocks(list);
    return list;
  }

  useEffect(() => {
    const seedTickers = SEED_STOCKS.map((s) => s.ticker).join(",");

    fetch(`/api/prices?tickers=${seedTickers}`)
      .then((r) => r.json())
      .then((d) => setPrices((p) => ({ ...p, ...(d.prices ?? {}) })))
      .catch(() => {})
      .finally(() => setPricesLoading(false));

    fetch(`/api/ema?tickers=${seedTickers}`)
      .then((r) => r.json())
      .then((d) => {
        setAtrs(d.atrPct ?? {});
        setEma20s(d.ema20 ?? {});
        setEma50s(d.ema50 ?? {});
        setSupportLows(d.supportLow ?? {});
        setRsis(d.rsi ?? {});
        setDiPluses(d.diPlus ?? {});
        setDiMinuses(d.diMinus ?? {});
        setCmfs(d.cmf ?? {});
      })
      .catch(() => {});

    fetch(`/api/funddata?tickers=${seedTickers}`)
      .then((r) => r.json())
      .then((d) => setFundData((prev) => ({ ...prev, ...(d.data ?? {}) })))
      .catch(() => {});

    Promise.all(
      SEED_STOCKS.map(async (s) => {
        const data = await loadStockData(s.ticker).catch(() => null);
        return { ticker: s.ticker, verdict: data?.latest_verdict ?? null };
      })
    ).then((results) => {
      const map: Record<string, { urgency: string; setup: string } | null> = {};
      results.forEach(({ ticker, verdict }) => {
        map[ticker] = verdict ? { urgency: verdict.urgency, setup: verdict.setup } : null;
      });
      setVerdicts(map);
    });

    loadCustomStocks().then((list) => {
      if (list.length > 0) {
        const tickers = list.map((s) => s.ticker).join(",");
        fetch(`/api/prices?tickers=${tickers}`)
          .then((r) => r.json())
          .then((d) => setPrices((p) => ({ ...p, ...(d.prices ?? {}) })))
          .catch(() => {});
        fetch(`/api/funddata?tickers=${tickers}`)
          .then((r) => r.json())
          .then((d) => setFundData((prev) => ({ ...prev, ...(d.data ?? {}) })))
          .catch(() => {});
        fetch(`/api/ema?tickers=${tickers}`)
          .then((r) => r.json())
          .then((d) => {
            setAtrs((prev) => ({ ...prev, ...(d.atrPct ?? {}) }));
            setEma20s((prev) => ({ ...prev, ...(d.ema20 ?? {}) }));
            setEma50s((prev) => ({ ...prev, ...(d.ema50 ?? {}) }));
            setSupportLows((prev) => ({ ...prev, ...(d.supportLow ?? {}) }));
            setRsis((prev) => ({ ...prev, ...(d.rsi ?? {}) }));
            setDiPluses((prev) => ({ ...prev, ...(d.diPlus ?? {}) }));
            setDiMinuses((prev) => ({ ...prev, ...(d.diMinus ?? {}) }));
            setCmfs((prev) => ({ ...prev, ...(d.cmf ?? {}) }));
          })
          .catch(() => {});
      }
    });

    loadSets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSetStatus(ticker: string, status: "portfolio" | "watchlist" | null) {
    const inPortfolio = portfolioSet.has(ticker);
    const inWatchlist = watchlistSet.has(ticker);

    if (status === "portfolio") {
      if (inPortfolio) {
        // Toggle off
        await removePortfolioEntry(ticker);
      } else {
        if (inWatchlist) await removeWatchlistEntry(ticker);
        await savePortfolioEntry(ticker, {
          shares: 0, entry_price: 0, stop_level: 0,
          date_entered: new Date().toISOString().split("T")[0], notes: "",
        });
      }
    } else if (status === "watchlist") {
      if (inWatchlist) {
        // Toggle off
        await removeWatchlistEntry(ticker);
      } else {
        if (inPortfolio) await removePortfolioEntry(ticker);
        await saveWatchlistEntry(ticker, {
          alert_price: 0, entry_zone: "", verdict: "watch",
          date_added: new Date().toISOString().split("T")[0], notes: "",
        });
      }
    }
    await loadSets();
  }

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    const sym = addTicker.trim().toUpperCase();
    if (!sym) return;
    if (SEED_TICKERS.has(sym)) {
      setAddError(`${sym} is already in the master table.`);
      return;
    }
    setAddLoading(true);
    setAddError("");
    try {
      const res = await fetch(`/api/fundamentals?ticker=${sym}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch data");

      const entry: CustomStock = {
        ...data,
        added_at: new Date().toISOString(),
        last_fetched: new Date().toISOString(),
      };
      await saveCustomStock(sym, entry);
      if (data.price != null) setPrices((p) => ({ ...p, [sym]: data.price }));
      fetch(`/api/funddata?tickers=${sym}`)
        .then((r) => r.json())
        .then((d) => setFundData((prev) => ({ ...prev, ...(d.data ?? {}) })))
        .catch(() => {});
      fetch(`/api/ema?tickers=${sym}`)
        .then((r) => r.json())
        .then((d) => {
          setAtrs((prev) => ({ ...prev, ...(d.atrPct ?? {}) }));
          setEma20s((prev) => ({ ...prev, ...(d.ema20 ?? {}) }));
          setEma50s((prev) => ({ ...prev, ...(d.ema50 ?? {}) }));
          setSupportLows((prev) => ({ ...prev, ...(d.supportLow ?? {}) }));
          setRsis((prev) => ({ ...prev, ...(d.rsi ?? {}) }));
          setDiPluses((prev) => ({ ...prev, ...(d.diPlus ?? {}) }));
          setDiMinuses((prev) => ({ ...prev, ...(d.diMinus ?? {}) }));
          setCmfs((prev) => ({ ...prev, ...(d.cmf ?? {}) }));
        })
        .catch(() => {});
      setAddTicker("");
      setShowAdd(false);
      await loadCustomStocks();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemoveCustom(ticker: string) {
    if (!confirm(`Remove ${ticker} from the master table?`)) return;
    await removeCustomStock(ticker);
    await removePortfolioEntry(ticker).catch(() => {});
    await removeWatchlistEntry(ticker).catch(() => {});
    await Promise.all([loadCustomStocks(), loadSets()]);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const sym = inputTicker.trim().toUpperCase();
    if (sym) router.push(`/stock/${sym}`);
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-screen-xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Analysis</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {54 + customStocks.length} stocks · Weekly framework · AI verdicts
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setShowAdd(true); setAddError(""); }}
              className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
            >
              + Add Stock
            </button>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={inputTicker}
                onChange={(e) => setInputTicker(e.target.value.toUpperCase())}
                placeholder="Analyze ticker…"
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 w-40 text-sm"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
              >
                Analyze →
              </button>
            </form>
          </div>
        </div>

        {showAdd && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <form
              onSubmit={handleAddStock}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4"
            >
              <div>
                <h2 className="font-bold text-lg text-gray-900">Add Stock to Master Table</h2>
                <p className="text-xs text-gray-500 mt-1">Fetches fundamentals + valuation live from Yahoo Finance</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Ticker Symbol</label>
                <input
                  required
                  autoFocus
                  value={addTicker}
                  onChange={(e) => { setAddTicker(e.target.value.toUpperCase()); setAddError(""); }}
                  placeholder="e.g. TSLA"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-wider"
                />
              </div>
              {addError && <p className="text-red-500 text-xs">{addError}</p>}
              {addLoading && <p className="text-blue-500 text-xs animate-pulse">Fetching data from Yahoo Finance…</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold"
                >
                  {addLoading ? "Fetching…" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setAddError(""); setAddTicker(""); }}
                  className="flex-1 border border-gray-300 text-gray-600 hover:text-gray-800 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <MasterTable
          prices={prices}
          verdicts={verdicts}
          atrs={atrs}
          ema20s={ema20s}
          ema50s={ema50s}
          supportLows={supportLows}
          rsis={rsis}
          diPluses={diPluses}
          diMinuses={diMinuses}
          cmfs={cmfs}
          fundData={fundData}
          loading={pricesLoading}
          customStocks={customStocks}
          portfolioSet={portfolioSet}
          watchlistSet={watchlistSet}
          markedSet={markedSet}
          onSetStatus={handleSetStatus}
          onRemoveCustom={handleRemoveCustom}
          onToggleMark={handleToggleMark}
        />
      </div>
    </main>
  );
}
