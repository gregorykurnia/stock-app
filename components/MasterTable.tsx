"use client";

import { useState, useMemo, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { SEED_STOCKS, FUNDAMENTALS_RAW, VALUATION_RAW } from "@/lib/seedData";
import { IHSG_STOCKS, type IhsgStock } from "@/lib/ihsgSeedData";
import { atrLabel, type BandarScoreResult } from "@/lib/indicators";
import { downloadCsv } from "@/lib/exportCsv";
import type { CustomStock, PeStats } from "@/lib/types";
import type { FundData } from "@/app/api/funddata/route";
import USSwingTable, { type USSwingStock } from "@/components/USSwingTable";
import PortfolioTable, { PORTFOLIO_DIVISIONS, type PortfolioStock, type PortfolioLevelField } from "@/components/PortfolioTable";
import type { PortfolioDivision } from "@/lib/firestore";

type SortKey =
  | "ticker" | "combined" | "val" | "fund" | "price" | "industry" | "urgency" | "atr"
  | "rev_growth" | "gross_margin" | "op_margin" | "net_margin" | "fcf_margin"
  | "fwd_pe" | "peg" | "ev_ebitda" | "ev_fcf"
  | "trailing_pe" | "ps_ratio" | "pb_ratio" | "ev_revenue" | "p_fcf" | "dividend_yield"
  | "roe" | "roic" | "current_ratio" | "beta" | "debt_to_equity" | "eps_ttm" | "eps_fwd" | "eps_past_5y" | "eps_next_5y" | "short_float"
  | "ema20" | "dist_ema20" | "ema50" | "dist_ema50" | "rsi" | "di_plus" | "di_minus" | "adx" | "cmf" | "earnings"
  | "pe_zscore" | "golden_cross";
type SortDir = "asc" | "desc";
type SubTab = "all" | "fundamental" | "valuation" | "technical";

type SwingSortKey =
  | "ticker" | "price" | "industry" | "entryPrice" | "atr"
  | "ema20d" | "ema50d" | "cross" | "distEma20d" | "distEma50d"
  | "rsi" | "macd" | "signal" | "hist" | "atr14" | "stopLoss"
  | "bandar" | "liquidity" | "distRatio" | "cv" | "efficiency"
  | "upperWick" | "maxSpike" | "pvDiv" | "maxMove" | "gapDays" | "reversal" | "trendR2";

const pct = (v: number | null | undefined) =>
  v == null ? <span className="text-gray-400">—</span> : `${(v * 100).toFixed(1)}%`;

const num = (v: number | null | undefined, dec = 1) =>
  v == null ? <span className="text-gray-400">—</span> : v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(dec);

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
  roic: number | null;
  current_ratio: number | null;
  beta: number | null;
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
  peZScore: number | null;
  peStats: PeStats | null;
}

interface SwingStock { ticker: string; name: string | null; industry: string | null; entryPrice?: number | null }

interface Props {
  market?: "us" | "ihsg";
  ihsgStocks?: IhsgStock[];
  // Independent, manually-managed ticker list for the IHSG "Midterm or Swing" subtab
  swingStocks?: SwingStock[];
  swingPrices?: Record<string, number | null>;
  swingDailyEma20s?: Record<string, number | null>;
  swingDailyEma50s?: Record<string, number | null>;
  swingDailyAtrs?: Record<string, number | null>;
  swingDailyRsis?: Record<string, number | null>;
  swingEmaCrossAbove?: Record<string, boolean | null>;
  swingCrossPrice?: Record<string, number | null>;
  swingCrossDate?: Record<string, string | null>;
  swingMacds?: Record<string, number | null>;
  swingMacdSignals?: Record<string, number | null>;
  swingMacdHists?: Record<string, number | null>;
  swingMacdHistDirs?: Record<string, "up" | "down" | "flat" | null>;
  swingAtr14?: Record<string, number | null>;
  swingBandar?: Record<string, BandarScoreResult | null>;
  swingLoading?: boolean;
  swingAddTicker?: string;
  swingAddLoading?: boolean;
  swingAddError?: string;
  onSwingAddTickerChange?: (v: string) => void;
  onSwingAdd?: (e: FormEvent) => void;
  onSwingRemove?: (ticker: string) => void;
  onSwingEntryPriceChange?: (ticker: string, value: number | null) => void;
  prices: Record<string, number | null>;
  preMarketPrices: Record<string, number | null>;
  verdicts: Record<string, { urgency: string; setup: string } | null>;
  atrs: Record<string, number | null>;
  ema20s: Record<string, number | null>;
  ema50s: Record<string, number | null>;
  goldenCrossDates?: Record<string, string | null>;
  supportLows: Record<string, number | null>;
  rsis: Record<string, number | null>;
  diPluses: Record<string, number | null>;
  diMinuses: Record<string, number | null>;
  adxs?: Record<string, number | null>;
  cmfs: Record<string, number | null>;
  macds?: Record<string, number | null>;
  macdSignals?: Record<string, number | null>;
  macdHists?: Record<string, number | null>;
  macdHistDirs?: Record<string, "up" | "down" | "flat" | null>;
  earnings: Record<string, string | null>;
  fundData: Record<string, FundData>;
  peStats?: Record<string, PeStats>;
  loading: boolean;
  customStocks: CustomStock[];
  portfolioSet: Set<string>;
  watchlistSet: Set<string>;
  markedSet: Set<string>;
  onSetStatus: (ticker: string, status: "portfolio" | "watchlist") => void;
  onRemoveCustom: (ticker: string) => void;
  onToggleMark: (ticker: string) => void;
  // US "Swing" tab — separate, manually-managed ticker list independent from List
  usSwingStocks?: USSwingStock[];
  usSwingPrices?: Record<string, number | null>;
  usSwingPrevCloses?: Record<string, number | null>;
  usSwingAtrs?: Record<string, number | null>;
  usSwingEma20s?: Record<string, number | null>;
  usSwingEma50s?: Record<string, number | null>;
  usSwingGoldenCrossDates?: Record<string, string | null>;
  usSwingMacds?: Record<string, number | null>;
  usSwingRoc14s?: Record<string, number | null>;
  usSwingRsis?: Record<string, number | null>;
  usSwingDiPluses?: Record<string, number | null>;
  usSwingDiMinuses?: Record<string, number | null>;
  usSwingAdxs?: Record<string, number | null>;
  usSwingLow6mos?: Record<string, number | null>;
  usSwingResistances?: Record<string, number | null>;
  usSwingDaysSinceResistances?: Record<string, number | null>;
  usSwingHigh5yrs?: Record<string, number | null>;
  usSwingDistHigh5yrs?: Record<string, number | null>;
  usSwingRelVolumes?: Record<string, number | null>;
  usSwingShortFloats?: Record<string, number | null>;
  usSwingAdvs?: Record<string, number | null>;
  usSwingEarnings?: Record<string, string | null>;
  usSwingLoading?: boolean;
  onUsSwingTabOpen?: () => void;
  usSwingAddTicker?: string;
  usSwingAddLoading?: boolean;
  usSwingAddError?: string;
  onUsSwingAddTickerChange?: (v: string) => void;
  onUsSwingAdd?: (e: FormEvent) => void;
  onUsSwingRemove?: (ticker: string) => void;
  onUsSwingToggleStar?: (ticker: string) => void;
  // "Portfolio" tab — three independent, manually-managed divisions (Long Term / Index / Swing)
  portfolioStocks?: Record<PortfolioDivision, PortfolioStock[]>;
  portfolioPrices?: Record<string, number | null>;
  portfolioPrevCloses?: Record<string, number | null>;
  portfolioLoading?: Record<PortfolioDivision, boolean>;
  onPortfolioTabOpen?: (division: PortfolioDivision) => void;
  portfolioAddTicker?: Record<PortfolioDivision, string>;
  portfolioAddLoading?: Record<PortfolioDivision, boolean>;
  portfolioAddError?: Record<PortfolioDivision, string>;
  onPortfolioAddTickerChange?: (division: PortfolioDivision, v: string) => void;
  onPortfolioAdd?: (division: PortfolioDivision, e: FormEvent) => void;
  onPortfolioRemove?: (division: PortfolioDivision, ticker: string) => void;
  onPortfolioEntryChange?: (division: PortfolioDivision, ticker: string, field: "entry_price" | "entry_quantity", value: number | null) => void;
  onPortfolioLevelChange?: (division: PortfolioDivision, ticker: string, field: PortfolioLevelField, value: number | null) => void;
}

function EarningsBadge({ dateStr }: { dateStr: string | null | undefined }) {
  if (!dateStr) return <span className="text-gray-300 text-xs">—</span>;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const daysUntil = Math.round((new Date(dateStr + "T00:00:00Z").getTime() - new Date(todayStr + "T00:00:00Z").getTime()) / 86400000);

  let label: string;
  let cls: string;
  if (daysUntil < 0) {
    label = "Reported";
    cls = "bg-gray-100 text-gray-500 border border-gray-200";
  } else if (daysUntil === 0) {
    label = "Today";
    cls = "bg-red-100 text-red-700 border border-red-300";
  } else if (daysUntil <= 7) {
    label = `In ${daysUntil}d`;
    cls = "bg-yellow-100 text-yellow-700 border border-yellow-300";
  } else {
    label = dateStr;
    cls = "bg-gray-50 text-gray-500 border border-gray-200";
  }

  return (
    <div className="whitespace-nowrap">
      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cls}`}>{label}</span>
      {daysUntil <= 7 && daysUntil >= 0 && <span className="block text-[10px] text-gray-400 mt-0.5">{dateStr}</span>}
    </div>
  );
}

export default function MasterTable({
  market = "us", ihsgStocks, prices, preMarketPrices, verdicts, atrs, ema20s, ema50s, goldenCrossDates = {}, supportLows, rsis, diPluses, diMinuses, adxs = {}, cmfs, macds = {}, macdSignals = {}, macdHists = {}, macdHistDirs = {}, earnings, fundData, peStats = {}, loading, customStocks, portfolioSet, watchlistSet, markedSet, onSetStatus, onRemoveCustom, onToggleMark,
  swingStocks = [], swingPrices = {}, swingDailyEma20s = {}, swingDailyEma50s = {}, swingDailyAtrs = {}, swingDailyRsis = {}, swingEmaCrossAbove = {}, swingCrossPrice = {}, swingCrossDate = {},
  swingMacds = {}, swingMacdSignals = {}, swingMacdHists = {}, swingMacdHistDirs = {},
  swingAtr14 = {},
  swingBandar = {},
  swingLoading = false, swingAddTicker = "", swingAddLoading = false, swingAddError = "", onSwingAddTickerChange, onSwingAdd, onSwingRemove, onSwingEntryPriceChange,
  usSwingStocks = [], usSwingPrices = {}, usSwingPrevCloses = {}, usSwingAtrs = {}, usSwingEma20s = {}, usSwingEma50s = {}, usSwingGoldenCrossDates = {}, usSwingMacds = {}, usSwingRoc14s = {}, usSwingRsis = {}, usSwingDiPluses = {}, usSwingDiMinuses = {}, usSwingAdxs = {}, usSwingLow6mos = {}, usSwingResistances = {}, usSwingDaysSinceResistances = {}, usSwingHigh5yrs = {}, usSwingDistHigh5yrs = {}, usSwingRelVolumes = {},
  usSwingShortFloats = {}, usSwingAdvs = {}, usSwingEarnings = {}, usSwingLoading = false, onUsSwingTabOpen,
  usSwingAddTicker = "", usSwingAddLoading = false, usSwingAddError = "", onUsSwingAddTickerChange, onUsSwingAdd, onUsSwingRemove, onUsSwingToggleStar,
  portfolioStocks = { longterm: [], index: [], swing: [] }, portfolioPrices = {}, portfolioPrevCloses = {},
  portfolioLoading = { longterm: false, index: false, swing: false }, onPortfolioTabOpen,
  portfolioAddTicker = { longterm: "", index: "", swing: "" }, portfolioAddLoading = { longterm: false, index: false, swing: false },
  portfolioAddError = { longterm: "", index: "", swing: "" },
  onPortfolioAddTickerChange, onPortfolioAdd, onPortfolioRemove, onPortfolioEntryChange, onPortfolioLevelChange,
}: Props) {
  const isIhsg = market === "ihsg";
  // Currency prefix and price formatter
  const fmtPrice = (v: number) => isIhsg ? `Rp${Math.round(v).toLocaleString("id-ID")}` : `$${v.toFixed(2)}`;
  type MainTab = "list" | "midterm" | "swing" | "portfolio";
  const [mainTab, setMainTab] = useState<MainTab>("list");
  const [portfolioDivision, setPortfolioDivision] = useState<PortfolioDivision>("longterm");

  useEffect(() => {
    if (!isIhsg && mainTab === "swing") onUsSwingTabOpen?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, isIhsg]);

  useEffect(() => {
    if (!isIhsg && mainTab === "portfolio") onPortfolioTabOpen?.(portfolioDivision);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, isIhsg, portfolioDivision]);
  const [activeTab, setActiveTab] = useState<SubTab>("all");
  const [sortKey, setSortKey] = useState<SortKey>("combined");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [swingSortKey, setSwingSortKey] = useState<SwingSortKey>("ticker");
  const [swingSortDir, setSwingSortDir] = useState<SortDir>("asc");
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
          roic: null,
          current_ratio: null,
          beta: null,
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
          peZScore: null,
          peStats: null,
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
          roe: fd.roe ?? null, roic: null, current_ratio: null, beta: null, debt_to_equity: fd.debt_to_equity ?? null,
          eps_ttm: fd.eps_ttm ?? null, eps_fwd: fd.eps_fwd ?? null,
          eps_past_5y: fd.eps_past_5y ?? null, eps_next_5y: fd.eps_next_5y ?? null,
          short_float: fd.short_float ?? null,
          fwd_pe: fd.fwd_pe ?? c.fwd_pe, peg: fd.peg ?? c.peg, ev_ebitda: fd.ev_ebitda ?? c.ev_ebitda, ev_fcf: fd.ev_fcf ?? c.ev_fcf,
          trailing_pe: fd.trailing_pe ?? null, ps_ratio: fd.ps_ratio ?? null,
          pb_ratio: fd.pb_ratio ?? null, ev_revenue: fd.ev_revenue ?? null, p_fcf: fd.p_fcf ?? null,
          dividend_yield: fd.dividend_yield ?? null,
          price: prices[c.ticker] ?? null,
          verdict: verdicts[c.ticker] ?? null,
          isCustom: true,
          peZScore: null,
          peStats: null,
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
        roic: fr?.roic ?? null,
        current_ratio: fd.current_ratio ?? null,
        beta: fd.beta ?? null,
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
        peZScore: peStats[s.ticker]?.zScore ?? null,
        peStats: peStats[s.ticker] ?? null,
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
        roic: null,
        current_ratio: fd.current_ratio ?? null,
        beta: fd.beta ?? null,
        debt_to_equity: fd.debt_to_equity ?? null,
        eps_ttm: fd.eps_ttm ?? null,
        eps_fwd: fd.eps_fwd ?? null,
        eps_past_5y: fd.eps_past_5y ?? null,
        eps_next_5y: fd.eps_next_5y ?? null,
        short_float: fd.short_float ?? null,
        fwd_pe: fd.fwd_pe ?? c.fwd_pe,
        peg: fd.peg ?? c.peg,
        ev_ebitda: fd.ev_ebitda ?? c.ev_ebitda,
        ev_fcf: fd.ev_fcf ?? c.ev_fcf,
        trailing_pe: fundData[c.ticker]?.trailing_pe ?? null,
        ps_ratio: fundData[c.ticker]?.ps_ratio ?? null,
        pb_ratio: fundData[c.ticker]?.pb_ratio ?? null,
        ev_revenue: fundData[c.ticker]?.ev_revenue ?? null,
        p_fcf: fundData[c.ticker]?.p_fcf ?? null,
        dividend_yield: fundData[c.ticker]?.dividend_yield ?? null,
        price: prices[c.ticker] ?? null,
        verdict: verdicts[c.ticker] ?? null,
        isCustom: true,
        peZScore: peStats[c.ticker]?.zScore ?? null,
        peStats: peStats[c.ticker] ?? null,
      };
    });

    return [...seedRows, ...customRows];
  }, [prices, verdicts, customStocks, fundData, peStats]);

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
        adx:      (r) => adxs[r.ticker] ?? null,
        cmf:      (r) => cmfs[r.ticker] ?? null,
        golden_cross: (r) => {
          const d = goldenCrossDates[r.ticker];
          if (!d) return null;
          const today = new Date().toISOString().slice(0, 10);
          return Math.round((new Date(today + "T00:00:00Z").getTime() - new Date(d + "T00:00:00Z").getTime()) / 86400000);
        },
        earnings: (r) => {
          const d = earnings[r.ticker];
          if (!d) return null;
          const today = new Date().toISOString().slice(0, 10);
          return Math.round((new Date(d + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86400000);
        },
        rev_growth:    (r) => r.rev_growth,
        gross_margin:  (r) => r.gross_margin,
        op_margin:     (r) => r.op_margin,
        net_margin:    (r) => r.net_margin,
        fcf_margin:    (r) => r.fcf_margin,
        roe:           (r) => r.roe,
        roic:          (r) => r.roic,
        current_ratio: (r) => r.current_ratio,
        beta:          (r) => r.beta,
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
        pe_zscore: (r) => r.peZScore,
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
    const portfolio = (r: TableRow) => portfolioSet.has(r.ticker) ? "yes" : "";
    const watchlist = (r: TableRow) => watchlistSet.has(r.ticker) ? "yes" : "";

    if (activeTab === "fundamental") {
      const headers = ["Ticker", "Industry", "Rev Gr%", "Gross%", "Op%", "FCF%",
        "ROE%", "ROIC%", "Current Ratio", "Beta", "D/E", "EPS TTM", "EPS Fwd", "EPS Past 5Y%", "EPS Next 5Y%", "Short Float%", "Portfolio", "Watchlist", "Marked"];
      const data = rows.map((r) => [
        r.ticker, r.industry,
        r.rev_growth != null ? (r.rev_growth * 100).toFixed(1) : "",
        r.gross_margin != null ? (r.gross_margin * 100).toFixed(1) : "",
        r.op_margin != null ? (r.op_margin * 100).toFixed(1) : "",
        r.fcf_margin != null ? (r.fcf_margin * 100).toFixed(1) : "",
        r.roe != null ? (r.roe * 100).toFixed(1) : "",
        r.roic != null ? (r.roic * 100).toFixed(1) : "",
        r.current_ratio?.toFixed(2) ?? "",
        r.beta?.toFixed(2) ?? "",
        r.debt_to_equity?.toFixed(2) ?? "",
        r.eps_ttm?.toFixed(2) ?? "", r.eps_fwd?.toFixed(2) ?? "",
        r.eps_past_5y != null ? (r.eps_past_5y * 100).toFixed(1) : "",
        r.eps_next_5y != null ? (r.eps_next_5y * 100).toFixed(1) : "",
        r.short_float != null ? (r.short_float * 100).toFixed(1) : "",
        portfolio(r), watchlist(r), marked(r),
      ]);
      return downloadCsv(`fundamental-${date}.csv`, headers, data);
    }

    if (activeTab === "valuation") {
      if (isIhsg) {
        const headers = ["Ticker", "Industry", "Trail PE", "P/S", "P/B", "EV/Rev", "Portfolio", "Watchlist", "Marked"];
        const data = rows.map((r) => [
          r.ticker, r.industry,
          r.trailing_pe?.toFixed(2) ?? "", r.ps_ratio?.toFixed(2) ?? "",
          r.pb_ratio?.toFixed(2) ?? "", r.ev_revenue?.toFixed(2) ?? "",
          portfolio(r), watchlist(r), marked(r),
        ]);
        return downloadCsv(`valuation-ihsg-${date}.csv`, headers, data);
      }
      const headers = ["Ticker", "Industry", "Fwd PE", "Trail PE", "PEG",
        "P/S", "P/B", "EV/EBITDA", "EV/Rev", "EV/FCF", "P/FCF", "5Y PE Z", "Portfolio", "Watchlist", "Marked"];
      const data = rows.map((r) => [
        r.ticker, r.industry,
        r.fwd_pe?.toFixed(2) ?? "", r.trailing_pe?.toFixed(2) ?? "", r.peg?.toFixed(2) ?? "",
        r.ps_ratio?.toFixed(2) ?? "", r.pb_ratio?.toFixed(2) ?? "",
        r.ev_ebitda?.toFixed(1) ?? "", r.ev_revenue?.toFixed(2) ?? "",
        r.ev_fcf?.toFixed(1) ?? "", r.p_fcf?.toFixed(1) ?? "",
        r.peZScore != null ? r.peZScore.toFixed(2) : "",
        portfolio(r), watchlist(r), marked(r),
      ]);
      return downloadCsv(`valuation-${date}.csv`, headers, data);
    }

    const fmtGoldenCrossCsv = (ticker: string) => {
      const d = goldenCrossDates[ticker];
      if (!d) return "";
      const today = new Date().toISOString().slice(0, 10);
      const days = Math.round((new Date(today + "T00:00:00Z").getTime() - new Date(d + "T00:00:00Z").getTime()) / 86400000);
      return `${d} (${days}D)`;
    };

    if (activeTab === "technical") {
      const headers = ["Ticker", "Industry", "Price", "Setup",
        "EMA20W", "Dist EMA20%", "EMA50W", "Dist EMA50%", "Golden Cross", "Prev Support",
        "RSI", "DI+", "DI-", "ADX", "CMF", "ATR%", "Portfolio", "Watchlist", "Marked"];
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
          fmtGoldenCrossCsv(r.ticker),
          isBeatenDown && support != null ? support.toFixed(2) : "",
          rsis[r.ticker]?.toFixed(1) ?? "",
          diPluses[r.ticker]?.toFixed(1) ?? "",
          diMinuses[r.ticker]?.toFixed(1) ?? "",
          adxs[r.ticker]?.toFixed(1) ?? "",
          cmfs[r.ticker]?.toFixed(3) ?? "",
          atrs[r.ticker]?.toFixed(1) ?? "",
          portfolio(r), watchlist(r), marked(r),
        ];
      });
      return downloadCsv(`technical-${date}.csv`, headers, data);
    }

    // "all" tab — full export
    const valHeaders = isIhsg
      ? ["Trail PE", "P/S", "P/B", "EV/Rev"]
      : ["Fwd PE", "Trail PE", "PEG", "P/S", "P/B", "EV/EBITDA", "EV/Rev", "EV/FCF", "P/FCF"];
    const headers = ["Ticker", "Industry", "Price", "ATR%",
      "EMA20W", "Dist EMA20%", "EMA50W", "Dist EMA50%", "Golden Cross", "Prev Support", "RSI", "DI+", "DI-", "ADX", "CMF",
      "Rev Gr%", "Gross%", "Op%", "Net%", "FCF%", "ROE%",
      ...(isIhsg ? [] : ["ROIC%", "Current Ratio", "Beta"]),
      "D/E",
      ...(isIhsg ? [] : ["EPS TTM", "EPS Fwd", "EPS Past 5Y%", "EPS Next 5Y%", "Short Float%"]),
      ...valHeaders, "Portfolio", "Watchlist", "Marked"];
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
      fmtGoldenCrossCsv(r.ticker),
      isBeatenDown && support != null ? support.toFixed(2) : "",
      rsis[r.ticker]?.toFixed(1) ?? "",
      diPluses[r.ticker]?.toFixed(1) ?? "",
      diMinuses[r.ticker]?.toFixed(1) ?? "",
      adxs[r.ticker]?.toFixed(1) ?? "",
      cmfs[r.ticker]?.toFixed(3) ?? "",
      r.rev_growth != null ? (r.rev_growth * 100).toFixed(1) : "",
      r.gross_margin != null ? (r.gross_margin * 100).toFixed(1) : "",
      r.op_margin != null ? (r.op_margin * 100).toFixed(1) : "",
      r.net_margin != null ? (r.net_margin * 100).toFixed(1) : "",
      r.fcf_margin != null ? (r.fcf_margin * 100).toFixed(1) : "",
      r.roe != null ? (r.roe * 100).toFixed(1) : "",
      ...(isIhsg ? [] : [
        r.roic != null ? (r.roic * 100).toFixed(1) : "",
        r.current_ratio?.toFixed(2) ?? "",
        r.beta?.toFixed(2) ?? "",
      ]),
      r.debt_to_equity?.toFixed(2) ?? "",
      ...(isIhsg ? [] : [
        r.eps_ttm?.toFixed(2) ?? "",
        r.eps_fwd?.toFixed(2) ?? "",
        r.eps_past_5y != null ? (r.eps_past_5y * 100).toFixed(1) : "",
        r.eps_next_5y != null ? (r.eps_next_5y * 100).toFixed(1) : "",
        r.short_float != null ? (r.short_float * 100).toFixed(1) : "",
      ]),
      ...(isIhsg ? [
        r.trailing_pe?.toFixed(2) ?? "", r.ps_ratio?.toFixed(2) ?? "",
        r.pb_ratio?.toFixed(2) ?? "", r.ev_revenue?.toFixed(2) ?? "",
      ] : [
        r.fwd_pe?.toFixed(2) ?? "", r.trailing_pe?.toFixed(2) ?? "", r.peg?.toFixed(2) ?? "",
        r.ps_ratio?.toFixed(2) ?? "", r.pb_ratio?.toFixed(2) ?? "",
        r.ev_ebitda?.toFixed(1) ?? "", r.ev_revenue?.toFixed(2) ?? "",
        r.ev_fcf?.toFixed(1) ?? "", r.p_fcf?.toFixed(1) ?? "",
      ]),
      portfolio(r), watchlist(r), marked(r),
      ]; // close inner array
    }); // close rows.map
    downloadCsv(`master-table-${date}.csv`, headers, data);
  }

  function exportSwingCsv() {
    const date = new Date().toISOString().slice(0, 10);
    const headers = ["Ticker", "Price", "Industry", "Entry Price", "ATR%",
      "EMA20D", "EMA50D", "EMA Cross", "Cross Price", "Cross Date",
      "Dist EMA20D%", "Dist EMA50D%", "RSI", "MACD", "Signal", "Hist",
      "ATR (14)", "Stop Loss",
      "Bandar", "Liquidity (B)", "Dist?", "Vol CV", "Effic.", "UWick", "Spike",
      "PVDiv", "Max Move%", "Gap Days", "Reversal", "Trend R2"];
    const data = (swingStocks ?? []).map((s) => {
      const price = swingPrices?.[s.ticker] ?? null;
      const de20 = swingDailyEma20s?.[s.ticker] ?? null;
      const de50 = swingDailyEma50s?.[s.ticker] ?? null;
      const atrPct = swingDailyAtrs?.[s.ticker] ?? null;
      const rsi = swingDailyRsis?.[s.ticker] ?? null;
      const crossAbove = swingEmaCrossAbove?.[s.ticker] ?? null;
      const cPrice = swingCrossPrice?.[s.ticker] ?? null;
      const cDate = swingCrossDate?.[s.ticker] ?? null;
      const distEma20 = price != null && de20 != null ? ((price - de20) / de20) * 100 : null;
      const distEma50 = price != null && de50 != null ? ((price - de50) / de50) * 100 : null;
      const atr14 = swingAtr14?.[s.ticker] ?? null;
      const entryPrice = s.entryPrice ?? null;
      const stopBase = entryPrice ?? price;
      const stopLoss = atr14 != null && stopBase != null ? stopBase - 1.5 * atr14 : null;
      const bandar = swingBandar?.[s.ticker] ?? null;

      return [
        s.ticker,
        price?.toFixed(2) ?? "",
        s.industry ?? "",
        entryPrice?.toFixed(2) ?? "",
        atrPct?.toFixed(1) ?? "",
        de20?.toFixed(2) ?? "",
        de50?.toFixed(2) ?? "",
        crossAbove == null ? "" : crossAbove ? "Yes" : "No",
        cPrice?.toFixed(2) ?? "",
        cDate ?? "",
        distEma20?.toFixed(1) ?? "",
        distEma50?.toFixed(1) ?? "",
        rsi?.toFixed(1) ?? "",
        swingMacds?.[s.ticker]?.toFixed(2) ?? "",
        swingMacdSignals?.[s.ticker]?.toFixed(2) ?? "",
        swingMacdHists?.[s.ticker]?.toFixed(2) ?? "",
        atr14?.toFixed(2) ?? "",
        stopLoss?.toFixed(2) ?? "",
        bandar ? String(bandar.score) : "",
        bandar ? (bandar.avgValueTraded / 1_000_000_000).toFixed(1) : "",
        bandar && bandar.volDirRatio !== 0.5 ? (bandar.volDirRatio * 100).toFixed(0) : "",
        bandar ? bandar.cv.toFixed(2) : "",
        bandar ? bandar.efficiency.toFixed(2) : "",
        bandar ? bandar.upperWick.toFixed(2) : "",
        bandar ? bandar.maxSpike.toFixed(1) : "",
        bandar ? bandar.pvDiv.toFixed(2) : "",
        bandar && Number.isFinite(bandar.maxDayMove) ? (bandar.maxDayMove * 100).toFixed(1) : "",
        bandar && Number.isFinite(bandar.largeGapDays) ? String(bandar.largeGapDays) : "",
        bandar && Number.isFinite(bandar.reversalRate) ? bandar.reversalRate.toFixed(2) : "",
        bandar && Number.isFinite(bandar.rSquared) ? bandar.rSquared.toFixed(2) : "",
      ];
    });
    downloadCsv(`midterm-swing-${date}.csv`, headers, data);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function toggleSwingSort(key: SwingSortKey) {
    if (swingSortKey === key) setSwingSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSwingSortKey(key); setSwingSortDir(key === "ticker" || key === "industry" ? "asc" : "desc"); }
  }

  const sortedSwingStocks = useMemo(() => {
    const getVal = (s: SwingStock): number | string | null => {
      const price = swingPrices[s.ticker] ?? null;
      const de20 = swingDailyEma20s[s.ticker] ?? null;
      const de50 = swingDailyEma50s[s.ticker] ?? null;
      const crossAbove = swingEmaCrossAbove[s.ticker] ?? null;
      const distEma20 = price != null && de20 != null ? ((price - de20) / de20) * 100 : null;
      const distEma50 = price != null && de50 != null ? ((price - de50) / de50) * 100 : null;
      const atr14 = swingAtr14[s.ticker] ?? null;
      const entryPrice = s.entryPrice ?? null;
      const stopBase = entryPrice ?? price;
      const stopLoss = atr14 != null && stopBase != null ? stopBase - 1.5 * atr14 : null;
      const bandar = swingBandar[s.ticker] ?? null;

      switch (swingSortKey) {
        case "ticker": return s.ticker;
        case "industry": return s.industry ?? "";
        case "price": return price;
        case "entryPrice": return entryPrice;
        case "atr": return swingDailyAtrs[s.ticker] ?? null;
        case "ema20d": return de20;
        case "ema50d": return de50;
        case "cross": return crossAbove == null ? null : crossAbove ? 1 : 0;
        case "distEma20d": return distEma20;
        case "distEma50d": return distEma50;
        case "rsi": return swingDailyRsis[s.ticker] ?? null;
        case "macd": return swingMacds[s.ticker] ?? null;
        case "signal": return swingMacdSignals[s.ticker] ?? null;
        case "hist": return swingMacdHists[s.ticker] ?? null;
        case "atr14": return atr14;
        case "stopLoss": return stopLoss;
        case "bandar": return bandar?.score ?? null;
        case "liquidity": return bandar?.avgValueTraded ?? null;
        case "distRatio": return bandar?.volDirRatio ?? null;
        case "cv": return bandar?.cv ?? null;
        case "efficiency": return bandar?.efficiency ?? null;
        case "upperWick": return bandar?.upperWick ?? null;
        case "maxSpike": return bandar?.maxSpike ?? null;
        case "pvDiv": return bandar?.pvDiv ?? null;
        case "maxMove": return bandar && Number.isFinite(bandar.maxDayMove) ? bandar.maxDayMove : null;
        case "gapDays": return bandar && Number.isFinite(bandar.largeGapDays) ? bandar.largeGapDays : null;
        case "reversal": return bandar && Number.isFinite(bandar.reversalRate) ? bandar.reversalRate : null;
        case "trendR2": return bandar && Number.isFinite(bandar.rSquared) ? bandar.rSquared : null;
        default: return null;
      }
    };

    const data = [...swingStocks];
    data.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return swingSortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return swingSortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return data;
  }, [swingStocks, swingSortKey, swingSortDir, swingPrices, swingDailyEma20s, swingDailyEma50s, swingDailyAtrs, swingDailyRsis, swingEmaCrossAbove, swingMacds, swingMacdSignals, swingMacdHists, swingAtr14, swingBandar]);

  const SwingTh = ({ label, k, title, sticky }: { label: string; k: SwingSortKey; title?: string; sticky?: boolean }) => (
    <th
      title={title}
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 whitespace-nowrap select-none${sticky ? " sticky left-0 z-20 bg-gray-100 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-300 after:content-['']" : ""}`}
      onClick={() => toggleSwingSort(k)}
    >
      {label}{swingSortKey === k ? (swingSortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  const Th = ({ label, k, title, sticky }: { label: string; k: SortKey; title?: string; sticky?: boolean }) => (
    <th
      title={title}
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 whitespace-nowrap select-none${sticky ? " sticky left-0 z-20 bg-gray-100 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-300 after:content-['']" : ""}`}
      onClick={() => toggleSort(k)}
    >
      {label}{sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  type TooltipRange = { range: string; label: string; meaning: string };
  type ValTooltipDef = { definition: string; ranges: TooltipRange[] };
  const VAL_TOOLTIPS: Record<string, ValTooltipDef> = {
    pe_zscore: {
      definition: "How many standard deviations the current trailing P/E is above or below the stock's own 5-year average trailing P/E. Built from SEC EDGAR quarterly EPS (rolling TTM) and Yahoo daily prices. Cheap/expensive relative to the stock's OWN valuation history, not the market or peers — a stock can be at a negative z-score and still be objectively expensive if its whole history has been expensive.",
      ranges: [
        { range: "< -1.5", label: "Very cheap vs. history",  meaning: "Trading well below its own 5Y valuation norm" },
        { range: "-1.5–-0.5", label: "Cheap vs. history",     meaning: "Below its typical multiple — worth a look" },
        { range: "-0.5–0.5",  label: "In line",               meaning: "Trading around its normal historical multiple" },
        { range: "0.5–1.5",   label: "Rich vs. history",      meaning: "Above its typical multiple — market pricing in more" },
        { range: "> 1.5",     label: "Very rich vs. history", meaning: "Stretched relative to its own 5Y norm — check why" },
      ],
    },
    fwd_pe: {
      definition: "Stock price divided by estimated earnings per share for the next 12 months. Tells you how much you're paying today for future profits. Pure forward-looking — based on analyst estimates so can be wrong if growth disappoints.",
      ranges: [
        { range: "<10x",   label: "Very cheap",         meaning: "Market pricing in low growth or distress — either a gift or a trap, check why" },
        { range: "10–20x", label: "Cheap to fair",      meaning: "Reasonable for most quality businesses, good entry zone" },
        { range: "20–30x", label: "Fair to slightly rich", meaning: "Acceptable for high-quality compounders with 15%+ growth" },
        { range: "30–50x", label: "Expensive",          meaning: "Requires strong growth justification, limited margin of safety" },
        { range: ">50x",   label: "Very expensive",     meaning: "Priced for perfection — any miss and multiple compresses hard" },
      ],
    },
    trailing_pe: {
      definition: "Stock price divided by actual earnings per share over the last 12 months. Based on real reported profits, not estimates. More reliable than Fwd PE but backward-looking — doesn't reflect where the business is going.",
      ranges: [
        { range: "<10x",   label: "Very cheap",     meaning: "Earning a lot relative to price — check if sustainable or one-time" },
        { range: "10–20x", label: "Cheap to fair",  meaning: "Good zone for quality businesses, based on actual earned profits" },
        { range: "20–35x", label: "Fair",           meaning: "Reasonable for consistent compounders with proven earnings track record" },
        { range: "35–60x", label: "Expensive",      meaning: "Paying well above historical norms — growth must continue to justify" },
        { range: ">60x",   label: "Very expensive", meaning: "Earnings too thin relative to price — forward expectations doing all the work" },
      ],
    },
    peg: {
      definition: "Forward PE divided by the expected earnings growth rate. Normalizes the PE ratio for growth so you can compare a fast-growing company to a slow one fairly. A PEG of 1.0 means you're paying exactly in line with the growth rate — the classic fair value benchmark.",
      ranges: [
        { range: "<0.5",   label: "Extremely cheap", meaning: "Paying half the growth rate — rare, usually a signal or data issue, investigate" },
        { range: "0.5–1.0",label: "Cheap",           meaning: "Paying below or at growth rate — historically strong return zone" },
        { range: "1.0–1.5",label: "Fair",            meaning: "Paying a small premium for growth — acceptable for quality businesses" },
        { range: "1.5–2.0",label: "Stretched",       meaning: "Paying meaningful premium — needs strong moat to justify" },
        { range: ">2.0",   label: "Expensive",       meaning: "Paying double the growth rate — narrative-driven, high risk of disappointment" },
      ],
    },
    ps_ratio: {
      definition: "Market cap divided by annual revenue. Useful when a company has little or no earnings yet — measures how much you're paying per dollar of revenue. Always pair with gross margin because $1 of revenue at 80% gross is worth far more than $1 at 20% gross.",
      ranges: [
        { range: "<1x",   label: "Very cheap",         meaning: "Either deep value or business in trouble — check margins" },
        { range: "1–3x",  label: "Cheap to fair",      meaning: "Reasonable for most businesses, good for low-margin industrials" },
        { range: "3–8x",  label: "Fair to rich",       meaning: "Acceptable only with 60%+ gross margins" },
        { range: "8–15x", label: "Expensive",          meaning: "Requires 75%+ gross margins and strong growth to justify" },
        { range: ">15x",  label: "Very expensive",     meaning: "Priced for hypergrowth — multiple compression risk is high" },
      ],
    },
    ev_ebitda: {
      definition: "Enterprise Value (market cap plus debt minus cash) divided by EBITDA (earnings before interest, tax, depreciation, amortization). More complete than PE because it accounts for debt and cash on the balance sheet and strips out accounting distortions. The go-to metric for comparing companies with different capital structures.",
      ranges: [
        { range: "<8x",   label: "Very cheap",         meaning: "Deep value territory — market pricing in stagnation or risk" },
        { range: "8–15x", label: "Cheap to fair",      meaning: "Good entry for quality businesses, industrials and mature tech" },
        { range: "15–25x",label: "Fair to rich",       meaning: "Acceptable for 20%+ growth businesses with strong margins" },
        { range: "25–40x",label: "Expensive",          meaning: "Requires hypergrowth or dominant moat to justify" },
        { range: ">40x",  label: "Very expensive",     meaning: "Priced for a perfect outcome — high multiple compression risk" },
      ],
    },
    p_fcf: {
      definition: "Market cap divided by free cash flow (operating cash flow minus capex). The most honest valuation metric — FCF is actual cash the business generates after maintaining and growing its operations, harder to manipulate than earnings. A low P/FCF means the business is generating lots of real cash relative to what you're paying.",
      ranges: [
        { range: "<10x",  label: "Very cheap",     meaning: "Generating lots of cash relative to price — strong value signal" },
        { range: "10–20x",label: "Cheap to fair",  meaning: "Good zone for quality FCF businesses, solid margin of safety" },
        { range: "20–35x",label: "Fair",           meaning: "Reasonable for high-margin compounders with durable growth" },
        { range: "35–60x",label: "Expensive",      meaning: "FCF yield getting thin — needs strong reinvestment thesis" },
        { range: ">60x",  label: "Very expensive", meaning: "Paying far ahead of current cash generation — high risk" },
      ],
    },
  };

  function ValTooltipTh({ label, k }: { label: string; k: SortKey }) {
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const iconRef = useRef<HTMLSpanElement>(null);
    const tip = VAL_TOOLTIPS[k];

    function show() {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (iconRef.current) {
        const r = iconRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 348) });
      }
    }
    function hide() {
      timerRef.current = setTimeout(() => setPos(null), 120);
    }

    return (
      <th
        className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 whitespace-nowrap select-none"
        onClick={() => toggleSort(k)}
      >
        <span className="inline-flex items-center gap-1">
          {label}{sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
          {tip && (
            <span
              ref={iconRef}
              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-300 text-gray-600 text-[9px] font-bold cursor-default leading-none"
              onClick={(e) => { e.stopPropagation(); pos ? setPos(null) : show(); }}
              onMouseEnter={show}
              onMouseLeave={hide}
            >i</span>
          )}
        </span>
        {pos && tip && (
          <div
            className="fixed z-[9999] w-[340px] bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-left normal-case tracking-normal font-normal"
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
            onMouseLeave={hide}
          >
            <p className="text-[11px] text-gray-500 leading-snug mb-2 whitespace-normal">{tip.definition}</p>
            <table className="w-full text-[11px] border-collapse table-fixed">
              <colgroup>
                <col className="w-14" />
                <col className="w-24" />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-0.5 pr-2 text-gray-400 font-semibold">Range</th>
                  <th className="text-left py-0.5 pr-2 text-gray-400 font-semibold">Label</th>
                  <th className="text-left py-0.5 text-gray-400 font-semibold">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {tip.ranges.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="py-0.5 pr-2 text-gray-700 font-mono whitespace-nowrap align-top">{row.range}</td>
                    <td className="py-0.5 pr-2 text-gray-700 whitespace-nowrap align-top">{row.label}</td>
                    <td className="py-0.5 text-gray-500 leading-snug whitespace-normal break-words align-top">{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </th>
    );
  }

  const valColorCls = (v: number | null) =>
    v == null ? "text-gray-300" : v > 0 ? "text-green-600" : v < 0 ? "text-red-500" : "text-gray-500";

  const MacdCell = ({ v }: { v: number | null }) => (
    <td className={`px-3 py-2 whitespace-nowrap ${valColorCls(v)}`}>
      {v != null ? v.toFixed(2) : <span className="text-gray-300">—</span>}
    </td>
  );

  const MacdHistCell = ({ ticker }: { ticker: string }) => {
    const hist = macdHists[ticker] ?? null;
    const dir = macdHistDirs[ticker] ?? null;
    if (hist == null) return <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>;
    const arrow = hist > 0 && dir === "up" ? " ▲" : hist < 0 && dir === "down" ? " ▼" : "";
    return (
      <td className={`px-3 py-2 whitespace-nowrap font-bold ${valColorCls(hist)}`}>
        {hist.toFixed(2)}{arrow}
      </td>
    );
  };

  const PeZScoreCell = ({ r }: { r: TableRow }) => {
    const z = r.peZScore;
    const stats = r.peStats;
    if (z == null) {
      const reason = stats?.error === "insufficient_data" ? "Not enough EPS history"
        : stats?.error === "negative_eps" ? "Negative earnings"
        : stats?.error === "no_cik" ? "No SEC filer match"
        : stats?.error === "fetch_failed" ? "Fetch failed"
        : stats ? "No data" : "Not computed yet";
      const shortLabel = stats?.error === "insufficient_data" ? "insuff. data"
        : stats?.error === "negative_eps" ? "neg. EPS"
        : stats?.error === "no_cik" ? "no filer match"
        : stats?.error === "fetch_failed" ? "fetch failed"
        : stats ? "no data" : "not computed";
      return (
        <td className="px-3 py-2 whitespace-nowrap text-gray-400 text-xs" title={reason}>
          — <span className="text-gray-300">({shortLabel})</span>
        </td>
      );
    }
    const cls = z <= -1.5 ? "text-green-700" : z <= -0.5 ? "text-green-600" : z < 0.5 ? "text-gray-600" : z < 1.5 ? "text-red-500" : "text-red-700";
    const title = stats
      ? `Current P/E ${stats.currentPe?.toFixed(1) ?? "—"} vs. 5Y mean ${stats.meanPe5y?.toFixed(1) ?? "—"} (±${stats.stdDevPe5y?.toFixed(1) ?? "—"}), n=${stats.sampleSize} quarters, as of ${stats.asOfDate}`
      : undefined;
    return (
      <td className={`px-3 py-2 whitespace-nowrap font-semibold ${cls}`} title={title}>
        {z >= 0 ? "+" : ""}{z.toFixed(1)}σ
      </td>
    );
  };

  const AtrCell = ({ v }: { v: number | null }) => (
    <td className="px-3 py-2 whitespace-nowrap text-gray-700">
      {v != null ? `±${v.toFixed(2)}` : <span className="text-gray-300">—</span>}
    </td>
  );

  const BANDAR_TOOLTIPS: Record<string, ValTooltipDef> = {
    liquidity: {
      definition: "Avg daily value traded (IDR) over last 20 days — below 5B means too illiquid for swing trading.",
      ranges: [
        { range: ">20B",  label: "✅ Liquid",   meaning: "Enough daily turnover for swing-size entries/exits without much slippage" },
        { range: "5–20B", label: "⚠️ Thin",     meaning: "Tradable but size and exits need care" },
        { range: "<5B",   label: "🚨 Illiquid", meaning: "Too thin for swing trading — hard to enter/exit without moving price" },
      ],
    },
    volDirRatio: {
      definition: "% of volume on up-days vs down-days over last 20 days — below 40% means big volume days are down days = distribution signal.",
      ranges: [
        { range: ">60%",  label: "✅ Accumulation", meaning: "Volume skewed to up days — buying pressure dominant" },
        { range: "40–60%",label: "⚠️ Neutral",      meaning: "No clear bias between up and down day volume" },
        { range: "<40%",  label: "🚨 Distribution",  meaning: "Volume skewed to down days — selling pressure dominant" },
      ],
    },
    cv: {
      definition: "Coefficient of variation of daily volume over the last 20 sessions (std dev ÷ mean). Measures how consistent trading volume is day to day. Erratic volume — quiet stretches punctuated by huge spikes — is a classic footprint of accumulation/distribution by a single large player rather than organic broad-based interest.",
      ranges: [
        { range: "<0.8",   label: "✅ Consistent", meaning: "Volume flows steadily — normal, broad-based participation" },
        { range: "0.8–1.5",label: "⚠️ Uneven",      meaning: "Some irregular days — worth a second look but not alarming alone" },
        { range: ">1.5",   label: "🚨 Erratic",     meaning: "Highly inconsistent volume — consistent with one player dominating flow" },
      ],
    },
    efficiency: {
      definition: "Average of |close − open| ÷ (high − low) over the last 20 candles. Measures how much of each day's traded range turned into real net price movement. Low efficiency means price got pushed around intraday (lots of wick) without actually going anywhere — often a sign of absorption, where a large player is quietly buying or selling into the move without letting price run.",
      ranges: [
        { range: ">0.5",   label: "✅ Directional", meaning: "Most of the day's range converts to real movement — clean, healthy price action" },
        { range: "0.3–0.5",label: "⚠️ Choppy",      meaning: "Meaningful wick relative to the move — some intraday fighting" },
        { range: "<0.3",   label: "🚨 Absorbed",    meaning: "Range dominated by wicks — price is being pushed around without progress" },
      ],
    },
    upperWick: {
      definition: "Average of (high − max(close, open)) ÷ (high − low) over the last 20 candles. Measures how much of each candle is upper wick — price rallying intraday then getting sold back down before the close. Persistently high upper wicks suggest supply capping every rally, i.e. someone selling into strength.",
      ranges: [
        { range: "<0.25",  label: "✅ Clean",       meaning: "Rallies mostly hold into the close — no persistent overhead selling" },
        { range: "0.25–0.4",label: "⚠️ Some capping",meaning: "Rallies partly sold off intraday — watch for repeated rejection" },
        { range: ">0.4",   label: "🚨 Heavy selling",meaning: "Rallies consistently sold into — strong sign of distribution at highs" },
      ],
    },
    maxSpike: {
      definition: "The single largest volume day in the last 20 sessions, expressed as a multiple of the 20-day average volume. Flags abnormal one-off volume days — could be a news/earnings reaction, or could be a pump/dump or a large player's single big print.",
      ranges: [
        { range: "<3×",  label: "✅ Normal",   meaning: "No abnormal volume days — typical trading pattern" },
        { range: "3–5×", label: "⚠️ Elevated", meaning: "One notably heavy day — check what happened, could be news-driven or a signal" },
        { range: ">5×",  label: "🚨 Extreme",  meaning: "Very unusual single-day volume — possible pump day or major player footprint" },
      ],
    },
    pvDiv: {
      definition: "Compares each day's price move (|close − open| ÷ open) against how much money actually traded that day (close × volume, relative to the 20-day average). A high ratio means price moved a lot on relatively thin money — the move wasn't backed by real capital, which is easy for a small player to manufacture and easy to reverse.",
      ranges: [
        { range: "<0.3",   label: "✅ Well supported", meaning: "Price moves are backed by proportionate money flow — healthy" },
        { range: "0.3–0.6",label: "⚠️ Thin support",   meaning: "Some moves happening on lighter-than-expected money — mild caution" },
        { range: ">0.6",   label: "🚨 Unsupported",    meaning: "Price moving far more than the money behind it justifies — fragile, reversal-prone" },
      ],
    },
    bandar: {
      definition: "Composite 0–100 score combining all five signals above (Vol CV, Efficiency, Upper Wick, Vol Spike, PV Divergence) into a single manipulation-risk read. Higher score = more of these individual red flags are firing together, consistent with a large player ('bandar') accumulating, distributing, or manipulating the stock rather than organic market activity.",
      ranges: [
        { range: "0–30",  label: "🟢 Clean",     meaning: "Little to no sign of manipulation — trade the technicals normally" },
        { range: "31–55", label: "🟡 Caution",   meaning: "Some red flags present — size down or wait for confirmation before entry" },
        { range: "56–100",label: "🔴 High risk", meaning: "Multiple red flags firing together — treat any breakout/breakdown with heavy skepticism" },
      ],
    },
    maxMove: {
      definition: "Largest single day body move (open→close) in last 20 days — above 10% in one session is a strong bandar signal.",
      ranges: [
        { range: "<5%",   label: "✅ Normal",   meaning: "No abnormal single-day moves" },
        { range: "5–10%", label: "⚠️ Elevated", meaning: "One notably large day — check what happened" },
        { range: ">10%",  label: "🚨 Extreme",  meaning: "Very unusual single-day move — possible manipulation" },
      ],
    },
    gapDays: {
      definition: "Number of days in last 20 where open gapped >2% vs previous close — frequent gaps = bandar marking up the open.",
      ranges: [
        { range: "<2d",  label: "✅ Normal",   meaning: "Few or no large opening gaps" },
        { range: "2–4d", label: "⚠️ Elevated", meaning: "Several gap days — worth a second look" },
        { range: ">4d",  label: "🚨 Frequent", meaning: "Frequent gapping — consistent with marked-up opens" },
      ],
    },
    reversal: {
      definition: "Rate of big up days immediately followed by down days — high rate = pump and dump pattern.",
      ranges: [
        { range: "<0.15",   label: "✅ Low",   meaning: "Big up moves tend to hold" },
        { range: "0.15–0.30",label: "⚠️ Some",  meaning: "Some up moves getting reversed — mild caution" },
        { range: ">0.30",   label: "🚨 High",  meaning: "Big up moves frequently reversed — pump and dump pattern" },
      ],
    },
    trendR2: {
      definition: "How well price fits a straight trendline over 20 days — below 0.4 means price is zigzagging with no real direction.",
      ranges: [
        { range: ">0.7",   label: "✅ Clean trend", meaning: "Price follows a consistent directional trend" },
        { range: "0.4–0.7",label: "⚠️ Choppy",      meaning: "Some trend but with meaningful noise" },
        { range: "<0.4",   label: "🚨 No trend",    meaning: "Zigzag noise — no reliable direction" },
      ],
    },
  };

  function BandarTh({ label, tipKey, sortKey }: { label: string; tipKey: string; sortKey?: SwingSortKey }) {
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const iconRef = useRef<HTMLSpanElement>(null);
    const tip = BANDAR_TOOLTIPS[tipKey];

    function show() {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (iconRef.current) {
        const r = iconRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 348) });
      }
    }
    function hide() {
      timerRef.current = setTimeout(() => setPos(null), 120);
    }

    return (
      <th
        className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap select-none${sortKey ? " cursor-pointer hover:text-gray-900" : ""}`}
        onClick={sortKey ? () => toggleSwingSort(sortKey) : undefined}
      >
        <span className="inline-flex items-center gap-1">
          {label}{sortKey && swingSortKey === sortKey ? (swingSortDir === "desc" ? " ↓" : " ↑") : ""}
          {tip && (
            <span
              ref={iconRef}
              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-300 text-gray-600 text-[9px] font-bold cursor-default leading-none"
              onClick={(e) => { e.stopPropagation(); pos ? setPos(null) : show(); }}
              onMouseEnter={show}
              onMouseLeave={hide}
            >i</span>
          )}
        </span>
        {pos && tip && (
          <div
            className="fixed z-[9999] w-[340px] bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-left normal-case tracking-normal font-normal"
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
            onMouseLeave={hide}
          >
            <p className="text-[11px] text-gray-500 leading-snug mb-2 whitespace-normal">{tip.definition}</p>
            <table className="w-full text-[11px] border-collapse table-fixed">
              <colgroup>
                <col className="w-14" />
                <col className="w-24" />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-0.5 pr-2 text-gray-400 font-semibold">Range</th>
                  <th className="text-left py-0.5 pr-2 text-gray-400 font-semibold">Label</th>
                  <th className="text-left py-0.5 text-gray-400 font-semibold">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {tip.ranges.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="py-0.5 pr-2 text-gray-700 font-mono whitespace-nowrap align-top">{row.range}</td>
                    <td className="py-0.5 pr-2 text-gray-700 whitespace-nowrap align-top">{row.label}</td>
                    <td className="py-0.5 text-gray-500 leading-snug whitespace-normal break-words align-top">{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </th>
    );
  }

  const BandarScoreCell = ({ bandar }: { bandar: BandarScoreResult | null }) => {
    if (bandar == null) {
      return <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>;
    }
    const { score, scoreBreakdown } = bandar;
    const scoreCls =
      score <= 30 ? "bg-green-100 text-green-800" : score <= 55 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";
    const scoreLabel = score <= 30 ? "🟢" : score <= 55 ? "🟡" : "🔴";
    const tooltip = scoreBreakdown
      ? `Tier 1 (manipulation): ${scoreBreakdown.tier1}pts / 65\nTier 2 (volatility): ${scoreBreakdown.tier2}pts / 25\nTier 3 (context): ${scoreBreakdown.tier3}pts / 10\nRaw score: ${scoreBreakdown.rawScore}\nLiquidity multiplier: ${scoreBreakdown.liquidityMultiplier.toFixed(1)}x\nFinal score: ${score}`
      : undefined;
    return (
      <td className={`px-3 py-2 whitespace-nowrap font-bold rounded ${scoreCls}`} title={tooltip}>
        {scoreLabel} {score}
      </td>
    );
  };

  const BandarCells = ({ bandar }: { bandar: BandarScoreResult | null }) => {
    if (bandar == null) {
      return (
        <>
          <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>
          <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>
        </>
      );
    }
    const { cv, efficiency, upperWick, maxSpike, pvDiv, avgValueTraded, volDirRatio, maxDayMove, largeGapDays, reversalRate, rSquared } = bandar;
    const cvFlag = cv < 0.8 ? "✅" : cv <= 1.5 ? "⚠️" : "🚨";
    const effFlag = efficiency > 0.5 ? "✅" : efficiency >= 0.3 ? "⚠️" : "🚨";
    const wickFlag = upperWick < 0.25 ? "✅" : upperWick <= 0.4 ? "⚠️" : "🚨";
    const spikeFlag = maxSpike < 3 ? "✅" : maxSpike <= 5 ? "⚠️" : "🚨";
    const pvFlag = pvDiv < 0.3 ? "✅" : pvDiv <= 0.6 ? "⚠️" : "🚨";

    const valueB = avgValueTraded / 1_000_000_000;
    const liquidityFlag = valueB > 20 ? "✅" : valueB >= 5 ? "⚠️" : "🚨";
    const isDoji = volDirRatio === 0.5;
    const volDirPct = volDirRatio * 100;
    const volDirFlag = isDoji ? "" : volDirPct > 60 ? "✅" : volDirPct >= 40 ? "⚠️" : "🚨";

    const maxMovePct = maxDayMove * 100;
    const maxMoveFlag = !Number.isFinite(maxMovePct) ? null : maxMovePct < 5 ? "✅" : maxMovePct <= 10 ? "⚠️" : "🚨";
    const gapFlag = !Number.isFinite(largeGapDays) ? null : largeGapDays < 2 ? "✅" : largeGapDays <= 4 ? "⚠️" : "🚨";
    const reversalFlag = !Number.isFinite(reversalRate) ? null : reversalRate < 0.15 ? "✅" : reversalRate <= 0.30 ? "⚠️" : "🚨";
    const trendFlag = !Number.isFinite(rSquared) ? null : rSquared > 0.7 ? "✅" : rSquared >= 0.4 ? "⚠️" : "🚨";

    return (
      <>
        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{valueB.toFixed(1)}B {liquidityFlag}</td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{isDoji ? "—" : `${volDirPct.toFixed(0)}% ${volDirFlag}`}</td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{cv.toFixed(2)} {cvFlag}</td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{efficiency.toFixed(2)} {effFlag}</td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{upperWick.toFixed(2)} {wickFlag}</td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{maxSpike.toFixed(1)}× {spikeFlag}</td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{pvDiv.toFixed(2)} {pvFlag}</td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{maxMoveFlag == null ? "—" : `${maxMovePct.toFixed(1)}% ${maxMoveFlag}`}</td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{gapFlag == null ? "—" : `${largeGapDays}d ${gapFlag}`}</td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{reversalFlag == null ? "—" : `${reversalRate.toFixed(2)} ${reversalFlag}`}</td>
        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{trendFlag == null ? "—" : `${rSquared.toFixed(2)} ${trendFlag}`}</td>
      </>
    );
  };

  // Stop = reference price (manual entry if set, else live price) minus 1.5x ATR — recomputes as entry price changes
  const StopLossCell = ({ atr, entryPrice, currentPrice }: { atr: number | null; entryPrice: number | null | undefined; currentPrice: number | null }) => {
    const refPrice = entryPrice ?? currentPrice;
    if (atr == null || refPrice == null) return <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>;
    const stopLoss = refPrice - 1.5 * atr;
    const stopLossPercent = ((refPrice - stopLoss) / refPrice) * 100;
    const wide = stopLossPercent > 8;
    const basis = entryPrice != null ? "entry price" : "current price";
    const title = `1.5× ATR below ${basis}. Risk: ${stopLossPercent.toFixed(1)}% from ${basis}.`;
    return (
      <td className="px-3 py-2 whitespace-nowrap font-semibold text-red-600" title={title}>
        {stopLoss.toFixed(2)}{wide ? " ⚠️" : ""}
      </td>
    );
  };

  const EntryPriceCell = ({ ticker, value }: { ticker: string; value: number | null | undefined }) => {
    const [draft, setDraft] = useState(value != null ? String(value) : "");
    useEffect(() => { setDraft(value != null ? String(value) : ""); }, [value]);

    function commit() {
      const trimmed = draft.trim();
      const parsed = trimmed === "" ? null : Number(trimmed);
      const next = parsed != null && isNaN(parsed) ? null : parsed;
      if (next !== (value ?? null)) onSwingEntryPriceChange?.(ticker, next);
    }

    return (
      <td className="px-3 py-2 whitespace-nowrap">
        <input
          type="number"
          step="any"
          value={draft}
          placeholder="—"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-24 bg-white border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 placeholder-gray-400"
        />
      </td>
    );
  };

  const tabs: { id: SubTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "fundamental", label: "Fundamental" },
    { id: "valuation", label: "Valuation" },
    { id: "technical", label: "Technical" },
  ];

  // Shared ticker sticky cell
  const TickerCell = ({ r }: { r: TableRow }) => (
    <td className={`px-3 py-2 font-semibold whitespace-nowrap sticky left-0 z-10 max-w-[92px] sm:max-w-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-200 after:content-[''] group-hover:bg-red-50 ${markedSet.has(r.ticker) ? "bg-red-50" : r.isCustom ? "bg-blue-50/30 group-hover:bg-blue-100/40" : "bg-white group-hover:bg-gray-50"}`}>
      <Link href={`/stock/${isIhsg ? `${r.ticker}.JK` : r.ticker}`} className="text-blue-600 hover:text-blue-800">
        {r.ticker}
      </Link>
      {r.name && (
        <span className="hidden sm:block text-xs text-gray-400 font-normal leading-tight truncate max-w-[160px]">
          {r.name}
        </span>
      )}
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
      {/* Main tabs: List vs Midterm/Swing (IHSG) or List vs Swing (US) */}
      <div className="flex gap-1 border-b-2 border-gray-200">
        <button
          onClick={() => setMainTab("list")}
          className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            mainTab === "list"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
          }`}
        >
          List
        </button>
        <button
          onClick={() => setMainTab(isIhsg ? "midterm" : "swing")}
          className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            mainTab === (isIhsg ? "midterm" : "swing")
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
          }`}
        >
          {isIhsg ? "Midterm or Swing" : "Swing"}
        </button>
        {!isIhsg && (
          <button
            onClick={() => setMainTab("portfolio")}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              mainTab === "portfolio"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            }`}
          >
            Portfolio
          </button>
        )}
      </div>

      {mainTab === "list" && (
      <>
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
                  <Th label="Earnings" k="earnings" title="Next/last reported earnings date" />
                  <Th label="EMA20W"     k="ema20"      title="EMA20 Weekly" />
                  <Th label="Dist EMA20" k="dist_ema20"  title="Distance from EMA20W" />
                  <Th label="EMA50W"     k="ema50"      title="EMA50 Weekly" />
                  <Th label="Dist EMA50" k="dist_ema50"  title="Distance from EMA50W" />
                  <Th label="Golden Cross" k="golden_cross" title="Most recent date EMA20W crossed above EMA50W, and days since" />
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" title="Previous support low (beaten-down stocks only)">Prev Support</th>
                  <Th label="RSI"        k="rsi" />
                  <Th label="DI+"        k="di_plus" />
                  <Th label="DI-"        k="di_minus" />
                  <Th label="ADX"        k="adx" title="Average Directional Index — trend strength: <20 no trend/choppy, 20-25 emerging, 25-45 trending, >45 overextended" />
                  <Th label="CMF"        k="cmf" />
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" title="MACD line (12, 26) — daily closes">MACD</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" title="MACD signal line (EMA9 of MACD) — daily closes">Signal</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" title="MACD histogram (MACD − Signal) — daily closes">Hist</th>
                  <Th label="Rev Gr"    k="rev_growth"   title="Revenue Growth YoY" />
                  <Th label="Gross%"    k="gross_margin" title="Gross Margin" />
                  <Th label="Op%"       k="op_margin"    title="Operating Margin" />
                  <Th label="Net%"      k="net_margin"   title="Net/Profit Margin" />
                  <Th label="FCF%"      k="fcf_margin"   title="Free Cash Flow Margin" />
                  <Th label="ROE%"      k="roe"          title="Return on Equity" />
                  {!isIhsg && (
                    <>
                      <Th label="ROIC%"        k="roic"          title="Return on Invested Capital" />
                      <Th label="Current Ratio" k="current_ratio" title="Current Assets / Current Liabilities" />
                      <Th label="Beta"          k="beta"          title="5Y monthly beta vs S&P 500" />
                    </>
                  )}
                  <Th label="D/E"       k="debt_to_equity" title="Debt to Equity ratio" />
                  {!isIhsg && (
                    <>
                      <Th label="EPS TTM"   k="eps_ttm"      title="Trailing EPS (This Year)" />
                      <Th label="EPS Fwd"   k="eps_fwd"      title="Forward EPS (Next Year)" />
                      <Th label="EPS P5Y"   k="eps_past_5y"  title="EPS Growth Past 5 Years" />
                      <Th label="EPS N5Y"   k="eps_next_5y"  title="EPS Growth Next 5 Years (analyst est.)" />
                      <Th label="Short%"    k="short_float"  title="Short Float %" />
                      <ValTooltipTh label="Fwd PE"    k="fwd_pe" />
                      <ValTooltipTh label="Trail PE"  k="trailing_pe" />
                      <ValTooltipTh label="PEG"       k="peg" />
                      <ValTooltipTh label="P/S"       k="ps_ratio" />
                      <Th label="P/B"       k="pb_ratio"   title="Price/Book (live)" />
                      <ValTooltipTh label="EV/EBITDA" k="ev_ebitda" />
                      <Th label="EV/Rev"    k="ev_revenue" title="EV/Revenue (live)" />
                      <Th label="EV/FCF"    k="ev_fcf" />
                      <ValTooltipTh label="P/FCF"     k="p_fcf" />
                      <ValTooltipTh label="5Y PE Z"   k="pe_zscore" />
                    </>
                  )}
                  {isIhsg && (
                    <>
                      <Th label="Trail PE"   k="trailing_pe" title="Trailing Price/Earnings (live)" />
                      <Th label="P/S"        k="ps_ratio"    title="Price/Sales (live)" />
                      <Th label="P/B"        k="pb_ratio"    title="Price/Book (live)" />
                      <Th label="EV/Rev"     k="ev_revenue"  title="EV/Revenue (live)" />
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
                    <td className="px-3 py-2"><EarningsBadge dateStr={earnings[r.ticker]} /></td>
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
                      const adx = adxs[r.ticker] ?? null;
                      const cmf = cmfs[r.ticker] ?? null;
                      const isBeatenDown = r.verdict?.setup === "beaten_down";
                      const goldenCrossDate = goldenCrossDates[r.ticker] ?? null;
                      const goldenCrossDays = goldenCrossDate != null
                        ? Math.round((new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime() - new Date(goldenCrossDate + "T00:00:00Z").getTime()) / 86400000)
                        : null;

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
                      const adxColor = (v: number | null) => {
                        if (v == null) return "text-gray-400";
                        if (v < 20) return "text-gray-400";
                        if (v <= 45) return "text-green-600";
                        return "text-orange-500";
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
                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                            {goldenCrossDate != null ? <>{goldenCrossDate} <span className="text-gray-400">({goldenCrossDays}D)</span></> : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {isBeatenDown && support != null ? fmtPrice(support) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-3 py-2 font-semibold ${rsiColor(rsi)}`}>
                            {rsi != null ? rsi.toFixed(1) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{diP != null ? diP.toFixed(1) : <span className="text-gray-400">—</span>}</td>
                          <td className="px-3 py-2 text-gray-700">{diM != null ? diM.toFixed(1) : <span className="text-gray-400">—</span>}</td>
                          <td className={`px-3 py-2 font-semibold ${adxColor(adx)}`}>{adx != null ? adx.toFixed(1) : <span className="text-gray-400">—</span>}</td>
                          <td className={`px-3 py-2 font-semibold ${cmfColor(cmf)}`}>
                            {cmf != null ? cmf.toFixed(3) : <span className="text-gray-400">—</span>}
                          </td>
                        </>
                      );
                    })()}
                    <MacdCell v={macds[r.ticker] ?? null} />
                    <MacdCell v={macdSignals[r.ticker] ?? null} />
                    <MacdHistCell ticker={r.ticker} />
                    <td className="px-3 py-2 text-gray-700">{pct(r.rev_growth)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.gross_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.op_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.net_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.fcf_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.roe)}</td>
                    {!isIhsg && (
                      <>
                        <td className="px-3 py-2 text-gray-700">{pct(r.roic)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.current_ratio, 2)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.beta, 2)}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-gray-700">{num(r.debt_to_equity, 2)}</td>
                    {!isIhsg && (
                      <>
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
                        <PeZScoreCell r={r} />
                      </>
                    )}
                    {isIhsg && (
                      <>
                        <td className="px-3 py-2 text-gray-700">{num(r.trailing_pe, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.ps_ratio, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.pb_ratio, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.ev_revenue, 1)}</td>
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
                  <Th label="Net%"      k="net_margin"   title="Net/Profit Margin" />
                  <Th label="FCF%"      k="fcf_margin"   title="Free Cash Flow Margin" />
                  <Th label="ROE%"      k="roe"          title="Return on Equity" />
                  <Th label="D/E"       k="debt_to_equity" title="Debt to Equity ratio" />
                  {!isIhsg && (
                    <>
                      <Th label="EPS TTM"   k="eps_ttm"      title="Trailing EPS (This Year)" />
                      <Th label="EPS Fwd"   k="eps_fwd"      title="Forward EPS (Next Year)" />
                      <Th label="EPS P5Y"   k="eps_past_5y"  title="EPS Growth Past 5 Years" />
                      <Th label="EPS N5Y"   k="eps_next_5y"  title="EPS Growth Next 5 Years (analyst est.)" />
                      <Th label="Short%"    k="short_float"  title="Short Float %" />
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
                    <td className={`px-3 py-2 font-bold ${scoreColor(r.fund)}`}>
                      {r.fund != null ? r.fund.toFixed(1) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.rev_growth)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.gross_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.op_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.net_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.fcf_margin)}</td>
                    <td className="px-3 py-2 text-gray-700">{pct(r.roe)}</td>
                    {!isIhsg && (
                      <>
                        <td className="px-3 py-2 text-gray-700">{pct(r.roic)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.current_ratio, 2)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.beta, 2)}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-gray-700">{num(r.debt_to_equity, 2)}</td>
                    {!isIhsg && (
                      <>
                        <td className="px-3 py-2 text-gray-700">{eps(r.eps_ttm)}</td>
                        <td className="px-3 py-2 text-gray-700">{eps(r.eps_fwd)}</td>
                        <td className="px-3 py-2 text-gray-700">{pct(r.eps_past_5y)}</td>
                        <td className="px-3 py-2 text-gray-700">{pct(r.eps_next_5y)}</td>
                        <td className="px-3 py-2 text-gray-700">{pct(r.short_float)}</td>
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
                      <Th label="Trail PE"   k="trailing_pe" title="Trailing Price/Earnings (live)" />
                      <Th label="P/S"        k="ps_ratio"    title="Price/Sales (live)" />
                      <Th label="P/B"        k="pb_ratio"    title="Price/Book (live)" />
                      <Th label="EV/Rev"     k="ev_revenue"  title="EV/Revenue (live)" />
                    </>
                  ) : (
                    <>
                      <ValTooltipTh label="Fwd PE"    k="fwd_pe" />
                      <ValTooltipTh label="Trail PE"  k="trailing_pe" />
                      <ValTooltipTh label="PEG"       k="peg" />
                      <ValTooltipTh label="P/S"       k="ps_ratio" />
                      <Th label="P/B"       k="pb_ratio"    title="Price/Book (live)" />
                      <ValTooltipTh label="EV/EBITDA" k="ev_ebitda" />
                      <Th label="EV/Rev"    k="ev_revenue"  title="EV/Revenue (live)" />
                      <Th label="EV/FCF"    k="ev_fcf"      title="EV/Free Cash Flow (seed data)" />
                      <ValTooltipTh label="P/FCF"     k="p_fcf" />
                      <ValTooltipTh label="5Y PE Z"   k="pe_zscore" />
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
                        <td className="px-3 py-2 text-gray-700">{num(r.ps_ratio, 1)}</td>
                        <td className="px-3 py-2 text-gray-700">{num(r.pb_ratio, 1)}</td>
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
                        <PeZScoreCell r={r} />
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
                  <Th label="Golden Cross" k="golden_cross" title="Most recent date EMA20W crossed above EMA50W, and days since" />
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" title="Previous support low (beaten-down stocks only)">Prev Support</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">RSI</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">DI+</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">DI-</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" title="Average Directional Index — trend strength: <20 no trend/choppy, 20-25 emerging, 25-45 trending, >45 overextended">ADX</th>
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
                  const adx = adxs[r.ticker] ?? null;
                  const cmf = cmfs[r.ticker] ?? null;
                  const atrV = atrs[r.ticker] ?? null;
                  const isBeatenDown = r.verdict?.setup === "beaten_down";
                  const goldenCrossDate = goldenCrossDates[r.ticker] ?? null;
                  const goldenCrossDays = goldenCrossDate != null
                    ? Math.round((new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime() - new Date(goldenCrossDate + "T00:00:00Z").getTime()) / 86400000)
                    : null;

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
                  const adxColor = (v: number | null) => {
                    if (v == null) return "text-gray-400";
                    if (v < 20) return "text-gray-400";
                    if (v <= 45) return "text-green-600";
                    return "text-orange-500";
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
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        {goldenCrossDate != null ? <>{goldenCrossDate} <span className="text-gray-400">({goldenCrossDays}D)</span></> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {isBeatenDown && support != null ? fmtPrice(support) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className={`px-3 py-2 font-semibold ${rsiColor(rsi)}`}>
                        {rsi != null ? rsi.toFixed(1) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{diP != null ? diP.toFixed(1) : <span className="text-gray-400">—</span>}</td>
                      <td className="px-3 py-2 text-gray-700">{diM != null ? diM.toFixed(1) : <span className="text-gray-400">—</span>}</td>
                      <td className={`px-3 py-2 font-semibold ${adxColor(adx)}`}>{adx != null ? adx.toFixed(1) : <span className="text-gray-400">—</span>}</td>
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
      </>
      )}

      {/* MIDTERM / SWING TAB (IHSG only) — separate, manually-managed ticker list */}
      {isIhsg && mainTab === "midterm" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={onSwingAdd} className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. BBCA"
                value={swingAddTicker}
                onChange={(e) => onSwingAddTickerChange?.(e.target.value)}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 w-32 uppercase"
              />
              <button
                type="submit"
                disabled={swingAddLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm font-semibold"
              >
                {swingAddLoading ? "Adding…" : "+ Add"}
              </button>
            </form>
            {swingAddError && <span className="text-xs text-red-500">{swingAddError}</span>}
            {swingLoading && <span className="text-xs text-gray-400 animate-pulse">Loading…</span>}
            <span className="text-xs text-gray-400 ml-auto">{swingStocks.length} stocks · independent from List</span>
            <button
              onClick={exportSwingCsv}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 bg-white"
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[72vh] rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-30">
                <tr>
                  <SwingTh label="Ticker" k="ticker" sticky />
                  <SwingTh label="Price" k="price" />
                  <SwingTh label="Industry" k="industry" />
                  <SwingTh label="Entry Price" k="entryPrice" />
                  <SwingTh label="ATR%" k="atr" />
                  <SwingTh label="EMA20D" k="ema20d" />
                  <SwingTh label="EMA50D" k="ema50d" />
                  <SwingTh label="EMA Cross" k="cross" title="Yes if EMA20D is above EMA50D. Shows the price + date of the most recent crossover." />
                  <SwingTh label="Dist EMA20D" k="distEma20d" title="Distance from EMA20D" />
                  <SwingTh label="Dist EMA50D" k="distEma50d" title="Distance from EMA50D" />
                  <SwingTh label="RSI" k="rsi" />
                  <SwingTh label="MACD" k="macd" title="MACD line (12, 26) — daily closes" />
                  <SwingTh label="Signal" k="signal" title="MACD signal line (EMA9 of MACD) — daily closes" />
                  <SwingTh label="Hist" k="hist" title="MACD histogram (MACD − Signal) — daily closes" />
                  <SwingTh label="ATR (14)" k="atr14" title="Average True Range (14, daily) — volatility range" />
                  <SwingTh label="Stop Loss" k="stopLoss" title="1.5× ATR below your entry price (falls back to current price if entry is blank)" />
                  <BandarTh label="Bandar" tipKey="bandar" sortKey="bandar" />
                  <BandarTh label="Liquidity" tipKey="liquidity" sortKey="liquidity" />
                  <BandarTh label="Dist?" tipKey="volDirRatio" sortKey="distRatio" />
                  <BandarTh label="Vol CV" tipKey="cv" sortKey="cv" />
                  <BandarTh label="Effic." tipKey="efficiency" sortKey="efficiency" />
                  <BandarTh label="UWick" tipKey="upperWick" sortKey="upperWick" />
                  <BandarTh label="Spike" tipKey="maxSpike" sortKey="maxSpike" />
                  <BandarTh label="PVDiv" tipKey="pvDiv" sortKey="pvDiv" />
                  <BandarTh label="Max Move" tipKey="maxMove" sortKey="maxMove" />
                  <BandarTh label="Gap Days" tipKey="gapDays" sortKey="gapDays" />
                  <BandarTh label="Reversal" tipKey="reversal" sortKey="reversal" />
                  <BandarTh label="Trend R²" tipKey="trendR2" sortKey="trendR2" />
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {swingStocks.length === 0 && (
                  <tr><td colSpan={23} className="px-3 py-6 text-center text-gray-400 text-sm">No tickers yet — add one above.</td></tr>
                )}
                {sortedSwingStocks.map((s) => {
                  const price = swingPrices[s.ticker] ?? null;
                  const de20 = swingDailyEma20s[s.ticker] ?? null;
                  const de50 = swingDailyEma50s[s.ticker] ?? null;
                  const atrV = swingDailyAtrs[s.ticker] ?? null;
                  const rsi = swingDailyRsis[s.ticker] ?? null;
                  const crossAbove = swingEmaCrossAbove[s.ticker] ?? null;
                  const cPrice = swingCrossPrice[s.ticker] ?? null;
                  const cDate = swingCrossDate[s.ticker] ?? null;
                  const distEma20 = price != null && de20 != null ? ((price - de20) / de20) * 100 : null;
                  const distEma50 = price != null && de50 != null ? ((price - de50) / de50) * 100 : null;

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

                  return (
                    <tr key={s.ticker} className="group transition-colors hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold whitespace-nowrap sticky left-0 z-10 max-w-[92px] sm:max-w-none bg-white group-hover:bg-gray-50 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-200 after:content-['']">
                        <Link href={`/stock/${s.ticker}.JK`} className="text-blue-600 hover:text-blue-800">{s.ticker}</Link>
                        {s.name && (
                          <span className="hidden sm:block text-xs text-gray-400 font-normal leading-tight truncate max-w-[160px]">
                            {s.name}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                        {price != null ? fmtPrice(price) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{s.industry ?? "—"}</td>
                      <EntryPriceCell ticker={s.ticker} value={s.entryPrice} />
                      <td className="px-3 py-2 whitespace-nowrap">
                        {atrV == null ? <span className="text-gray-300">—</span> : (() => {
                          const al = atrLabel(atrV);
                          return (
                            <div>
                              <span className={`font-semibold ${al.color}`}>{atrV.toFixed(1)}%</span>
                              <span className={`block text-xs leading-tight ${al.color} opacity-80`}>{al.label}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{de20 != null ? fmtPrice(de20) : <span className="text-gray-400">—</span>}</td>
                      <td className="px-3 py-2 text-gray-700">{de50 != null ? fmtPrice(de50) : <span className="text-gray-400">—</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {crossAbove == null ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${crossAbove ? "bg-green-100 text-green-700 border border-green-300" : "bg-red-100 text-red-700 border border-red-300"}`}>
                              {crossAbove ? "Yes" : "No"}
                            </span>
                            {cPrice != null && cDate != null && (
                              <span className="block text-[11px] text-gray-400 mt-0.5">
                                @ {fmtPrice(cPrice)} on {cDate}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className={`px-3 py-2 font-semibold ${distColor(distEma20)}`}>
                        {distEma20 != null ? `${distEma20 > 0 ? "+" : ""}${distEma20.toFixed(1)}%` : <span className="text-gray-400">—</span>}
                      </td>
                      <td className={`px-3 py-2 font-semibold ${distColor(distEma50)}`}>
                        {distEma50 != null ? `${distEma50 > 0 ? "+" : ""}${distEma50.toFixed(1)}%` : <span className="text-gray-400">—</span>}
                      </td>
                      <td className={`px-3 py-2 font-semibold ${rsiColor(rsi)}`}>
                        {rsi != null ? rsi.toFixed(1) : <span className="text-gray-400">—</span>}
                      </td>
                      <MacdCell v={swingMacds[s.ticker] ?? null} />
                      <MacdCell v={swingMacdSignals[s.ticker] ?? null} />
                      {(() => {
                        const hist = swingMacdHists[s.ticker] ?? null;
                        const dir = swingMacdHistDirs[s.ticker] ?? null;
                        if (hist == null) return <td className="px-3 py-2 whitespace-nowrap text-gray-300">—</td>;
                        const arrow = hist > 0 && dir === "up" ? " ▲" : hist < 0 && dir === "down" ? " ▼" : "";
                        return (
                          <td className={`px-3 py-2 whitespace-nowrap font-bold ${valColorCls(hist)}`}>
                            {hist.toFixed(2)}{arrow}
                          </td>
                        );
                      })()}
                      <AtrCell v={swingAtr14[s.ticker] ?? null} />
                      <StopLossCell atr={swingAtr14[s.ticker] ?? null} entryPrice={s.entryPrice} currentPrice={price} />
                      <BandarScoreCell bandar={swingBandar[s.ticker] ?? null} />
                      <BandarCells bandar={swingBandar[s.ticker] ?? null} />
                      <td className="px-3 py-2">
                        <button
                          onClick={() => onSwingRemove?.(s.ticker)}
                          className="text-red-300 hover:text-red-500 text-xs"
                          title="Remove from Midterm/Swing list"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SWING TAB (US only) — separate, manually-managed ticker list independent from List */}
      {!isIhsg && mainTab === "swing" && (
        <USSwingTable
          stocks={usSwingStocks}
          prices={usSwingPrices}
          prevCloses={usSwingPrevCloses}
          atrs={usSwingAtrs}
          ema20s={usSwingEma20s}
          ema50s={usSwingEma50s}
          goldenCrossDates={usSwingGoldenCrossDates}
          macds={usSwingMacds}
          roc14s={usSwingRoc14s}
          rsis={usSwingRsis}
          diPluses={usSwingDiPluses}
          diMinuses={usSwingDiMinuses}
          adxs={usSwingAdxs}
          low6mos={usSwingLow6mos}
          resistances={usSwingResistances}
          daysSinceResistances={usSwingDaysSinceResistances}
          high5yrs={usSwingHigh5yrs}
          distHigh5yrs={usSwingDistHigh5yrs}
          relVolumes={usSwingRelVolumes}
          shortFloats={usSwingShortFloats}
          advs={usSwingAdvs}
          earnings={usSwingEarnings}
          loading={usSwingLoading}
          addTicker={usSwingAddTicker}
          addLoading={usSwingAddLoading}
          addError={usSwingAddError}
          onAddTickerChange={onUsSwingAddTickerChange}
          onAdd={onUsSwingAdd}
          onRemove={onUsSwingRemove}
          onToggleStar={onUsSwingToggleStar}
        />
      )}

      {/* PORTFOLIO TAB (US only) — three independent, manually-managed divisions */}
      {!isIhsg && mainTab === "portfolio" && (
        <div className="space-y-3">
          <div className="flex gap-1 border-b border-gray-200">
            {PORTFOLIO_DIVISIONS.map((d) => (
              <button
                key={d.id}
                onClick={() => setPortfolioDivision(d.id)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  portfolioDivision === d.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <PortfolioTable
            division={portfolioDivision}
            stocks={portfolioStocks[portfolioDivision]}
            prices={portfolioPrices}
            prevCloses={portfolioPrevCloses}
            loading={portfolioLoading[portfolioDivision]}
            addTicker={portfolioAddTicker[portfolioDivision]}
            addLoading={portfolioAddLoading[portfolioDivision]}
            addError={portfolioAddError[portfolioDivision]}
            onAddTickerChange={(v) => onPortfolioAddTickerChange?.(portfolioDivision, v)}
            onAdd={(e) => onPortfolioAdd?.(portfolioDivision, e)}
            onRemove={(ticker) => onPortfolioRemove?.(portfolioDivision, ticker)}
            onEntryChange={(ticker, field, value) => onPortfolioEntryChange?.(portfolioDivision, ticker, field, value)}
            onLevelChange={(ticker, field, value) => onPortfolioLevelChange?.(portfolioDivision, ticker, field, value)}
          />
        </div>
      )}
    </div>
  );
}
