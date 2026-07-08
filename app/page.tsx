"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MasterTable from "@/components/MasterTable";
import { SEED_STOCKS } from "@/lib/seedData";
import { loadStockData } from "@/lib/firestore";

export default function Home() {
  const router = useRouter();
  const [inputTicker, setInputTicker] = useState("");
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [verdicts, setVerdicts] = useState<Record<string, { urgency: string; setup: string } | null>>({});
  const [pricesLoading, setPricesLoading] = useState(true);

  useEffect(() => {
    const tickers = SEED_STOCKS.map((s) => s.ticker).join(",");

    // Fetch live prices
    fetch(`/api/prices?tickers=${tickers}`)
      .then((r) => r.json())
      .then((d) => setPrices(d.prices ?? {}))
      .catch(() => {})
      .finally(() => setPricesLoading(false));

    // Load saved verdicts from Firestore
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
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const sym = inputTicker.trim().toUpperCase();
    if (sym) router.push(`/stock/${sym}`);
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-screen-xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Stock Analysis</h1>
            <p className="text-slate-400 text-sm mt-0.5">54 stocks · Weekly framework · AI verdicts</p>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={inputTicker}
              onChange={(e) => setInputTicker(e.target.value.toUpperCase())}
              placeholder="Any ticker…"
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36 text-sm"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
            >
              Analyze →
            </button>
          </form>
        </div>

        <MasterTable prices={prices} verdicts={verdicts} loading={pricesLoading} />
      </div>
    </main>
  );
}
