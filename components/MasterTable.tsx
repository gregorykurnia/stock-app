"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SEED_STOCKS, FUNDAMENTALS_RAW, VALUATION_RAW } from "@/lib/seedData";
import { IHSG_STOCKS, type IhsgStock } from "@/lib/ihsgSeedData";
import { atrLabel } from "@/lib/indicators";
import { downloadCsv } from "@/lib/exportCsv";
import type { CustomStock } from "@/lib/types";
import type { FundData } from "@/app/api/funddata/route";

type SortKey =
  | "ticker" | "combined" | "val" | "fund" | "price" | "industry" | "urgency" | "atr"
  | "rev_growth" | "gross_margin" | "op_margin" | "net_margin" | "fcf_margin"
  | "fwd_pe" | "peg" | "ev_ebitda" | "ev_fcf"
  | "trailing_pe" | "ps_ratio" | "pb_ratio" | "ev_revenue" | "p_fcf" | "dividend_yield"
  | "roe" | "debt_to_equity" | "eps_ttm" | "eps_fwd" | "eps_past_5y" | "eps_next_5y" | "short_float"
  | "ema20" | "dist_ema20" | "ema50" | "dist_ema50" | "rsi" | "di_plus" | "di_minus" | "cmf";
type SortDir = "asc" | "desc";
type SubTab = "all" | "fundamental" | "valuation" | "technical";

const pct = (v: number | null | undefined) =>
  v == null ? <span className="text-gray-400">—</span> : `${(v * 100).toFixed(1)}%`;

const num = (v: number | null | undefined, dec = 1) =>
  v == null ? <span className="text-gray-400">—</span> : v.toFixed(dec);

const eps = (v: number | null | undefined) =>
  v == null ? <span className="text-gray-400">—</span> : (v >= 0 ? `$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`);

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
  // Raw fundamentals (seed data)
  rev_growth: number | null;
  gross_margin: number | null;
  op_margin: number | null;
  net_margin: number | null;
  fcf_margin: number | null;
  // Fetched fundamentals
  roe: number | null;
  debt_to_equity: number | null;
  eps_ttm: number | null;
  eps_fwd: number | null;
  eps_past_5y: number | null;
  eps_next_5y: number | null;
  short_float: number | null;
  // Raw valuation (seed)
  fwd_pe: number | null;
  peg: number | null;
  ev_ebitda: number | null;
  ev_fcf: number | null;
  // Fetched valuation
  trailing_pe: number | null;
  ps_ratio: number | null;
  pb_ratio: number | null;
  ev_revenue: number | null;
  p_fcf: number | null;
  dividend_yield: number | null;
  // Live
  price: number | null;
  verdict: { urgency: string; setup: string } | null;
  isCustom: boolean;
}

interface Props {
  market?: "us" | "ihsg";
  ihsgStocks?: IhsgStock[];
  prices: Record<string, number | null>;
  preMarketPrices: Record<string, number | null>;
  verdicts: Record<string, { urgency: string; setup: string } | null>;
  atrs: Record<string, number | null>;
  ema20s: Record<string, number | null>;
  ema50s: Record<string, number | null>;
  supportLows: Record<string, number | null>;
  rsis: Record<string, number | null>;
  diPluses: Record<string, number | null>;
  diMinuses: Record<string, number | null>;
  cmfs: Record<string, number | null>;
  fundData: Record<string, FundData>;
  loading: boolean;
  customStocks: CustomStock[];
  portfolioSet: Set<string>;
  watchlistSet: Set<string>;
  markedSet: Set<string>;
  onSetStatus: (ticker: string, status: "portfolio" | "watchlist") => void;
  onRemoveCustom: (ticker: string) => void;
  onToggleMark: (ticker: string) => void;
}

export default function MasterTable({ market = "us", ihsgStocks, prices, preMarketPrices, verdicts, atrs, ema20s, ema50s, supportLows, rsis, diPluses, diMinuses, cmfs, fundData, loading, customStocks, portfolioSet, watchlistSet, markedSet, onSetStatus, onRemoveCustom, onToggleMark }: Props) {
  const isIhsg = market === "ihsg";
  // Currency prefix and price formatter
  const fmtPrice = (v: number) => isIhsg ? `Rp${Math.round(v).toLocaleString("id-ID")}` : `$${v.toFixed(2)}`;
  const [activeTab, setActiveTab] = useState<SubTab>("all");
  const [sortKey, setSortKey] = useState<SortKey>("combined");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [search, setSearch] = useState("");

  const allRows = useMemo((): TableRow[] => {
    if (isIhsg) {
      const seedStocks = ihsgStocks ?? IHSG_STOCKS;
      const seedRows = seedStocks.map((s) => {
        const fd = fundData[s.ticker] ?? {};
        return {
          ticker: s.ticker,
          name: null,
          industry: s.industry,
          combined: s.combined,
          val: s.val,
          fund: s.fund,
          rev_growth: fd.rev_growth ?? null,
          gross_margin: fd.gross_margin ?? null,
          op_margin: fd.op_margin ?? null,
          net_margin: null,
          fcf_margin: fd.fcf_margin ?? null,
          roe: fd.roe ?? null,
          debt_to_equity: fd.debt_to_equity ?? null,
          eps_ttm: fd.eps_ttm ?? null,
          eps_fwd: fd.eps_fwd ?? null,
          eps_past_5y: fd.eps_past_5y ?? null,
          eps_next_5y: fd.eps_next_5y ?? null,
          short_float: fd.short_float ?? null,
          fwd_pe: fd.fwd_pe ?? null,
          peg: fd.peg ?? null,
          ev_ebitda: fd.ev_ebitda ?? null,
          ev_fcf: fd.ev_fcf ?? null,
          trailing_pe: fd.trailing_pe ?? null,
          ps_ratio: fd.ps_ratio ?? null,
          pb_ratio: fd.pb_ratio ?? null,
          ev_revenue: fd.ev_revenue ?? null,
          p_fcf: fd.p_fcf ?? null,
          dividend_yield: fd.dividend_yield ?? null,
          price: prices[s.ticker] ?? null,
          verdict: verdicts[s.ticker] ?? null,
          isCustom: false,
        } as TableRow;
      });
      const customRows: TableRow[] = customStocks.map((c) => {
        const fd = fundData[c.ticker] ?? {};
        return {
          ticker: c.ticker,
          name: c.name,
          industry: c.industry ?? c.sector ?? "—",
          combined: null, val: null, fund: null,
          rev_growth: c.rev_growth, gross_margin: c.gross_margin,
          op_margin: c.op_margin, net_margin: c.net_margin, fcf_margin: c.fcf_margin,
          roe: fd.roe ?? null, debt_to_equity: fd.debt_to_equity ?? null,
          eps_ttm: fd.eps_ttm ?? null, eps_fwd: fd.eps_fwd ?? null,
          eps_past_5y: fd.eps_past_5y ?? null, eps_next_5y: fd.eps_next_5y ?? null,
          short_float: fd.short_float ?? null,
          fwd_pe: c.fwd_pe, peg: c.peg, ev_ebitda: c.ev_ebitda, ev_fcf: c.ev_fcf,
          trailing_pe: fd.trailing_pe ?? null, ps_ratio: fd.ps_ratio ?? null,
          pb_ratio: fd.pb_ratio ?? null, ev_revenue: fd.ev_revenue ?? null, p_fcf: fd.p_fcf ?? null,
          dividend_yield: fd.dividend_yield ?? null,
          price: prices[c.ticker] ?? null,
          verdict: verdicts[c.ticker] ?? null,
          isCustom: true,
        };
      });
      return [...seedRows, ...customRows];
    }

    const seedRows: TableRow[] = SEED_STOCKS.map((s) => {
      const fr = FUNDAMENTALS_RAW[s.ticker];
      const vr = VALUATION_RAW[s.ticker];
      const fd = fundData[s.ticker] ?? {};
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
        roe: fd.roe ?? null,
        debt_to_equity: fd.debt_to_equity ?? null,
        eps_ttm: fd.eps_ttm ?? null,
        eps_fwd: fd.eps_fwd ?? null,
        eps_past_5y: fd.eps_past_5y ?? null,
        eps_next_5y: fd.eps_next_5y ?? null,
        short_float: fd.short_float ?? null,
        fwd_pe: vr?.fwd_pe ?? null,
        peg: vr?.peg ?? null,
        ev_ebitda: vr?.ev_ebitda ?? null,
        ev_fcf: vr?.ev_fcf ?? null,
        trailing_pe: fd.trailing_pe ?? null,
        ps_ratio: fd.ps_ratio ?? null,
        pb_ratio: fd.pb_ratio ?? null,
        ev_revenue: fd.ev_revenue ?? null,
        p_fcf: fd.p_fcf ?? null,
        dividend_yield: fd.dividend_yield ?? null,
        price: prices[s.ticker] ?? null,
        verdict: verdicts[s.ticker] ?? null,
        isCustom: false,
      };
    });

    const customRows: TableRow[] = customStocks.map((c) => {
      const fd = fundData[c.ticker] ?? {};
      return {
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
        roe: fd.roe ?? null,
        debt_to_equity: fd.debt_to_equity ?? null,
        eps_ttm: fd.eps_ttm ?? null,
        eps_fwd: fd.eps_fwd ?? null,
        eps_past_5y: fd.eps_past_5y ?? null,
        eps_next_5y: fd.eps_next_5y ?? null,
        short_float: fd.short_float ?? null,
        fwd_pe: c.fwd_pe,
        peg: c.peg,
        ev_ebitda: c.ev_ebitda,
        ev_fcf: c.ev_fcf,
        trailing_pe: fundData[c.ticker]?.trailing_pe ?? null,
        ps_ratio: fundData[c.ticker]?.ps_ratio ?? null,
        pb_ratio: fundData[c.ticker]?.pb_ratio ?? null,
        ev_revenue: fundData[c.ticker]?.ev_revenue ?? null,
        p_fcf: fundData[c.ticker]?.p_fcf ?? null,
        dividend_yield: fundData[c.ticker]?.dividend_yield ?? null,
        price: prices[c.ticker] ?? null,
        verdict: verdicts[c.ticker] ?? null,
        isCustom: true,
      };
    });

    return [...seedRows, ...customRows];
  }, [prices, verdicts, customStocks, fundData]);

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
        atr:      (r) => atrs[r.ticker] ?? null,
        ema20:    (r) => ema20s[r.ticker] ?? null,
        dist_ema20: (r) => {
          const p = prices[r.ticker] ?? null; const e = ema20s[r.ticker] ?? null;
          return p != null && e != null ? ((p - e) / e) * 100 : null;
        },
        ema50:    (r) => ema50s[r.ticker] ?? null,
        dist_ema50: (r) => {
          const p = prices[r.ticker] ?? null; const e = ema50s[r.ticker] ?? null;
          return p != null && e != null ? ((p - e) / e) * 100 : null;
        },
        rsi:      (r) => rsis[r.ticker] ?? null,
        di_plus:  (r) => diPluses[r.ticker] ?? null,
        di_minus: (r) => diMinuses[r.ticker] ?? null,
        cmf:      (r) => cmfs[r.ticker] ?? null,
        rev_growth:    (r) => r.rev_growth,
        gross_margin:  (r) => r.gross_margin,
        op_margin:     (r) => r.op_margin,
        net_margin:    (r) => r.net_margin,
        fcf_margin:    (r) => r.fcf_margin,
        roe:           (r) => r.roe,
        debt_to_equity:(r) => r.debt_to_equity,
        eps_ttm:       (r) => r.eps_ttm,
        eps_fwd:       (r) => r.eps_fwd,
        eps_past_5y:   (r) => r.eps_past_5y,
        eps_next_5y:   (r) => r.eps_next_5y,
        short_float:   (r) => r.short_float,
        fwd_pe:    (r) => r.fwd_pe,
        peg:       (r) => r.peg,
        ev_ebitda: (r) => r.ev_ebitda,
        ev_fcf:    (r) => r.ev_fcf,
        trailing_pe:    (r) => r.trailing_pe,
        ps_ratio:       (r) => r.ps_ratio,
        pb_ratio:       (r) => r.pb_ratio,
        ev_revenue:     (r) => r.ev_revenue,
        p_fcf:          (r) => r.p_fcf,
        dividend_yield: (r) => r.dividend_yield,
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
    const date = new Date().toISOString().slice(0, 10);
    const marked = (r: TableRow) => markedSet.has(r.ticker) ? "yes" : "";

    if (activeTab === "fundamental") {
      const headers = ["Ticker", "Industry", "Rev Gr%", "Gross%", "Op%", "FCF%",
        "ROE%", "D/E", "EPS TTM", "EPS Fwd", "EPS Past 5Y%", "EPS Next 5Y%", "Short Float%", "Marked"];
      const data = rows.map((r) => [
        r.ticker, r.industry,
        r.rev_growth != null ? (r.rev_growth * 100).toFixed(1) : "",
        r.gross_margin != null ? (r.gross_margin * 100).toFixed(1) : "",
        r.op_margin != null ? (r.op_margin * 100).toFixed(1) : "",
        r.fcf_margin != null ? (r.fcf_margin * 100).toFixed(1) : "",
        r.roe != null ? (r.roe * 100).toFixed(1) : "",
        r.debt_to_equity?.toFixed(2) ?? "",
        r.eps_ttm?.toFixed(2) ?? "", r.eps_fwd?.toFixed(2) ?? "",
        r.eps_past_5y != null ? (r.eps_past_5y * 100).toFixed(1) : "",
        r.eps_next_5y != null ? (r.eps_next_5y * 100).toFixed(1) : "",
        r.short_float != null ? (r.short_float * 100).toFixed(1) : "",
        marked(r),
      ]);
      return downloadCsv(`fundamental-${date}.csv`, headers, data);
    }

    if (activeTab === "valuation") {
      const headers = ["Ticker", "Industry", "Fwd PE", "Trail PE", "PEG",
        "P/S", "P/B", "EV/EBITDA", "EV/Rev", "EV/FCF", "P/FCF", "Marked"];
      const data = rows.map((r) => [
        r.ticker, r.industry,
        r.fwd_pe?.toFixed(2) ?? "", r.trailing_pe?.toFixed(2) ?? "", r.peg?.toFixed(2) ?? "",
        r.ps_ratio?.toFixed(2) ?? "", r.pb_ratio?.toFixed(2) ?? "",
        r.ev_ebitda?.toFixed(1) ?? "", r.ev_revenue?.toFixed(2) ?? "",
        r.ev_fcf?.toFixed(1) ?? "", r.p_fcf?.toFixed(1) ?? "",
        marked(r),
      ]);
      return downloadCsv(`valuation-${date}.csv`, headers, data);
    }

    if (activeTab === "technical") {
      const headers = ["Ticker", "Industry", "Price", "Setup",
        "EMA20W", "Dist EMA20%", "EMA50W", "Dist EMA50%", "Prev Support",
        "RSI", "DI+", "DI-", "CMF", "ATR%", "Marked"];
      const data = rows.map((r) => {
        const price = r.price;
        const ema20 = ema20s[r.ticker] ?? null;
        const ema50 = ema50s[r.ticker] ?? null;
        const support = supportLows[r.ticker] ?? null;
        const distEma20 = price != null && ema20 != null ? ((price - ema20) / ema20) * 100 : null;
        const distEma50 = price != null && ema50 != null ? ((price - ema50) / ema50) * 100 : null;
        const isBeatenDown = r.verdict?.setup === "beaten_down";
        return [
          r.ticker, r.industry,
          price?.toFixed(2) ?? "",
          r.verdict?.setup ?? "",
          ema20?.toFixed(2) ?? "", distEma20?.toFixed(1) ?? "",
          ema50?.toFixed(2) ?? "", distEma50?.toFixed(1) ?? "",
          isBeatenDown && support != null ? support.toFixed(2) : "",
          rsis[r.ticker]?.toFixed(1) ?? "",
          diPluses[r.ticker]?.toFixed(1) ?? "",
          diMinuses[r.ticker]?.toFixed(1) ?? "",
          cmfs[r.ticker]?.toFixed(3) ?? "",
          atrs[r.ticker]?.toFixed(1) ?? "",
          marked(r),
        ];
      });
      return downloadCsv(`technical-${date}.csv`, headers, data);
    }

    // "all" tab — full export
    const headers = ["Ticker", "Industry", "Price", "ATR%",
      "EMA20W", "Dist EMA20%", "EMA50W", "Dist EMA50%", "Prev Support", "RSI", "DI+", "DI-", "CMF",
      "Rev Gr%", "Gross%", "Op%", "Net%", "FCF%", "ROE%", "D/E", "EPS TTM", "EPS Fwd", "EPS Past 5Y%", "EPS Next 5Y%", "Short Float%",
      "Fwd PE", "Trail PE", "PEG", "P/S", "P/B", "EV/EBITDA", "EV/Rev", "EV/FCF", "P/FCF", "Marked"];
    const data = rows.map((r) => {
      const price = r.price;
      const ema20 = ema20s[r.ticker] ?? null;
      const ema50 = ema50s[r.ticker] ?? null;
      const support = supportLows[r.ticker] ?? null;
      const distEma20 = price != null && ema20 != null ? ((price - ema20) / ema20) * 100 : null;
      const distEma50 = price != null && ema50 != null ? ((price - ema50) / ema50) * 100 : null;
      const isBeatenDown = r.verdict?.setup === "beaten_down";
      return [
      r.ticker, r.industry,
      price?.toFixed(2) ?? "",
      atrs[r.ticker]?.toFixed(1) ?? "",
      ema20?.toFixed(2) ?? "", distEma20?.toFixed(1) ?? "",
      ema50?.toFixed(2) ?? "", distEma50?.toFixed(1) ?? "",
      isBeatenDown && support != null ? support.toFixed(2) : "",
      rsis[r.ticker]?.toFixed(1) ?? "",
      diPluses[r.ticker]?.toFixed(1) ?? "",
      diMinuses[r.ticker]?.toFixed(1) ?? "",
      cmfs[r.ticker]?.toFixed(3) ?? "",
      r.rev_growth != null ? (r.rev_growth * 100).toFixed(1) : "",
      r.gross_margin != null ? (r.gross_margin * 100).toFixed(1) : "",
      r.op_margin != null ? (r.op_margin * 100).toFixed(1) : "",
      r.net_margin != null ? (r.net_margin * 100).toFixed(1) : "",
      r.fcf_margin != null ? (r.fcf_margin * 100).toFixed(1) : "",
      r.roe != null ? (r.roe * 100).toFixed(1) : "",
      r.debt_to_equity?.toFixed(2) ?? "",
      r.eps_ttm?.toFixed(2) ?? "",
      r.eps_fwd?.toFixed(2) ?? "",
      r.eps_past_5y != null ? (r.eps_past_5y * 100).toFixed(1) : "",
      r.eps_next_5y != null ? (r.eps_next_5y * 100).toFixed(1) : "",
      r.short_float != null ? (r.short_float * 100).toFixed(1) : "",
      r.fwd_pe?.toFixed(2) ?? "", r.trailing_pe?.toFixed(2) ?? "", r.peg?.toFixed(2) ?? "",
      r.ps_ratio?.toFixed(2) ?? "", r.pb_ratio?.toFixed(2) ?? "",
      r.ev_ebitda?.toFixed(1) ?? "", r.ev_revenue?.toFixed(2) ?? "",
      r.ev_fcf?.toFixed(1) ?? "", r.p_fcf?.toFixed(1) ?? "",
      marked(r),
      ]; // close inner array
    }); // close rows.map
    downloadCsv(`master-table-${date}.csv`, headers, data);
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

  // Shared ticker sticky cell
  const TickerCell = ({ r }: { r: TableRow }) => (
    <td className={`px-3 py-2 font-semibold whitespace-nowrap sticky left-0 z-10 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-200 after:content-[''] group-hover:bg-red-50 ${markedSet.has(r.ticker) ? "bg-red-50" : r.isCustom ? "bg-blue-50/30 group-hover:bg-blue-100/40" : "bg-white group-hover:bg-gray-50"}`}>
      <Link href={`/stock/${isIhsg ? `${r.ticker}.JK` : r.ticker}`} className="text-blue-600 hover:text-blue-800">
        {r.ticker}
      </Link>
      {r.name && <span className="block text-xs text-gray-400 font-normal leading-tight">{r.name}</span>}
    </td>
  );

  const Filters = () => (
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
  );

  const StatusCell = ({ r }: { r: TableRow }) => {
    const isMarked = markedSet.has(r.ticker);
    return (
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
          <button
            onClick={() => onToggleMark(r.ticker)}
            className={`text-xs px-2 py-0.5 rounded border font-semibold transition-colors ${
              isMarked
                ? "bg-red-100 text-red-700 border-red-300 hover:bg-red-200"
                : "border-gray-300 text-gray-400 hover:border-red-300 hover:text-red-500"
            }`}
            title={isMarked ? "Marked — click to unmark" : "Mark as danger zone"}
          >
            {isMarked ? "⚠ Marked" : "Mark"}
          </button>
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
    );
  };

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

      {/* ALL TAB */}
      {activeTab === "all" && (
        <div className="space-y-3">
          <Filters />
          <div className="overflow-x-auto overflow-y-auto max-h-[72vh] rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-30">
                <tr>
                  <Th label="Ticker"    k="ticker" sticky />
                  <Th label="Industry"  k="industry" />
                  <Th label="Score"     k="combined" title="Combined score (seed stocks only)" />
                  <Th label="Val"       k="val"      title="Valuation score (seed stocks only)" />
                  <Th label="Fund"      k="fund"     title="Fundamentals score (seed stocks only)" />
                  <Th label="Price"     k="price" />
                  <Th label="ATR%" k="atr" title="Weekly ATR% — volatility as % of price" />
                  <Th label="Urgency"   k="urgency" />
                  <Th label="EMA20W"     k="ema20"      title="EMA20 Weekly" />
                  <Th label="Dist EMA20" k="dist_ema20"  title="Distance from EMA20W" />
                  <Th label="EMA50W"     k="ema50"      title="EMA50 Weekly" />
                  <Th label="Dist EMA50" k="dist_ema50"  title="Distance from EMA50W" />
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" title="Previous support low (beaten-down stocks only)">Prev Support</th>
                  <Th label="RSI"        k="rsi" />
                  <Th label="DI+"        k="di_plus" />
                  <Th label="DI-"        k="di_minus" />
                  <Th label="CMF"        k="cmf" />
                  <Th label="Rev Gr"    k="rev_growth"   title="Revenue Growth YoY" />
                  <Th label="Gross%"    k="gross_margin" title="Gross Margin" />
                  <Th label="Op%"       k="op_margin"    title="Operating Margin" />
                  <Th label="Net%"      k="net_margin"   title="Net/Profit Margin" />
                  <Th label="FCF%"      k="fcf_margin"   title="Free Cash Flow Margin" />
                  <Th label="ROE%"      k="roe"          title="Return on Equity" />
                  <Th label="D/E"       k="debt_to_equity" title="Debt to Equity ratio" />
                  <Th label="EPS TTM"   k="eps_ttm"      title="Trailing EPS (This Year)" />
                  <Th label="EPS Fwd"   k="eps_fwd"      title="Forward EPS (Next Year)" />
                  <Th label="EPS P5Y"   k="eps_past_5y"  title="EPS Growth Past 5 Years" />
                  <Th label="EPS N5Y"   k="eps_next_5y"  title="EPS Growth Next 5 Years (analyst est.)" />
                  <Th label="Short%"    k="short_float"  title="Short Float %" />
                  <Th label="Fwd PE"    k="fwd_pe" />
                  <Th label="Trail PE"  k="trailing_pe" title="Trailing Price/Earnings (live)" />
                  <Th label="PEG"       k="peg" />
                  <Th label="P/S"       k="ps_ratio"   title="Price/Sales TTM (live)" />
                  <Th label="P/B"       k="pb_ratio"   title="Price/Book (live)" />
                  <Th label="EV/EBITDA" k="ev_ebitda" />
                  <Th label="EV/Rev"    k="ev_revenue" title="EV/Revenue (live)" />
                  <Th label="EV/FCF"    k="ev_fcf" />
                  <Th label="P/FCF"     k="p_fcf"      title="Price/Free Cash Flow (live)" />
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.ticker} className={`group transition-colors ${markedSet.has(r.ticker) ? "bg-red-50 hover:bg-red-100" : r.isCustom ? "bg-blue-50/30 hover:bg-gray-50" : "hover:bg-gray-50"}`}>
                    <TickerCell r={r} />
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
                      {r.price != null ? fmtPrice(r.price) : <span className="text-gray-400">—</span>}
                      {(() => { const pm = preMarketPrices[r.ticker]; return pm != null ? <span className="block text-xs text-blue-500">{fmtPrice(pm)} pre</span> : null; })()}
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
                    {(() => {
                      const price = r.price;
                      const ema20 = ema20s[r.ticker] ?? null;
                      const ema50 = ema50s[r.ticker] ?? null;
                      const support = supportLows[r.ticker] ?? null;
                      const distEma20 = price != null && ema20 != null ? ((price - ema20) / ema20) * 100 : null;
                      const distEma50 = price != null && ema50 != null ? ((price - ema50) / ema50) * 100 : null;
                      const rsi = rsis[r.ticker] ?? null;
                      const diP = diPluses[r.ticker] ?? null;
                      const diM = diMinuses[r.ticker] ?? null;
                      const cmf = cmfs[r.ticker] ?? null;
                      const isBeatenDown = r.verdict?.setup === "beaten_down";

                      const distColor = (d: number | null) => {
                        if (d == null) return "text-gray-400";
                        if (d < -10) return "text-red-500";
                        if (d < 0) return "text-orange-500";
                        if (d < 10) return "text-green-600";
                        return "text-blue-600";
                      };
                      const rsiColor = (v: number | null) => {
                        if (v == null) return "text-gray-400";
                        if (v > 70) return "text-red-500";
                        if (v < 40) return "text-blue-500";
                        return "text-gray-700";
                      };
                      const cmfColor = (v: number | null) => {
                        if (v == null) return "text-gray-400";
                        if (v > 0.05) return "text-green-600";
                        if (v < -0.05) return "text-red-500";
                        return "text-gray-500";
                      };

                      return (
                        <>
                          <td className="px-3 py-2 text-gray-700">{ema20 != null ? fmtPrice(ema20) : <span className="text-gray-400">—</span>}</td>
                          <td className={`px-3 py-2 font-semibold ${distColor(distEma20)}`}>
                            {distEma20 != null ? `${distEma20 > 0 ? "+" : ""}${distEma20.toFixed(1)}%` : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{ema50 != null ? fmtPrice(ema50) : <span className="text-gray-400">—</span>}</td>
                          <td className={`px-3 py-2 font-semibold ${distColor(distEma50)}`}>
                            {distEma50 != null ? `${distEma50 > 0 ? "+" : ""}${distEma50.toFixed(1)}%` : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {isBeatenDown && support != null ? fmtPrice(support) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-3 py-2 font-semibold ${rsiColor(rsi)}`}>
                            {rsi != null ? rsi.toFixed(1) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{diP != null ? diP.toFixed(1) : <span className="text-gray-400">—</span>}</td>
                          <td className="px-3 py-2 text-gray-700">{diM != null ? diM.toFixed(1) : <span className="text-gray-400">—</span>}</td>
                          <td className={`px-3 py-2 font-semibold ${cmfColor(cmf)}`}>
                            {cmf != null ? cmf.toFixed(3) : <span className="text-gray-400">—</span>}
                          </td>
                        </>
                      );
                    })()}
                    <td className="px-3 py-2 text-gray-700">{pct(r.rev_growth)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.gross_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.op_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.net_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.fcf_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.roe)}</td>
                    <td className="px-3 py-2 text-gray-700">{num(r.debt_to_equity, 2)}</td>
                    <td className="px-3 py-2 text-gray-700">{eps(r.eps_ttm)}</td>
                    <td className="px-3 py-2 text-gray-700">{eps(r.eps_fwd)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.eps_past_5y)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.eps_next_5y)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.short_float)}</td>
                    <td className="px-3 py-2 text-gray-700">{num(r.fwd_pe)}</td>
                    <td className="px-3 py-2 text-gray-700">{num(r.trailing_pe, 1)}</td>
                    <td className="px-3 py-2 text-gray-700">{num(r.peg, 2)}</td>
                    <td className="px-3 py-2 text-gray-700">{num(r.ps_ratio, 1)}</td>
                    <td className="px-3 py-2 text-gray-700">{num(r.pb_ratio, 1)}</td>
                    <td className="px-3 py-2 text-gray-700">{num(r.ev_ebitda)}</td>
                    <td className="px-3 py-2 text-gray-700">{num(r.ev_revenue, 1)}</td>
                    <td className="px-3 py-2 text-gray-700">{num(r.ev_fcf)}</td>
                    <td className="px-3 py-2 text-gray-700">{num(r.p_fcf, 1)}</td>
                    <StatusCell r={r} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FUNDAMENTAL TAB */}
      {activeTab === "fundamental" && (
        <div className="space-y-3">
          <Filters />
          <div className="overflow-x-auto overflow-y-auto max-h-[72vh] rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-30">
                <tr>
                  <Th label="Ticker"    k="ticker" sticky />
                  <Th label="Industry"  k="industry" />
                  <Th label="Fund Score" k="fund" title="Fundamentals score (seed stocks only)" />
                  <Th label="Rev Gr"    k="rev_growth"   title="Revenue Growth YoY" />
                  <Th label="Gross%"    k="gross_margin" title="Gross Margin" />
                  <Th label="Op%"       k="op_margin"    title="Operating Margin" />
                  <Th label="FCF%"      k="fcf_margin"   title="Free Cash Flow Margin" />
                  <Th label="ROE%"      k="roe"          title="Return on Equity" />
                  <Th label="D/E"       k="debt_to_equity" title="Debt to Equity ratio" />
                  <Th label="EPS TTM"   k="eps_ttm"      title="Trailing EPS (This Year)" />
                  <Th label="EPS Fwd"   k="eps_fwd"      title="Forward EPS (Next Year)" />
                  <Th label="EPS P5Y"   k="eps_past_5y"  title="EPS Growth Past 5 Years" />
                  <Th label="EPS N5Y"   k="eps_next_5y"  title="EPS Growth Next 5 Years (analyst est.)" />
                  <Th label="Short%"    k="short_float"  title="Short Float %" />
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.ticker} className={`group transition-colors ${markedSet.has(r.ticker) ? "bg-red-50 hover:bg-red-100" : r.isCustom ? "bg-blue-50/30 hover:bg-gray-50" : "hover:bg-gray-50"}`}>
                    <TickerCell r={r} />
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{r.industry}</td>
                    <td className={`px-3 py-2 font-bold ${scoreColor(r.fund)}`}>
                      {r.fund != null ? r.fund.toFixed(1) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.rev_growth)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.gross_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.op_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.fcf_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.roe)}</td>
                    <td className="px-3 py-2 text-gray-700">{num(r.debt_to_equity, 2)}</td>
                    <td className="px-3 py-2 text-gray-700">{eps(r.eps_ttm)}</td>
                    <td className="px-3 py-2 text-gray-700">{eps(r.eps_fwd)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.eps_past_5y)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.eps_next_5y)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.short_float)}</td>
                    <StatusCell r={r} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VALUATION TAB */}
      {activeTab === "valuation" && (
        <div className="space-y-3">
          <Filters />
          <div className="overflow-x-auto overflow-y-auto max-h-[72vh] rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-30">
                <tr>
                  <Th label="Ticker"    k="ticker" sticky />
                  <Th label="Industry"  k="industry" />
                  <Th label="Val Score" k="val" title="Valuation score (seed stocks only)" />
                  {isIhsg ? (
                    <>
                      <Th label="P/E"        k="trailing_pe"    title="Trailing Price/Earnings" />
                      <Th label="P/B (PBV)"  k="pb_ratio"       title="Price to Book Value" />
                      <Th label="Div Yield"  k="dividend_yield" title="Dividend Yield %" />
                      <Th label="P/S"        k="ps_ratio"       title="Price/Sales TTM" />
                      <Th label="EV/EBITDA"  k="ev_ebitda"      title="EV/EBITDA" />
                      <Th label="EV/Rev"     k="ev_revenue"     title="EV/Revenue" />
                    </>
                  ) : (
                    <>
                      <Th label="Fwd PE"    k="fwd_pe"      title="Forward Price/Earnings (seed data)" />
                      <Th label="Trail PE"  k="trailing_pe" title="Trailing Price/Earnings (live)" />
                      <Th label="PEG"       k="peg"         title="PEG Ratio (seed data)" />
                      <Th label="P/S"       k="ps_ratio"    title="Price/Sales TTM (live)" />
                      <Th label="P/B"       k="pb_ratio"    title="Price/Book (live)" />
                      <Th label="EV/EBITDA" k="ev_ebitda"   title="EV/EBITDA (seed data)" />
                      <Th label="EV/Rev"    k="ev_revenue"  title="EV/Revenue (live)" />
                      <Th label="EV/FCF"    k="ev_fcf"      title="EV/Free Cash Flow (seed data)" />
                      <Th label="P/FCF"     k="p_fcf"       title="Price/Free Cash Flow (live)" />
                    </>
                  )}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.ticker} className={`group transition-colors ${markedSet.has(r.ticker) ? "bg-red-50 hover:bg-red-100" : r.isCustom ? "bg-blue-50/30 hover:bg-gray-50" : "hover:bg-gray-50"}`}>
                    <TickerCell r={r} />
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{r.industry}</td>
                    <td className={`px-3 py-2 font-bold ${scoreColor(r.val)}`}>
                      {r.val != null ? r.val.toFixed(1) : <span className="text-gray-300">—</span>}
                    </td>
                    {isIhsg ? (
                      <>
                        <td className="px-3 py-2 text-gray-700">{num(r.trailing_pe, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.pb_ratio, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{r.dividend_yield != null ? `${(r.dividend_yield * 100).toFixed(2)}%` : <span className="text-gray-400">—</span>}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.ps_ratio, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.ev_ebitda, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.ev_revenue, 1)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-gray-700">{num(r.fwd_pe, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.trailing_pe, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.peg, 2)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.ps_ratio, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.pb_ratio, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.ev_ebitda, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.ev_revenue, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.ev_fcf, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.p_fcf, 1)}</td>
                      </>
                    )}
                    <StatusCell r={r} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TECHNICAL TAB */}
      {activeTab === "technical" && (
        <div className="space-y-3">
          <Filters />
          <div className="overflow-x-auto overflow-y-auto max-h-[72vh] rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-30">
                <tr>
                  <Th label="Ticker"   k="ticker" sticky />
                  <Th label="Industry" k="industry" />
                  <Th label="Price"    k="price" />
                  <Th label="Urgency"  k="urgency" />
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">EMA20W</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" title="Distance from EMA20W">Dist EMA20</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">EMA50W</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" title="Distance from EMA50W">Dist EMA50</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" title="Previous support low (beaten-down stocks only)">Prev Support</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">RSI</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">DI+</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">DI-</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">CMF</th>
                  <Th label="ATR%" k="atr" title="Weekly ATR% — volatility as % of price" />
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const price = r.price;
                  const ema20 = ema20s[r.ticker] ?? null;
                  const ema50 = ema50s[r.ticker] ?? null;
                  const support = supportLows[r.ticker] ?? null;
                  const ath = atrs[r.ticker]; // note: ath not passed separately, support shown based on beaten-down
                  const distEma20 = price != null && ema20 != null ? ((price - ema20) / ema20) * 100 : null;
                  const distEma50 = price != null && ema50 != null ? ((price - ema50) / ema50) * 100 : null;
                  const rsi = rsis[r.ticker] ?? null;
                  const diP = diPluses[r.ticker] ?? null;
                  const diM = diMinuses[r.ticker] ?? null;
                  const cmf = cmfs[r.ticker] ?? null;
                  const atrV = atrs[r.ticker] ?? null;
                  const isBeatenDown = r.verdict?.setup === "beaten_down";

                  const distColor = (d: number | null) => {
                    if (d == null) return "text-gray-400";
                    if (d < -10) return "text-red-500";
                    if (d < 0) return "text-orange-500";
                    if (d < 10) return "text-green-600";
                    return "text-blue-600";
                  };
                  const rsiColor = (v: number | null) => {
                    if (v == null) return "text-gray-400";
                    if (v > 70) return "text-red-500";
                    if (v < 40) return "text-blue-500";
                    return "text-gray-700";
                  };
                  const cmfColor = (v: number | null) => {
                    if (v == null) return "text-gray-400";
                    if (v > 0.05) return "text-green-600";
                    if (v < -0.05) return "text-red-500";
                    return "text-gray-500";
                  };

                  return (
                    <tr key={r.ticker} className={`group transition-colors ${markedSet.has(r.ticker) ? "bg-red-50 hover:bg-red-100" : r.isCustom ? "bg-blue-50/30 hover:bg-gray-50" : "hover:bg-gray-50"}`}>
                      <TickerCell r={r} />
                      <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{r.industry}</td>
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                        {price != null ? fmtPrice(price) : <span className="text-gray-400">—</span>}
                        {(() => { const pm = preMarketPrices[r.ticker]; return pm != null ? <span className="block text-xs text-blue-500">{fmtPrice(pm)} pre</span> : null; })()}
                      </td>
                      <td className="px-3 py-2">
                        {r.verdict?.urgency ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${urgencyStyles[r.verdict.urgency] ?? ""}`}>
                            {r.verdict.urgency}
                          </span>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{ema20 != null ? fmtPrice(ema20) : <span className="text-gray-400">—</span>}</td>
                      <td className={`px-3 py-2 font-semibold ${distColor(distEma20)}`}>
                        {distEma20 != null ? `${distEma20 > 0 ? "+" : ""}${distEma20.toFixed(1)}%` : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{ema50 != null ? fmtPrice(ema50) : <span className="text-gray-400">—</span>}</td>
                      <td className={`px-3 py-2 font-semibold ${distColor(distEma50)}`}>
                        {distEma50 != null ? `${distEma50 > 0 ? "+" : ""}${distEma50.toFixed(1)}%` : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {isBeatenDown && support != null ? fmtPrice(support) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className={`px-3 py-2 font-semibold ${rsiColor(rsi)}`}>
                        {rsi != null ? rsi.toFixed(1) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{diP != null ? diP.toFixed(1) : <span className="text-gray-400">—</span>}</td>
                      <td className="px-3 py-2 text-gray-700">{diM != null ? diM.toFixed(1) : <span className="text-gray-400">—</span>}</td>
                      <td className={`px-3 py-2 font-semibold ${cmfColor(cmf)}`}>
                        {cmf != null ? cmf.toFixed(3) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {(() => {
                          if (atrV == null) return <span className="text-gray-300">—</span>;
                          const al = atrLabel(atrV);
                          return (
                            <div>
                              <span className={`font-semibold ${al.color}`}>{atrV.toFixed(1)}%</span>
                              <span className={`block text-xs leading-tight ${al.color} opacity-80`}>{al.label}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <StatusCell r={r} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
