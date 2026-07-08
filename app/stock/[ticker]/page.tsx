"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import ChecklistPanel from "@/components/ChecklistPanel";
import VerdictCard from "@/components/VerdictCard";
import { calcIndicators, getLatest, getHistoricalArrays } from "@/lib/indicators";
import type { OHLCVBar, Indicators, LatestIndicators, HistoricalArrays, Verdict } from "@/lib/types";

const StockChart = dynamic(() => import("@/components/StockChart"), { ssr: false });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BusinessQuality = any;

export default function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const sym = ticker.toUpperCase();

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [latest, setLatest] = useState<LatestIndicators | null>(null);
  const [histArrays, setHistArrays] = useState<HistoricalArrays | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [businessQuality, setBusinessQuality] = useState<BusinessQuality>(null);

  async function runClaudeAnalysis(lat: LatestIndicators, ind: Indicators, b: OHLCVBar[], mode: "auto" | "reanalyze") {
    setAnalyzing(true);
    try {
      const historicalArrays: HistoricalArrays = getHistoricalArrays(b, ind, 20);
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: sym, name: sym, indicators: lat, historicalArrays, mode }),
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

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/yahoo?ticker=${sym}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to fetch");

        const fetchedBars: OHLCVBar[] = json.bars;
        const ind = calcIndicators(fetchedBars);
        const lat = getLatest(fetchedBars, ind);
        const hist = getHistoricalArrays(fetchedBars, ind, 20);

        setBars(fetchedBars);
        setIndicators(ind);
        setLatest(lat);
        setHistArrays(hist);
        setLoading(false);

        await runClaudeAnalysis(lat, ind, fetchedBars, "auto");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym]);

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-white text-sm">← Back</Link>
          <h1 className="text-2xl font-bold">{sym}</h1>
          {loading && <span className="text-slate-500 text-sm animate-pulse">Loading…</span>}
          {analyzing && !loading && <span className="text-slate-500 text-sm animate-pulse">Analyzing…</span>}
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">{error}</div>
        )}

        {bars.length > 0 && indicators && latest && histArrays && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <StockChart bars={bars} indicators={indicators} />
              <ChecklistPanel indicators={latest} history={histArrays} />
            </div>
            <div className="space-y-4">
              {analyzing && !verdict && (
                <div className="bg-slate-800 rounded-lg p-6 flex items-center justify-center text-slate-400 text-sm">
                  <span className="animate-pulse">Running AI analysis…</span>
                </div>
              )}
              {verdict && businessQuality && (
                <VerdictCard
                  ticker={sym}
                  verdict={verdict}
                  businessQuality={businessQuality}
                  onReanalyze={() => runClaudeAnalysis(latest, indicators, bars, "reanalyze")}
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
