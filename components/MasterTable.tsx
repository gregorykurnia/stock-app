"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SEED_STOCKS, FUNDAMENTALS_RAW, VALUATION_RAW } from "@/lib/seedData";
import { atrLabel } from "@/lib/indicators";
import { downloadCsv } from "@/lib/exportCsv";
import type { CustomStock } from "@/lib/types";

type SortKey =
  | "ticker" | "combined" | "val" | "fund" | "price" | "industry" | "urgency"
  | "rev_growth" | "gross_margin" | "op_margin" | "net_margin" | "fcf_margin"
  | "fwd_pe" | "peg" | "ev_ebitda" | "ev_fcf";
type SortDir = "asc" | "desc";

const pct = (v: number | null | undefined) =>
  v == null ? <span className="text-gray-400">—</span> : `${(v * 100).toFixed(1)}%`;

const num = (v: number | null | undefined, dec = 1) =>
  v == null ? <span className="text-gray-400">—</span> : v.toFixed(dec);

const urgencyStyles: Record<string, string> = {
  urgent: "bg-green-100 text-green-700 border border-green-300",
  watch:  "bg-yellow-100 text-yellow-700 border border-yellow-300",
  hold:   "bg-blue-100 text-blue-700 border border-blue-300",
  avoid:  "bg-red-100 text-red-700 border border-red-300",
};

const scoreColor = (s: number | null) =>
  s == null ? "text-gray-400" : s >= 7.5 ? "text-green-600" : s >= 6 ? "text-yellow-600" : "text-red-500";

interface TableRow {
  ticker: string;
  name: string | null;
  industry: string;
  // Scores (seed only)
  combined: number | null;
  val: number | null;
  fund: number | null;
  // Raw fundamentals
  rev_growth: number | null;
  gross_margin: number | null;
  op_margin: number | null;
  net_margin: number | null;
  fcf_margin: number | null;
  // Raw valuation
  fwd_pe: number | null;
  peg: number | null;
  ev_ebitda: number | null;
  ev_fcf: number | null;
  // Live
  price: number | null;
  verdict: { urgency: string; setup: string } | null;
  isCustom: boolean;
}

interface Props {
  prices: Record<string, number | null>;
  verdicts: Record<string, { urgency: string; setup: string } | null>;
  atrs: Record<string, number | null>;
  loading: boolean;
  customStocks: CustomStock[];
  portfolioSet: Set<string>;
  watchlistSet: Set<string>;
  onSetStatus: (ticker: string, status: "portfolio" | "watchlist") => void;
  onRemoveCustom: (ticker: string) => void;
}

type SubTab = "all" | "fundamental" | "valuation" | "technical";

export default function MasterTable({ prices, verdicts, atrs, loading, customStocks, portfolioSet, watchlistSet, onSetStatus, onRemoveCustom }: Props) {
  const [activeTab, setActiveTab] = useState<SubTab>("all");
  const [sortKey, setSortKey] = useState<SortKey>("combined");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [search, setSearch] = useState("");

  const allRows = useMemo((): TableRow[] => {
    const seedRows: TableRow[] = SEED_STOCKS.map((s) => {
      const fr = FUNDAMENTALS_RAW[s.ticker];
      const vr = VALUATION_RAW[s.ticker];
      return {
        ticker: s.ticker,
        name: null,
        industry: s.industry,
        combined: s.combined,
        val: s.val,
        fund: s.fund,
        rev_growth: fr?.rev_growth ?? null,
        gross_margin: fr?.gross_margin ?? null,
        op_margin: fr?.op_margin ?? null,
        net_margin: null,
        fcf_margin: fr?.fcf_margin ?? null,
        fwd_pe: vr?.fwd_pe ?? null,
        peg: vr?.peg ?? null,
        ev_ebitda: vr?.ev_ebitda ?? null,
        ev_fcf: vr?.ev_fcf ?? null,
        price: prices[s.ticker] ?? null,
        verdict: verdicts[s.ticker] ?? null,
        isCustom: false,
      };
    });

    const customRows: TableRow[] = customStocks.map((c) => ({
      ticker: c.ticker,
      name: c.name,
      industry: c.industry ?? c.sector ?? "—",
      combined: null,
      val: null,
      fund: null,
      rev_growth: c.rev_growth,
      gross_margin: c.gross_margin,
      op_margin: c.op_margin,
      net_margin: c.net_margin,
      fcf_margin: c.fcf_margin,
      fwd_pe: c.fwd_pe,
      peg: c.peg,
      ev_ebitda: c.ev_ebitda,
      ev_fcf: c.ev_fcf,
      price: prices[c.ticker] ?? null,
      verdict: verdicts[c.ticker] ?? null,
      isCustom: true,
    }));

    return [...seedRows, ...customRows];
  }, [prices, verdicts, customStocks]);

  const industries = useMemo(() => {
    const set = new Set(allRows.map((r) => r.industry));
    return ["all", ...Array.from(set).sort()];
  }, [allRows]);

  const rows = useMemo(() => {
    let data = [...allRows];

    if (industryFilter !== "all") data = data.filter((r) => r.industry === industryFilter);
    if (urgencyFilter !== "all") data = data.filter((r) => r.verdict?.urgency === urgencyFilter);
    if (search) data = data.filter((r) => r.ticker.includes(search.toUpperCase()) || r.name?.toUpperCase().includes(search.toUpperCase()));

    data.sort((a, b) => {
      if (sortKey === "ticker") {
        return sortDir === "asc" ? a.ticker.localeCompare(b.ticker) : b.ticker.localeCompare(a.ticker);
      }
      if (sortKey === "industry") {
        return sortDir === "asc" ? a.industry.localeCompare(b.industry) : b.industry.localeCompare(a.industry);
      }
      if (sortKey === "urgency") {
        const order = ["urgent", "watch", "hold", "avoid", ""];
        const ai = order.indexOf(a.verdict?.urgency ?? "");
        const bi = order.indexOf(b.verdict?.urgency ?? "");
        return sortDir === "asc" ? ai - bi : bi - ai;
      }

      const keyMap: Record<string, (r: TableRow) => number | null> = {
        combined: (r) => r.combined,
        val:      (r) => r.val,
        fund:     (r) => r.fund,
        price:    (r) => r.price,
        rev_growth:   (r) => r.rev_growth,
        gross_margin: (r) => r.gross_margin,
        op_margin:    (r) => r.op_margin,
        net_margin:   (r) => r.net_margin,
        fcf_margin:   (r) => r.fcf_margin,
        fwd_pe:   (r) => r.fwd_pe,
        peg:      (r) => r.peg,
        ev_ebitda:(r) => r.ev_ebitda,
        ev_fcf:   (r) => r.ev_fcf,
      };

      const av = keyMap[sortKey]?.(a) ?? null;
      const bv = keyMap[sortKey]?.(b) ?? null;

      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return data;
  }, [allRows, sortKey, sortDir, industryFilter, urgencyFilter, search]);

  function exportCsv() {
    const headers = ["Ticker", "Industry", "Score", "Val", "Fund", "Price", "ATR%", "Urgency", "Rev Gr%", "Gross%", "Op%", "Net%", "FCF%", "Fwd PE", "PEG", "EV/EBITDA", "EV/FCF"];
    const data = rows.map((r) => [
      r.ticker, r.industry,
      r.combined?.toFixed(1) ?? "", r.val?.toFixed(1) ?? "", r.fund?.toFixed(1) ?? "",
      r.price?.toFixed(2) ?? "",
      atrs[r.ticker]?.toFixed(1) ?? "",
      r.verdict?.urgency ?? "",
      r.rev_growth != null ? (r.rev_growth * 100).toFixed(1) : "",
      r.gross_margin != null ? (r.gross_margin * 100).toFixed(1) : "",
      r.op_margin != null ? (r.op_margin * 100).toFixed(1) : "",
      r.net_margin != null ? (r.net_margin * 100).toFixed(1) : "",
      r.fcf_margin != null ? (r.fcf_margin * 100).toFixed(1) : "",
      r.fwd_pe?.toFixed(2) ?? "", r.peg?.toFixed(2) ?? "",
      r.ev_ebitda?.toFixed(1) ?? "", r.ev_fcf?.toFixed(1) ?? "",
    ]);
    downloadCsv(`master-table-${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const Th = ({ label, k, title, sticky }: { label: string; k: SortKey; title?: string; sticky?: boolean }) => (
    <th
      title={title}
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 whitespace-nowrap select-none${sticky ? " sticky left-0 z-20 bg-gray-100 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-300 after:content-['']" : ""}`}
      onClick={() => toggleSort(k)}
    >
      {label}{sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  const tabs: { id: SubTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "fundamental", label: "Fundamental" },
    { id: "valuation", label: "Valuation" },
    { id: "technical", label: "Technical" },
  ];

  return (
    <div className="space-y-3">
      {/* Subtabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Placeholder panels for non-All tabs */}
      {activeTab === "fundamental" && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400 text-sm">
          Fundamental view — coming soon
        </div>
      )}
      {activeTab === "valuation" && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400 text-sm">
          Valuation view — coming soon
        </div>
      )}
      {activeTab === "technical" && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400 text-sm">
          Technical view — coming soon
        </div>
      )}

      {activeTab === "all" && <>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 w-36"
        />
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900"
        >
          {industries.map((i) => (
            <option key={i} value={i}>{i === "all" ? "All Industries" : i}</option>
          ))}
        </select>
        <select
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
          className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900"
        >
          <option value="all">All Urgency</option>
          <option value="urgent">Urgent</option>
          <option value="watch">Watch</option>
          <option value="hold">Hold</option>
          <option value="avoid">Avoid</option>
        </select>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Loading prices…</span>}
        <span className="text-xs text-gray-400">{rows.length} stocks</span>
        <button
          onClick={exportCsv}
          className="ml-auto text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 bg-white"
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <Th label="Ticker"    k="ticker" sticky />
              <Th label="Industry"  k="industry" />
              <Th label="Score"     k="combined" title="Combined score (seed stocks only)" />
              <Th label="Val"       k="val"      title="Valuation score (seed stocks only)" />
              <Th label="Fund"      k="fund"     title="Fundamentals score (seed stocks only)" />
              <Th label="Price"     k="price" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" title="Weekly ATR% — volatility as % of price">ATR%</th>
              <Th label="Urgency"   k="urgency" />
              <Th label="Rev Gr"    k="rev_growth"   title="Revenue Growth YoY" />
              <Th label="Gross%"    k="gross_margin" title="Gross Margin" />
              <Th label="Op%"       k="op_margin"    title="Operating Margin" />
              <Th label="Net%"      k="net_margin"   title="Net/Profit Margin" />
              <Th label="FCF%"      k="fcf_margin"   title="Free Cash Flow Margin" />
              <Th label="Fwd PE"    k="fwd_pe" />
              <Th label="PEG"       k="peg" />
              <Th label="EV/EBITDA" k="ev_ebitda" />
              <Th label="EV/FCF"    k="ev_fcf" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.ticker} className={`group hover:bg-gray-50 transition-colors ${r.isCustom ? "bg-blue-50/30" : ""}`}>
                <td className={`px-3 py-2 font-semibold whitespace-nowrap sticky left-0 z-10 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-200 after:content-[''] group-hover:bg-gray-50 ${r.isCustom ? "bg-blue-50/30 group-hover:bg-blue-100/40" : "bg-white"}`}>
                  <Link href={`/stock/${r.ticker}`} className="text-blue-600 hover:text-blue-800">
                    {r.ticker}
                  </Link>
                  {r.name && <span className="block text-xs text-gray-400 font-normal leading-tight">{r.name}</span>}
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{r.industry}</td>
                <td className={`px-3 py-2 font-bold ${scoreColor(r.combined)}`}>
                  {r.combined != null ? r.combined.toFixed(1) : <span className="text-gray-300">—</span>}
                </td>
                <td className={`px-3 py-2 ${scoreColor(r.val)}`}>
                  {r.val != null ? r.val.toFixed(1) : <span className="text-gray-300">—</span>}
                </td>
                <td className={`px-3 py-2 ${scoreColor(r.fund)}`}>
                  {r.fund != null ? r.fund.toFixed(1) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                  {r.price != null ? `$${r.price.toFixed(2)}` : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {(() => {
                    const v = atrs[r.ticker];
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
                <td className="px-3 py-2">
                  {r.verdict?.urgency ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${urgencyStyles[r.verdict.urgency] ?? ""}`}>
                      {r.verdict.urgency}
                    </span>
                  ) : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="px-3 py-2 text-gray-700">{pct(r.rev_growth)}</td>
                <td className="px-3 py-2 text-gray-700">{pct(r.gross_margin)}</td>
                <td className="px-3 py-2 text-gray-700">{pct(r.op_margin)}</td>
                <td className="px-3 py-2 text-gray-700">{pct(r.net_margin)}</td>
                <td className="px-3 py-2 text-gray-700">{pct(r.fcf_margin)}</td>
                <td className="px-3 py-2 text-gray-700">{num(r.fwd_pe)}</td>
                <td className="px-3 py-2 text-gray-700">{num(r.peg, 2)}</td>
                <td className="px-3 py-2 text-gray-700">{num(r.ev_ebitda)}</td>
                <td className="px-3 py-2 text-gray-700">{num(r.ev_fcf)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {portfolioSet.has(r.ticker) ? (
                      <button
                        onClick={() => onSetStatus(r.ticker, "portfolio")}
                        className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
                        title="In Portfolio — click to remove"
                      >
                        ✓ Portfolio
                      </button>
                    ) : watchlistSet.has(r.ticker) ? (
                      <button
                        onClick={() => onSetStatus(r.ticker, "watchlist")}
                        className="text-xs px-2 py-0.5 rounded-full font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300 hover:bg-yellow-200"
                        title="In Watchlist — click to remove"
                      >
                        ✓ Watchlist
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onSetStatus(r.ticker, "portfolio")}
                          className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600"
                        >
                          + Portfolio
                        </button>
                        <button
                          onClick={() => onSetStatus(r.ticker, "watchlist")}
                          className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-500 hover:border-yellow-400 hover:text-yellow-600"
                        >
                          + Watchlist
                        </button>
                      </>
                    )}
                    {r.isCustom && (
                      <button
                        onClick={() => onRemoveCustom(r.ticker)}
                        className="text-red-300 hover:text-red-500 text-xs ml-1"
                        title="Remove from master table"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>}
    </div>
  );
}
