"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import ChecklistPanel from "@/components/ChecklistPanel";
import { calcIndicators, getLatest } from "@/lib/indicators";
import type { OHLCVBar, Indicators, LatestIndicators } from "@/lib/types";

const StockChart = dynamic(() => import("@/components/StockChart"), { ssr: false });

export default function Home() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [latest, setLatest] = useState<LatestIndicators | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sym = ticker.trim().toUpperCase();
    if (!sym) return;

    setLoading(true);
    setError("");
    setBars([]);
    setIndicators(null);
    setLatest(null);

    try {
      const res = await fetch(`/api/yahoo?ticker=${sym}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch");

      const fetchedBars: OHLCVBar[] = json.bars;
      const ind = calcIndicators(fetchedBars);
      const lat = getLatest(fetchedBars, ind);

      setBars(fetchedBars);
      setIndicators(ind);
      setLatest(lat);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Stock Analysis</h1>
          <p className="text-slate-400 text-sm mt-1">Weekly OHLCV + Technical Indicators</p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Enter ticker (e.g. NVDA)"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2.5 rounded-lg font-semibold transition-colors"
          >
            {loading ? "Loading…" : "Analyze"}
          </button>
        </form>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {bars.length > 0 && indicators && latest && (
          <div className="space-y-4">
            <StockChart bars={bars} indicators={indicators} />
            <ChecklistPanel indicators={latest} />
          </div>
        )}
      </div>
    </main>
  );
}
