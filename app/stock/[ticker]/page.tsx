"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import ChecklistPanel from "@/components/ChecklistPanel";
import VerdictCard from "@/components/VerdictCard";
import { calcIndicators, getLatest, getHistoricalArrays } from "@/lib/indicators";
import { SEED_STOCKS, FUNDAMENTALS_RAW, VALUATION_RAW } from "@/lib/seedData";
import type { FundData } from "@/app/api/funddata/route";
import type { OHLCVBar, Indicators, LatestIndicators, HistoricalArrays, Verdict } from "@/lib/types";

const StockChart = dynamic(() => import("@/components/StockChart"), { ssr: false });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BusinessQuality = any;

const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${(v * 100).toFixed(1)}%`;
const num = (v: number | null | undefined, dec = 1) =>
  v == null ? "—" : v.toFixed(dec);
const dollar = (v: number | null | undefined) =>
  v == null ? "—" : (v >= 0 ? `$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`);

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${highlight ?? "text-gray-900"}`}>{value}</span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function StockDataPanels({ sym, latest, fundData }: { sym: string; latest: LatestIndicators; fundData: FundData | null }) {
  const seed = SEED_STOCKS.find((s) => s.ticker === sym);
  const fr = FUNDAMENTALS_RAW[sym as keyof typeof FUNDAMENTALS_RAW];
  const vr = VALUATION_RAW[sym as keyof typeof VALUATION_RAW];

  const distEma20 = latest.price > 0 && latest.ema20 > 0
    ? ((latest.price - latest.ema20) / latest.ema20) * 100 : null;
  const distEma50 = latest.price > 0 && latest.ema50 > 0
    ? ((latest.price - latest.ema50) / latest.ema50) * 100 : null;

  const distColor = (d: number | null) => {
    if (d == null) return undefined;
    if (d < -10) return "text-red-500";
    if (d < 0) return "text-orange-500";
    if (d < 10) return "text-green-600";
    return "text-blue-600";
  };
  const rsiColor = (v: number | null) => {
    if (v == null) return undefined;
    if (v > 70) return "text-red-500";
    if (v < 40) return "text-blue-500";
    return undefined;
  };
  const cmfColor = (v: number | null) => {
    if (v == null) return undefined;
    if (v > 0.05) return "text-green-600";
    if (v < -0.05) return "text-red-500";
    return undefined;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Fundamentals */}
      <Panel title="Fundamentals">
        {seed && (
          <DataRow label="Fund Score" value={seed.fund.toFixed(1)} highlight={seed.fund >= 7.5 ? "text-green-600" : seed.fund >= 6 ? "text-yellow-600" : "text-red-500"} />
        )}
        <DataRow label="Rev Growth" value={pct(fr?.rev_growth)} />
        <DataRow label="Gross Margin" value={pct(fr?.gross_margin)} />
        <DataRow label="Op Margin" value={pct(fr?.op_margin)} />
        <DataRow label="FCF Margin" value={pct(fr?.fcf_margin)} />
        <DataRow label="ROE" value={fundData ? pct(fundData.roe) : "—"} />
        <DataRow label="D/E" value={fundData ? num(fundData.debt_to_equity, 2) : "—"} />
        <DataRow label="EPS TTM" value={fundData ? dollar(fundData.eps_ttm) : "—"} />
        <DataRow label="EPS Fwd" value={fundData ? dollar(fundData.eps_fwd) : "—"} />
        <DataRow label="EPS Past 5Y" value={fundData ? pct(fundData.eps_past_5y) : "—"} />
        <DataRow label="EPS Next 5Y" value={fundData ? pct(fundData.eps_next_5y) : "—"} />
        <DataRow label="Short Float" value={fundData ? pct(fundData.short_float) : "—"} />
      </Panel>

      {/* Valuation */}
      <Panel title="Valuation">
        {seed && (
          <DataRow label="Val Score" value={seed.val.toFixed(1)} highlight={seed.val >= 7.5 ? "text-green-600" : seed.val >= 6 ? "text-yellow-600" : "text-red-500"} />
        )}
        {seed && (
          <DataRow label="Combined Score" value={seed.combined.toFixed(1)} highlight={seed.combined >= 7.5 ? "text-green-600" : seed.combined >= 6 ? "text-yellow-600" : "text-red-500"} />
        )}
        <DataRow label="Fwd PE" value={vr ? num(vr.fwd_pe) : "—"} />
        <DataRow label="Trailing PE" value={fundData ? num(fundData.trailing_pe) : "—"} />
        <DataRow label="PEG" value={vr ? num(vr.peg, 2) : "—"} />
        <DataRow label="P/S" value={fundData ? num(fundData.ps_ratio) : "—"} />
        <DataRow label="P/B" value={fundData ? num(fundData.pb_ratio) : "—"} />
        <DataRow label="EV/EBITDA" value={vr ? num(vr.ev_ebitda) : "—"} />
        <DataRow label="EV/Revenue" value={fundData ? num(fundData.ev_revenue) : "—"} />
        <DataRow label="EV/FCF" value={vr ? num(vr.ev_fcf) : "—"} />
        <DataRow label="P/FCF" value={fundData ? num(fundData.p_fcf) : "—"} />
      </Panel>

      {/* Technical */}
      <Panel title="Technical (Weekly)">
        <DataRow label="Price" value={`$${latest.price.toFixed(2)}`} />
        <DataRow label="EMA20W" value={`$${latest.ema20.toFixed(2)}`} />
        <DataRow
          label="Dist EMA20W"
          value={distEma20 != null ? `${distEma20 > 0 ? "+" : ""}${distEma20.toFixed(1)}%` : "—"}
          highlight={distColor(distEma20)}
        />
        <DataRow label="EMA50W" value={`$${latest.ema50.toFixed(2)}`} />
        <DataRow
          label="Dist EMA50W"
          value={distEma50 != null ? `${distEma50 > 0 ? "+" : ""}${distEma50.toFixed(1)}%` : "—"}
          highlight={distColor(distEma50)}
        />
        <DataRow
          label="RSI"
          value={latest.rsi.toFixed(1)}
          highlight={rsiColor(latest.rsi)}
        />
        <DataRow label="DI+" value={latest.diPlus.toFixed(1)} />
        <DataRow label="DI-" value={latest.diMinus.toFixed(1)} />
        <DataRow
          label="CMF"
          value={latest.cmfVal.toFixed(3)}
          highlight={cmfColor(latest.cmfVal)}
        />
        <DataRow label="ADX" value={latest.adx.toFixed(1)} />
        <DataRow label="ATR%" value={`${latest.atrPct.toFixed(1)}%`} />
      </Panel>
    </div>
  );
}

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
  const [fundData, setFundData] = useState<FundData | null>(null);

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

        // Fetch live fundamental/valuation data in parallel with Claude
        fetch(`/api/funddata?tickers=${sym}`)
          .then((r) => r.json())
          .then((j) => { if (j.data?.[sym]) setFundData(j.data[sym]); })
          .catch(() => {});

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
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-gray-900 text-sm">← Back</Link>
          <h1 className="text-2xl font-bold">{sym}</h1>
          {loading && <span className="text-gray-400 text-sm animate-pulse">Loading…</span>}
          {analyzing && !loading && <span className="text-gray-400 text-sm animate-pulse">Analyzing…</span>}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-red-700 text-sm">{error}</div>
        )}

        {bars.length > 0 && indicators && latest && histArrays && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <StockChart bars={bars} indicators={indicators} />
                <ChecklistPanel indicators={latest} history={histArrays} />
              </div>
              <div className="space-y-4">
                {analyzing && !verdict && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center justify-center text-gray-400 text-sm">
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

            <StockDataPanels sym={sym} latest={latest} fundData={fundData} />
          </>
        )}
      </div>
    </main>
  );
}
