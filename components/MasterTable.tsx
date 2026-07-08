"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SEED_STOCKS, FUNDAMENTALS_RAW, VALUATION_RAW } from "@/lib/seedData";

type SortKey = "ticker" | "combined" | "val" | "fund" | "price" | "rev_growth" | "gross_margin" | "op_margin" | "fcf_margin" | "fwd_pe" | "peg" | "ev_ebitda";
type SortDir = "asc" | "desc";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmt = (v: number | null | undefined, decimals = 1) =>
  v == null ? <span className="text-gray-400">—</span> : v.toFixed(decimals);

const urgencyStyles: Record<string, string> = {
  urgent: "bg-green-100 text-green-700 border border-green-300",
  watch:  "bg-yellow-100 text-yellow-700 border border-yellow-300",
  hold:   "bg-blue-100 text-blue-700 border border-blue-300",
  avoid:  "bg-red-100 text-red-700 border border-red-300",
};

const scoreColor = (s: number) =>
  s >= 7.5 ? "text-green-600" : s >= 6 ? "text-yellow-600" : "text-red-500";

interface Props {
  prices: Record<string, number | null>;
  verdicts: Record<string, { urgency: string; setup: string } | null>;
  loading: boolean;
}

export default function MasterTable({ prices, verdicts, loading }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("combined");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [search, setSearch] = useState("");

  const industries = useMemo(() => {
    const set = new Set(SEED_STOCKS.map((s) => s.industry));
    return ["all", ...Array.from(set).sort()];
  }, []);

  const rows = useMemo(() => {
    let data = SEED_STOCKS.map((s) => ({
      ...s,
      price: prices[s.ticker] ?? null,
      fund_raw: FUNDAMENTALS_RAW[s.ticker],
      val_raw: VALUATION_RAW[s.ticker],
      verdict: verdicts[s.ticker] ?? null,
    }));

    if (industryFilter !== "all") data = data.filter((r) => r.industry === industryFilter);
    if (urgencyFilter !== "all") data = data.filter((r) => r.verdict?.urgency === urgencyFilter);
    if (search) data = data.filter((r) => r.ticker.includes(search.toUpperCase()));

    data.sort((a, b) => {
      let av: number | null = null;
      let bv: number | null = null;

      if (sortKey === "ticker") {
        return sortDir === "asc"
          ? a.ticker.localeCompare(b.ticker)
          : b.ticker.localeCompare(a.ticker);
      } else if (sortKey === "combined") { av = a.combined; bv = b.combined; }
      else if (sortKey === "val")        { av = a.val;      bv = b.val; }
      else if (sortKey === "fund")       { av = a.fund;     bv = b.fund; }
      else if (sortKey === "price")      { av = a.price;    bv = b.price; }
      else if (sortKey === "rev_growth") { av = a.fund_raw?.rev_growth ?? null; bv = b.fund_raw?.rev_growth ?? null; }
      else if (sortKey === "gross_margin") { av = a.fund_raw?.gross_margin ?? null; bv = b.fund_raw?.gross_margin ?? null; }
      else if (sortKey === "op_margin")  { av = a.fund_raw?.op_margin ?? null;    bv = b.fund_raw?.op_margin ?? null; }
      else if (sortKey === "fcf_margin") { av = a.fund_raw?.fcf_margin ?? null;   bv = b.fund_raw?.fcf_margin ?? null; }
      else if (sortKey === "fwd_pe")     { av = a.val_raw?.fwd_pe ?? null;        bv = b.val_raw?.fwd_pe ?? null; }
      else if (sortKey === "peg")        { av = a.val_raw?.peg ?? null;           bv = b.val_raw?.peg ?? null; }
      else if (sortKey === "ev_ebitda")  { av = a.val_raw?.ev_ebitda ?? null;     bv = b.val_raw?.ev_ebitda ?? null; }

      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return data;
  }, [prices, verdicts, sortKey, sortDir, industryFilter, urgencyFilter, search]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const Th = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 whitespace-nowrap"
      onClick={() => toggleSort(k)}
    >
      {label} {sortKey === k ? (sortDir === "desc" ? "↓" : "↑") : ""}
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search ticker…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 w-32"
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
        {loading && <span className="text-xs text-gray-400 self-center animate-pulse">Loading prices…</span>}
        <span className="text-xs text-gray-400 self-center">{rows.length} stocks</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <Th label="Ticker" k="ticker" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Industry</th>
              <Th label="Score" k="combined" />
              <Th label="Val" k="val" />
              <Th label="Fund" k="fund" />
              <Th label="Price" k="price" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Urgency</th>
              <Th label="Rev Gr" k="rev_growth" />
              <Th label="Gross%" k="gross_margin" />
              <Th label="Op%" k="op_margin" />
              <Th label="FCF%" k="fcf_margin" />
              <Th label="Fwd PE" k="fwd_pe" />
              <Th label="PEG" k="peg" />
              <Th label="EV/EBITDA" k="ev_ebitda" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.ticker} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 font-semibold">
                  <Link href={`/stock/${r.ticker}`} className="text-blue-600 hover:text-blue-800">
                    {r.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">{r.industry}</td>
                <td className={`px-3 py-2 font-bold ${scoreColor(r.combined)}`}>{r.combined.toFixed(1)}</td>
                <td className={`px-3 py-2 ${scoreColor(r.val)}`}>{r.val.toFixed(1)}</td>
                <td className={`px-3 py-2 ${scoreColor(r.fund)}`}>{r.fund.toFixed(1)}</td>
                <td className="px-3 py-2 text-gray-900">
                  {r.price != null ? `$${r.price.toFixed(2)}` : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2">
                  {r.verdict?.urgency ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${urgencyStyles[r.verdict.urgency] ?? ""}`}>
                      {r.verdict.urgency}
                    </span>
                  ) : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="px-3 py-2 text-gray-700">{r.fund_raw ? pct(r.fund_raw.rev_growth) : "—"}</td>
                <td className="px-3 py-2 text-gray-700">{r.fund_raw ? pct(r.fund_raw.gross_margin) : "—"}</td>
                <td className="px-3 py-2 text-gray-700">{r.fund_raw ? pct(r.fund_raw.op_margin) : "—"}</td>
                <td className="px-3 py-2 text-gray-700">{r.fund_raw ? pct(r.fund_raw.fcf_margin) : "—"}</td>
                <td className="px-3 py-2 text-gray-700">{fmt(r.val_raw?.fwd_pe)}</td>
                <td className="px-3 py-2 text-gray-700">{fmt(r.val_raw?.peg, 2)}</td>
                <td className="px-3 py-2 text-gray-700">{fmt(r.val_raw?.ev_ebitda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
