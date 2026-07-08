"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import ChecklistPanel from "@/components/ChecklistPanel";
import VerdictCard from "@/components/VerdictCard";
import { calcIndicators, getLatest } from "@/lib/indicators";
import type { OHLCVBar, Indicators, LatestIndicators, Verdict } from "@/lib/types";

const StockChart = dynamic(() => import("@/components/StockChart"), { ssr: false });

// Rough OBV pattern heuristic — Claude will interpret from the value trend
function detectObvPattern(obv: number[]): string {
  const valid = obv.filter((v) => !isNaN(v));
  if (valid.length < 10) return "insufficient_data";
  const recent = valid.slice(-10);
  const first = recent[0], mid = recent[4], last = recent[9];
  if (last > mid && mid > first) return "clean_staircase";
  if (mid > first && last < mid * 0.85) return "parabolic_rollover";
  if (last < mid && mid < first) return "sustained_downtrend";
  return "mixed";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BusinessQuality = any;

export default function Home() {
  const [ticker, setTicker] = useState("");
  const [inputTicker, setInputTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [latest, setLatest] = useState<LatestIndicators | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [businessQuality, setBusinessQuality] = useState<BusinessQuality>(null);

  async function runClaudeAnalysis(sym: string, lat: LatestIndicators, ind: Indicators, mode: "auto" | "reanalyze") {
    setAnalyzing(true);
    try {
      const obvPattern = detectObvPattern(ind.obv);
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: sym, name: sym, indicators: lat, obvPattern, mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Claude analysis failed");
      setVerdict(json.verdict);
      setBusinessQuality(json.businessQuality);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sym = inputTicker.trim().toUpperCase();
    if (!sym) return;

    setLoading(true);
    setError("");
    setBars([]);
    setIndicators(null);
    setLatest(null);
    setVerdict(null);
    setBusinessQuality(null);
    setTicker(sym);

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
      setLoading(false);

      // Auto-run Claude analysis
      await runClaudeAnalysis(sym, lat, ind, "auto");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Stock Analysis</h1>
          <p className="text-slate-400 text-sm mt-1">Weekly OHLCV · Technical Indicators · AI Verdict</p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={inputTicker}
            onChange={(e) => setInputTicker(e.target.value.toUpperCase())}
            placeholder="Enter ticker (e.g. NVDA)"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={loading || analyzing}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2.5 rounded-lg font-semibold transition-colors"
          >
            {loading ? "Fetching…" : analyzing ? "Analyzing…" : "Analyze"}
          </button>
        </form>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {bars.length > 0 && indicators && latest && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <StockChart bars={bars} indicators={indicators} />
              <ChecklistPanel indicators={latest} />
            </div>
            <div className="space-y-4">
              {analyzing && !verdict && (
                <div className="bg-slate-800 rounded-lg p-6 flex items-center justify-center text-slate-400 text-sm">
                  <span className="animate-pulse">Running AI analysis…</span>
                </div>
              )}
              {verdict && businessQuality && (
                <VerdictCard
                  ticker={ticker}
                  verdict={verdict}
                  businessQuality={businessQuality}
                  onReanalyze={() => runClaudeAnalysis(ticker, latest, indicators, "reanalyze")}
                  reanalyzing={analyzing}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
