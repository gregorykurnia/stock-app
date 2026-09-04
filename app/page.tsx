"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MasterTable from "@/components/MasterTable";
import { SEED_STOCKS } from "@/lib/seedData";
import { IHSG_STOCKS } from "@/lib/ihsgSeedData";
import {
  loadStockData, getCustomStocks, saveCustomStock, removeCustomStock,
  getIhsgCustomStocks, saveIhsgCustomStock, removeIhsgCustomStock,
  getIhsgSwingStocks, saveIhsgSwingStock, removeIhsgSwingStock, updateIhsgSwingEntryPrice,
  getUsSwingStocks, saveUsSwingStock, removeUsSwingStock, updateUsSwingStar, updateUsSwingPortfolio,
  getUsBreakoutStocks, saveUsBreakoutStock, removeUsBreakoutStock, updateUsBreakoutStar,
  getPortfolioTickers, getWatchlistTickers,
  savePortfolioEntry, removePortfolioEntry,
  saveWatchlistEntry, removeWatchlistEntry,
  getMarkedTickers, markTicker, unmarkTicker,
  getPeStatsMap,
  getPortfolioDivisionStocks, savePortfolioDivisionStock, removePortfolioDivisionStock, updatePortfolioDivisionEntry,
  type PortfolioDivision,
} from "@/lib/firestore";
import type { PortfolioStock, PortfolioLevelField } from "@/components/PortfolioTable";
import type { CustomStock, PeStats } from "@/lib/types";
import type { BandarScoreResult } from "@/lib/indicators";
import type { FundData } from "@/app/api/funddata/route";
import type { BreakoutStatus } from "@/components/USBreakoutTable";

const SEED_TICKERS = new Set(SEED_STOCKS.map((s) => s.ticker));
const IHSG_TICKERS = new Set(IHSG_STOCKS.map((s) => s.ticker));

type Market = "us" | "ihsg";

export default function Home() {
  const router = useRouter();
  const [market, setMarket] = useState<Market>("us");
  const [inputTicker, setInputTicker] = useState("");
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [preMarketPrices, setPreMarketPrices] = useState<Record<string, number | null>>({});
  const [verdicts, setVerdicts] = useState<Record<string, { urgency: string; setup: string } | null>>({});
  const [atrs, setAtrs] = useState<Record<string, number | null>>({});
  const [ema20s, setEma20s] = useState<Record<string, number | null>>({});
  const [ema50s, setEma50s] = useState<Record<string, number | null>>({});
  const [goldenCrossDates, setGoldenCrossDates] = useState<Record<string, string | null>>({});
  const [supportLows, setSupportLows] = useState<Record<string, number | null>>({});
  const [rsis, setRsis] = useState<Record<string, number | null>>({});
  const [diPluses, setDiPluses] = useState<Record<string, number | null>>({});
  const [diMinuses, setDiMinuses] = useState<Record<string, number | null>>({});
  const [adxs, setAdxs] = useState<Record<string, number | null>>({});
  const [cmfs, setCmfs] = useState<Record<string, number | null>>({});
  const [macds, setMacds] = useState<Record<string, number | null>>({});
  const [macdSignals, setMacdSignals] = useState<Record<string, number | null>>({});
  const [macdHists, setMacdHists] = useState<Record<string, number | null>>({});
  const [macdHistDirs, setMacdHistDirs] = useState<Record<string, "up" | "down" | "flat" | null>>({});
  const [earnings, setEarnings] = useState<Record<string, string | null>>({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const [customStocks, setCustomStocks] = useState<CustomStock[]>([]);
  const [fundData, setFundData] = useState<Record<string, FundData>>({});
  const [portfolioSet, setPortfolioSet] = useState<Set<string>>(new Set());
  const [watchlistSet, setWatchlistSet] = useState<Set<string>>(new Set());
  const [markedSet, setMarkedSet] = useState<Set<string>>(new Set());
  const [peStats, setPeStats] = useState<Record<string, PeStats>>({});
  const [peRefreshing, setPeRefreshing] = useState(false);
  const [peProgress, setPeProgress] = useState("");

  // US "Swing" tab — separate, manually-managed ticker list, independent from List. Starts empty.
  interface UsSwingStock { ticker: string; name: string | null; industry: string | null; starred?: boolean; inPortfolio?: boolean; addedAt?: string | null }
  const [usSwingStocks, setUsSwingStocks] = useState<UsSwingStock[]>([]);
  const [usSwingPrices, setUsSwingPrices] = useState<Record<string, number | null>>({});
  const [usSwingPrevCloses, setUsSwingPrevCloses] = useState<Record<string, number | null>>({});
  const [usSwingAtrs, setUsSwingAtrs] = useState<Record<string, number | null>>({});
  const [usSwingEma20s, setUsSwingEma20s] = useState<Record<string, number | null>>({});
  const [usSwingEma50s, setUsSwingEma50s] = useState<Record<string, number | null>>({});
  const [usSwingGoldenCrossDates, setUsSwingGoldenCrossDates] = useState<Record<string, string | null>>({});
  const [usSwingMacds, setUsSwingMacds] = useState<Record<string, number | null>>({});
  const [usSwingRoc14s, setUsSwingRoc14s] = useState<Record<string, number | null>>({});
  const [usSwingRoc63s, setUsSwingRoc63s] = useState<Record<string, number | null>>({});
  const [usSwingRoc90s, setUsSwingRoc90s] = useState<Record<string, number | null>>({});
  const [usSwingSortinos, setUsSwingSortinos] = useState<Record<string, number | null>>({});
  const [usSwingSortino6mos, setUsSwingSortino6mos] = useState<Record<string, number | null>>({});
  const [usSwingRsis, setUsSwingRsis] = useState<Record<string, number | null>>({});
  const [usSwingDiPluses, setUsSwingDiPluses] = useState<Record<string, number | null>>({});
  const [usSwingDiMinuses, setUsSwingDiMinuses] = useState<Record<string, number | null>>({});
  const [usSwingAdxs, setUsSwingAdxs] = useState<Record<string, number | null>>({});
  const [usSwingLow6mos, setUsSwingLow6mos] = useState<Record<string, number | null>>({});
  const [usSwingResistances, setUsSwingResistances] = useState<Record<string, number | null>>({});
  const [usSwingDaysSinceResistances, setUsSwingDaysSinceResistances] = useState<Record<string, number | null>>({});
  const [usSwingHigh5yrs, setUsSwingHigh5yrs] = useState<Record<string, number | null>>({});
  const [usSwingDistHigh5yrs, setUsSwingDistHigh5yrs] = useState<Record<string, number | null>>({});
  const [usSwingDaysSinceHigh5yrs, setUsSwingDaysSinceHigh5yrs] = useState<Record<string, number | null>>({});
  const [usSwingLow1yrs, setUsSwingLow1yrs] = useState<Record<string, number | null>>({});
  const [usSwingDistLow1yrs, setUsSwingDistLow1yrs] = useState<Record<string, number | null>>({});
  const [usSwingDaysSinceLow1yrs, setUsSwingDaysSinceLow1yrs] = useState<Record<string, number | null>>({});
  const [usSwingRelVolumes, setUsSwingRelVolumes] = useState<Record<string, number | null>>({});
  const [usSwingShortFloats, setUsSwingShortFloats] = useState<Record<string, number | null>>({});
  const [usSwingAdvs, setUsSwingAdvs] = useState<Record<string, number | null>>({});
  const [usSwingEarnings, setUsSwingEarnings] = useState<Record<string, string | null>>({});
  const [usSwingLoading, setUsSwingLoading] = useState(false);
  const [usSwingLoaded, setUsSwingLoaded] = useState(false);
  const [usSwingAddTicker, setUsSwingAddTicker] = useState("");
  const [usSwingAddLoading, setUsSwingAddLoading] = useState(false);
  const [usSwingAddError, setUsSwingAddError] = useState("");

  // US "Breakout" tab — separate, manually-managed ticker list, independent from List/Swing.
  // Tracks RSI/MACD divergence off a swing low through to a confirmed bullish MACD cross.
  interface UsBreakoutStock { ticker: string; name: string | null; industry: string | null; starred?: boolean; addedAt?: string | null }
  interface UsBreakoutData {
    swingLow: number | null; swingLowDate: string | null;
    rsiAtLow: number | null; rsiAnchor: number | null; rsiAnchorDate: string | null; rsiAnchorPrice: number | null; priceDeclinePct: number | null;
    rsiDivergencePct: number | null; rsiBandDepthPct: number | null;
    histAtAnchor: number | null; histAtLow: number | null; histCompression: number | null;
    crossDate: string | null; crossPrice: number | null; pctAboveLowAtCross: number | null; daysLowToCross: number | null;
    distEma20AtCross: number | null; distEma50AtCross: number | null; relVolumeAtCross: number | null;
    status: BreakoutStatus;
    rsiCurrent: number | null; macdHistCurrent: number | null;
  }
  const [usBreakoutStocks, setUsBreakoutStocks] = useState<UsBreakoutStock[]>([]);
  const [usBreakoutPrices, setUsBreakoutPrices] = useState<Record<string, number | null>>({});
  const [usBreakoutData, setUsBreakoutData] = useState<Record<string, UsBreakoutData>>({});
  const [usBreakoutShortFloats, setUsBreakoutShortFloats] = useState<Record<string, number | null>>({});
  const [usBreakoutAdvs, setUsBreakoutAdvs] = useState<Record<string, number | null>>({});
  const [usBreakoutEarnings, setUsBreakoutEarnings] = useState<Record<string, string | null>>({});
  const [usBreakoutLoading, setUsBreakoutLoading] = useState(false);
  const [usBreakoutLoaded, setUsBreakoutLoaded] = useState(false);
  const [usBreakoutAddTicker, setUsBreakoutAddTicker] = useState("");
  const [usBreakoutAddLoading, setUsBreakoutAddLoading] = useState(false);
  const [usBreakoutAddError, setUsBreakoutAddError] = useState("");

  // "Portfolio" tab — three independent, manually-managed divisions (Long Term / Index / Swing)
  const [portfolioStocks, setPortfolioStocks] = useState<Record<PortfolioDivision, PortfolioStock[]>>({ longterm: [], index: [], swing: [] });
  const [portfolioPrices, setPortfolioPrices] = useState<Record<string, number | null>>({});
  const [portfolioPrevCloses, setPortfolioPrevCloses] = useState<Record<string, number | null>>({});
  const [portfolioLoaded, setPortfolioLoaded] = useState<Record<PortfolioDivision, boolean>>({ longterm: false, index: false, swing: false });
  const [portfolioLoading, setPortfolioLoading] = useState<Record<PortfolioDivision, boolean>>({ longterm: false, index: false, swing: false });
  const [portfolioAddTicker, setPortfolioAddTicker] = useState<Record<PortfolioDivision, string>>({ longterm: "", index: "", swing: "" });
  const [portfolioAddLoading, setPortfolioAddLoading] = useState<Record<PortfolioDivision, boolean>>({ longterm: false, index: false, swing: false });
  const [portfolioAddError, setPortfolioAddError] = useState<Record<PortfolioDivision, string>>({ longterm: "", index: "", swing: "" });

  // IHSG state (mirrors US state, tickers stored without .JK)
  const [ihsgCustomStocks, setIhsgCustomStocks] = useState<CustomStock[]>([]);
  const [ihsgPrices, setIhsgPrices] = useState<Record<string, number | null>>({});
  const [ihsgAtrs, setIhsgAtrs] = useState<Record<string, number | null>>({});
  const [ihsgEma20s, setIhsgEma20s] = useState<Record<string, number | null>>({});
  const [ihsgEma50s, setIhsgEma50s] = useState<Record<string, number | null>>({});
  const [ihsgSupportLows, setIhsgSupportLows] = useState<Record<string, number | null>>({});
  const [ihsgRsis, setIhsgRsis] = useState<Record<string, number | null>>({});
  const [ihsgDiPluses, setIhsgDiPluses] = useState<Record<string, number | null>>({});
  const [ihsgDiMinuses, setIhsgDiMinuses] = useState<Record<string, number | null>>({});
  const [ihsgAdxs, setIhsgAdxs] = useState<Record<string, number | null>>({});
  const [ihsgCmfs, setIhsgCmfs] = useState<Record<string, number | null>>({});
  const [ihsgMacds, setIhsgMacds] = useState<Record<string, number | null>>({});
  const [ihsgMacdSignals, setIhsgMacdSignals] = useState<Record<string, number | null>>({});
  const [ihsgMacdHists, setIhsgMacdHists] = useState<Record<string, number | null>>({});
  const [ihsgMacdHistDirs, setIhsgMacdHistDirs] = useState<Record<string, "up" | "down" | "flat" | null>>({});
  const [ihsgEarnings, setIhsgEarnings] = useState<Record<string, string | null>>({});
  const [ihsgVerdicts, setIhsgVerdicts] = useState<Record<string, { urgency: string; setup: string } | null>>({});
  const [ihsgFundData, setIhsgFundData] = useState<Record<string, FundData>>({});
  const [ihsgPricesLoading, setIhsgPricesLoading] = useState(false);

  // IHSG "Midterm or Swing" subtab — separate, manually-managed ticker list
  interface SwingStock { ticker: string; name: string | null; industry: string | null; entryPrice?: number | null }
  const [swingStocks, setSwingStocks] = useState<SwingStock[]>([]);
  const [swingPrices, setSwingPrices] = useState<Record<string, number | null>>({});
  const [swingDailyEma20s, setSwingDailyEma20s] = useState<Record<string, number | null>>({});
  const [swingMacds, setSwingMacds] = useState<Record<string, number | null>>({});
  const [swingMacdSignals, setSwingMacdSignals] = useState<Record<string, number | null>>({});
  const [swingMacdHists, setSwingMacdHists] = useState<Record<string, number | null>>({});
  const [swingMacdHistDirs, setSwingMacdHistDirs] = useState<Record<string, "up" | "down" | "flat" | null>>({});
  const [swingAtr14, setSwingAtr14] = useState<Record<string, number | null>>({});
  const [swingDailyEma50s, setSwingDailyEma50s] = useState<Record<string, number | null>>({});
  const [swingDailyAtrs, setSwingDailyAtrs] = useState<Record<string, number | null>>({});
  const [swingDailyRsis, setSwingDailyRsis] = useState<Record<string, number | null>>({});
  const [swingEmaCrossAbove, setSwingEmaCrossAbove] = useState<Record<string, boolean | null>>({});
  const [swingCrossPrice, setSwingCrossPrice] = useState<Record<string, number | null>>({});
  const [swingCrossDate, setSwingCrossDate] = useState<Record<string, string | null>>({});
  const [swingBandar, setSwingBandar] = useState<Record<string, BandarScoreResult | null>>({});
  const [swingLoading, setSwingLoading] = useState(false);
  const [swingAddTicker, setSwingAddTicker] = useState("");
  const [swingAddLoading, setSwingAddLoading] = useState(false);
  const [swingAddError, setSwingAddError] = useState("");

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

  async function loadPeStats() {
    const data = await getPeStatsMap().catch(() => ({}));
    setPeStats(data as Record<string, PeStats>);
  }

  // Recomputes 5Y P/E z-score for every US ticker (seed + custom) from SEC EDGAR + Yahoo.
  // Slow (SEC/Yahoo rate limits) so it's a manual, on-demand refresh — not run on every page load.
  async function handleRefreshPeStats() {
    const tickers = [...SEED_STOCKS.map((s) => s.ticker), ...customStocks.map((s) => s.ticker)];
    setPeRefreshing(true);
    const batchSize = 8;
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      setPeProgress(`${Math.min(i + batchSize, tickers.length)}/${tickers.length}`);
      try {
        const res = await fetch(`/api/pe-stats?tickers=${batch.join(",")}`);
        if (!res.ok) {
          console.error(`[pe-stats] batch fetch failed for ${batch.join(",")}: HTTP ${res.status}`);
          continue;
        }
        const d = await res.json();
        setPeStats((prev) => ({ ...prev, ...(d.data ?? {}) }));
      } catch (e) {
        console.error(`[pe-stats] batch fetch threw for ${batch.join(",")}`, e);
        // continue with the next batch even if one fails
      }
    }
    setPeRefreshing(false);
    setPeProgress("");
  }

  function fetchUsSwingDaily(tickers: string[]) {
    if (tickers.length === 0) return;
    fetch(`/api/swing-daily?tickers=${tickers.join(",")}`)
      .then((r) => r.json())
      .then((d) => {
        setUsSwingEma20s((p) => ({ ...p, ...(d.ema20 ?? {}) }));
        setUsSwingEma50s((p) => ({ ...p, ...(d.ema50 ?? {}) }));
        setUsSwingGoldenCrossDates((p) => ({ ...p, ...(d.goldenCrossDate ?? {}) }));
        setUsSwingAtrs((p) => ({ ...p, ...(d.atrPct ?? {}) }));
        setUsSwingRsis((p) => ({ ...p, ...(d.rsi ?? {}) }));
        setUsSwingDiPluses((p) => ({ ...p, ...(d.diPlus ?? {}) }));
        setUsSwingDiMinuses((p) => ({ ...p, ...(d.diMinus ?? {}) }));
        setUsSwingAdxs((p) => ({ ...p, ...(d.adx ?? {}) }));
        setUsSwingMacds((p) => ({ ...p, ...(d.macd ?? {}) }));
        setUsSwingRoc14s((p) => ({ ...p, ...(d.roc14 ?? {}) }));
        setUsSwingRoc63s((p) => ({ ...p, ...(d.roc63 ?? {}) }));
        setUsSwingRoc90s((p) => ({ ...p, ...(d.roc90 ?? {}) }));
        setUsSwingSortinos((p) => ({ ...p, ...(d.sortino ?? {}) }));
        setUsSwingSortino6mos((p) => ({ ...p, ...(d.sortino6mo ?? {}) }));
        setUsSwingLow6mos((p) => ({ ...p, ...(d.low6mo ?? {}) }));
        setUsSwingResistances((p) => ({ ...p, ...(d.resistance ?? {}) }));
        setUsSwingDaysSinceResistances((p) => ({ ...p, ...(d.daysSinceResistance ?? {}) }));
        setUsSwingHigh5yrs((p) => ({ ...p, ...(d.high5yr ?? {}) }));
        setUsSwingDistHigh5yrs((p) => ({ ...p, ...(d.distFromHigh5yr ?? {}) }));
        setUsSwingDaysSinceHigh5yrs((p) => ({ ...p, ...(d.daysSinceHigh5yr ?? {}) }));
        setUsSwingLow1yrs((p) => ({ ...p, ...(d.low1yr ?? {}) }));
        setUsSwingDistLow1yrs((p) => ({ ...p, ...(d.distFromLow1yr ?? {}) }));
        setUsSwingDaysSinceLow1yrs((p) => ({ ...p, ...(d.daysSinceLow1yr ?? {}) }));
        setUsSwingRelVolumes((p) => ({ ...p, ...(d.relVolume ?? {}) }));
      })
      .catch(() => {});
  }

  async function loadUsSwingStocks() {
    const data = await getUsSwingStocks().catch(() => ({}));
    const list = Object.entries(data).map(([ticker, d]) => {
      const raw = d as { name?: string | null; industry?: string | null; starred?: boolean; in_portfolio?: boolean; added_at?: string | null };
      return { ticker, name: raw.name ?? null, industry: raw.industry ?? null, starred: raw.starred ?? false, inPortfolio: raw.in_portfolio ?? false, addedAt: raw.added_at ?? null } as UsSwingStock;
    });
    list.sort((a, b) => a.ticker.localeCompare(b.ticker));
    setUsSwingStocks(list);
    return list;
  }

  async function handleToggleUsSwingStar(ticker: string) {
    const current = usSwingStocks.find((s) => s.ticker === ticker)?.starred ?? false;
    const next = !current;
    setUsSwingStocks((prev) => prev.map((s) => (s.ticker === ticker ? { ...s, starred: next } : s)));
    await updateUsSwingStar(ticker, next);
  }

  async function handleToggleUsSwingPortfolio(ticker: string) {
    const current = usSwingStocks.find((s) => s.ticker === ticker)?.inPortfolio ?? false;
    const next = !current;
    setUsSwingStocks((prev) => prev.map((s) => (s.ticker === ticker ? { ...s, inPortfolio: next } : s)));
    await updateUsSwingPortfolio(ticker, next);
  }

  function handleUsSwingTabOpen() {
    if (usSwingLoaded || market !== "us") return;
    setUsSwingLoaded(true);
    setUsSwingLoading(true);
    loadUsSwingStocks().then((list) => {
      setUsSwingLoading(false);
      if (list.length === 0) return;
      const tickers = list.map((s) => s.ticker);
      fetch(`/api/prices?tickers=${tickers.join(",")}`)
        .then((r) => r.json())
        .then((d) => {
          setUsSwingPrices((p) => ({ ...p, ...(d.prices ?? {}) }));
          setUsSwingPrevCloses((p) => ({ ...p, ...(d.previousCloses ?? {}) }));
        })
        .catch(() => {});
      fetchUsSwingDaily(tickers);
      fetchUsSwingFundAndEarnings(tickers);
    });
  }

  function fetchUsSwingFundAndEarnings(tickers: string[]) {
    const joined = tickers.join(",");
    fetch(`/api/funddata?tickers=${joined}`)
      .then((r) => r.json())
      .then((d) => {
        const data = (d.data ?? {}) as Record<string, FundData>;
        const shortFloat: Record<string, number | null> = {};
        const adv: Record<string, number | null> = {};
        for (const [k, v] of Object.entries(data)) {
          shortFloat[k] = v.short_float ?? null;
          adv[k] = v.average_volume ?? null;
        }
        setUsSwingShortFloats((p) => ({ ...p, ...shortFloat }));
        setUsSwingAdvs((p) => ({ ...p, ...adv }));
      })
      .catch(() => {});
    fetch(`/api/earnings?tickers=${joined}`)
      .then((r) => r.json())
      .then((d) => setUsSwingEarnings((p) => ({ ...p, ...(d.earnings ?? {}) })))
      .catch(() => {});
  }

  async function handleAddUsSwingTicker(e: React.FormEvent) {
    e.preventDefault();
    const sym = usSwingAddTicker.trim().toUpperCase();
    if (!sym) return;
    if (usSwingStocks.some((s) => s.ticker === sym)) {
      setUsSwingAddError(`${sym} is already in the Swing list.`);
      return;
    }
    setUsSwingAddLoading(true);
    setUsSwingAddError("");
    try {
      const res = await fetch(`/api/fundamentals?ticker=${sym}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch data");

      const nowIso = new Date().toISOString();
      const entry: UsSwingStock = { ticker: sym, name: data.name ?? null, industry: data.industry ?? data.sector ?? null, addedAt: nowIso };
      await saveUsSwingStock(sym, { name: entry.name, industry: entry.industry, added_at: nowIso });
      setUsSwingStocks((prev) => [...prev.filter((s) => s.ticker !== sym), entry].sort((a, b) => a.ticker.localeCompare(b.ticker)));
      if (data.price != null) setUsSwingPrices((p) => ({ ...p, [sym]: data.price }));
      fetch(`/api/prices?tickers=${sym}`)
        .then((r) => r.json())
        .then((d) => setUsSwingPrevCloses((p) => ({ ...p, ...(d.previousCloses ?? {}) })))
        .catch(() => {});
      fetchUsSwingDaily([sym]);
      fetchUsSwingFundAndEarnings([sym]);
      setUsSwingAddTicker("");
    } catch (err) {
      setUsSwingAddError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUsSwingAddLoading(false);
    }
  }

  async function handleRemoveUsSwingTicker(ticker: string) {
    await removeUsSwingStock(ticker);
    setUsSwingStocks((prev) => prev.filter((s) => s.ticker !== ticker));
  }

  function fetchUsBreakoutDaily(tickers: string[]) {
    if (tickers.length === 0) return;
    fetch(`/api/breakout-daily?tickers=${tickers.join(",")}`)
      .then((r) => r.json())
      .then((d) => {
        setUsBreakoutData((prev) => {
          const next = { ...prev };
          for (const t of tickers) {
            next[t] = {
              swingLow: d.swingLow?.[t] ?? null, swingLowDate: d.swingLowDate?.[t] ?? null,
              rsiAtLow: d.rsiAtLow?.[t] ?? null, rsiAnchor: d.rsiAnchor?.[t] ?? null, rsiAnchorDate: d.rsiAnchorDate?.[t] ?? null,
              rsiAnchorPrice: d.rsiAnchorPrice?.[t] ?? null, priceDeclinePct: d.priceDeclinePct?.[t] ?? null,
              rsiDivergencePct: d.rsiDivergencePct?.[t] ?? null, rsiBandDepthPct: d.rsiBandDepthPct?.[t] ?? null,
              histAtAnchor: d.histAtAnchor?.[t] ?? null, histAtLow: d.histAtLow?.[t] ?? null, histCompression: d.histCompression?.[t] ?? null,
              crossDate: d.crossDate?.[t] ?? null, crossPrice: d.crossPrice?.[t] ?? null,
              pctAboveLowAtCross: d.pctAboveLowAtCross?.[t] ?? null, daysLowToCross: d.daysLowToCross?.[t] ?? null,
              distEma20AtCross: d.distEma20AtCross?.[t] ?? null, distEma50AtCross: d.distEma50AtCross?.[t] ?? null,
              relVolumeAtCross: d.relVolumeAtCross?.[t] ?? null, status: d.status?.[t] ?? null,
              rsiCurrent: d.rsiCurrent?.[t] ?? null, macdHistCurrent: d.macdHistCurrent?.[t] ?? null,
            };
          }
          return next;
        });
      })
      .catch(() => {});
  }

  function fetchUsBreakoutFundAndEarnings(tickers: string[]) {
    const joined = tickers.join(",");
    fetch(`/api/funddata?tickers=${joined}`)
      .then((r) => r.json())
      .then((d) => {
        const data = (d.data ?? {}) as Record<string, FundData>;
        const shortFloat: Record<string, number | null> = {};
        const adv: Record<string, number | null> = {};
        for (const [k, v] of Object.entries(data)) {
          shortFloat[k] = v.short_float ?? null;
          adv[k] = v.average_volume ?? null;
        }
        setUsBreakoutShortFloats((p) => ({ ...p, ...shortFloat }));
        setUsBreakoutAdvs((p) => ({ ...p, ...adv }));
      })
      .catch(() => {});
    fetch(`/api/earnings?tickers=${joined}`)
      .then((r) => r.json())
      .then((d) => setUsBreakoutEarnings((p) => ({ ...p, ...(d.earnings ?? {}) })))
      .catch(() => {});
  }

  async function loadUsBreakoutStocks() {
    const data = await getUsBreakoutStocks().catch(() => ({}));
    const list = Object.entries(data).map(([ticker, d]) => {
      const raw = d as { name?: string | null; industry?: string | null; starred?: boolean; added_at?: string | null };
      return { ticker, name: raw.name ?? null, industry: raw.industry ?? null, starred: raw.starred ?? false, addedAt: raw.added_at ?? null } as UsBreakoutStock;
    });
    list.sort((a, b) => a.ticker.localeCompare(b.ticker));
    setUsBreakoutStocks(list);
    return list;
  }

  async function handleToggleUsBreakoutStar(ticker: string) {
    const current = usBreakoutStocks.find((s) => s.ticker === ticker)?.starred ?? false;
    const next = !current;
    setUsBreakoutStocks((prev) => prev.map((s) => (s.ticker === ticker ? { ...s, starred: next } : s)));
    await updateUsBreakoutStar(ticker, next);
  }

  function handleUsBreakoutTabOpen() {
    if (usBreakoutLoaded || market !== "us") return;
    setUsBreakoutLoaded(true);
    setUsBreakoutLoading(true);
    loadUsBreakoutStocks().then((list) => {
      setUsBreakoutLoading(false);
      if (list.length === 0) return;
      const tickers = list.map((s) => s.ticker);
      fetch(`/api/prices?tickers=${tickers.join(",")}`)
        .then((r) => r.json())
        .then((d) => setUsBreakoutPrices((p) => ({ ...p, ...(d.prices ?? {}) })))
        .catch(() => {});
      fetchUsBreakoutDaily(tickers);
      fetchUsBreakoutFundAndEarnings(tickers);
    });
  }

  async function handleAddUsBreakoutTicker(e: React.FormEvent) {
    e.preventDefault();
    const sym = usBreakoutAddTicker.trim().toUpperCase();
    if (!sym) return;
    if (usBreakoutStocks.some((s) => s.ticker === sym)) {
      setUsBreakoutAddError(`${sym} is already in the Breakout list.`);
      return;
    }
    setUsBreakoutAddLoading(true);
    setUsBreakoutAddError("");
    try {
      const res = await fetch(`/api/fundamentals?ticker=${sym}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch data");

      const nowIso = new Date().toISOString();
      const entry: UsBreakoutStock = { ticker: sym, name: data.name ?? null, industry: data.industry ?? data.sector ?? null, addedAt: nowIso };
      await saveUsBreakoutStock(sym, { name: entry.name, industry: entry.industry, added_at: nowIso });
      setUsBreakoutStocks((prev) => [...prev.filter((s) => s.ticker !== sym), entry].sort((a, b) => a.ticker.localeCompare(b.ticker)));
      if (data.price != null) setUsBreakoutPrices((p) => ({ ...p, [sym]: data.price }));
      fetchUsBreakoutDaily([sym]);
      fetchUsBreakoutFundAndEarnings([sym]);
      setUsBreakoutAddTicker("");
    } catch (err) {
      setUsBreakoutAddError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUsBreakoutAddLoading(false);
    }
  }

  async function handleRemoveUsBreakoutTicker(ticker: string) {
    await removeUsBreakoutStock(ticker);
    setUsBreakoutStocks((prev) => prev.filter((s) => s.ticker !== ticker));
  }

  async function loadPortfolioDivision(division: PortfolioDivision) {
    const data = await getPortfolioDivisionStocks(division).catch(() => ({}));
    const list = Object.entries(data).map(([ticker, d]) => {
      const raw = d as {
        name?: string | null; industry?: string | null; entry_price?: number | null; entry_quantity?: number | null;
        nearest_support?: number | null; r1?: number | null; r2?: number | null; r3?: number | null;
      };
      return {
        ticker,
        name: raw.name ?? null,
        industry: raw.industry ?? null,
        entry_price: raw.entry_price ?? null,
        entry_quantity: raw.entry_quantity ?? null,
        nearest_support: raw.nearest_support ?? null,
        r1: raw.r1 ?? null,
        r2: raw.r2 ?? null,
        r3: raw.r3 ?? null,
      } as PortfolioStock;
    });
    list.sort((a, b) => a.ticker.localeCompare(b.ticker));
    setPortfolioStocks((p) => ({ ...p, [division]: list }));
    return list;
  }

  function handlePortfolioTabOpen(division: PortfolioDivision) {
    if (portfolioLoaded[division]) return;
    setPortfolioLoaded((p) => ({ ...p, [division]: true }));
    setPortfolioLoading((p) => ({ ...p, [division]: true }));
    loadPortfolioDivision(division).then((list) => {
      setPortfolioLoading((p) => ({ ...p, [division]: false }));
      if (list.length === 0) return;
      const tickers = list.map((s) => s.ticker);
      fetch(`/api/prices?tickers=${tickers.join(",")}`)
        .then((r) => r.json())
        .then((d) => {
          setPortfolioPrices((p) => ({ ...p, ...(d.prices ?? {}) }));
          setPortfolioPrevCloses((p) => ({ ...p, ...(d.previousCloses ?? {}) }));
        })
        .catch(() => {});
    });
  }

  async function handleAddPortfolioTicker(division: PortfolioDivision, e: React.FormEvent) {
    e.preventDefault();
    const sym = portfolioAddTicker[division].trim().toUpperCase();
    if (!sym) return;
    if (portfolioStocks[division].some((s) => s.ticker === sym)) {
      setPortfolioAddError((p) => ({ ...p, [division]: `${sym} is already in this division.` }));
      return;
    }
    setPortfolioAddLoading((p) => ({ ...p, [division]: true }));
    setPortfolioAddError((p) => ({ ...p, [division]: "" }));
    try {
      const res = await fetch(`/api/fundamentals?ticker=${sym}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch data");

      const entry: PortfolioStock = {
        ticker: sym,
        name: data.name ?? null,
        industry: data.industry ?? data.sector ?? null,
        entry_price: null,
        entry_quantity: null,
      };
      await savePortfolioDivisionStock(division, sym, { name: entry.name, industry: entry.industry, added_at: new Date().toISOString() });
      setPortfolioStocks((p) => ({
        ...p,
        [division]: [...p[division].filter((s) => s.ticker !== sym), entry].sort((a, b) => a.ticker.localeCompare(b.ticker)),
      }));
      if (data.price != null) setPortfolioPrices((p) => ({ ...p, [sym]: data.price }));
      fetch(`/api/prices?tickers=${sym}`)
        .then((r) => r.json())
        .then((d) => setPortfolioPrevCloses((p) => ({ ...p, ...(d.previousCloses ?? {}) })))
        .catch(() => {});
      setPortfolioAddTicker((p) => ({ ...p, [division]: "" }));
    } catch (err) {
      setPortfolioAddError((p) => ({ ...p, [division]: err instanceof Error ? err.message : "Unknown error" }));
    } finally {
      setPortfolioAddLoading((p) => ({ ...p, [division]: false }));
    }
  }

  async function handleRemovePortfolioTicker(division: PortfolioDivision, ticker: string) {
    await removePortfolioDivisionStock(division, ticker);
    setPortfolioStocks((p) => ({ ...p, [division]: p[division].filter((s) => s.ticker !== ticker) }));
  }

  async function handlePortfolioEntryChange(
    division: PortfolioDivision,
    ticker: string,
    field: "entry_price" | "entry_quantity",
    value: number | null
  ) {
    setPortfolioStocks((p) => ({
      ...p,
      [division]: p[division].map((s) => (s.ticker === ticker ? { ...s, [field]: value } : s)),
    }));
    await updatePortfolioDivisionEntry(division, ticker, { [field]: value }).catch(() => {});
  }

  async function handlePortfolioLevelChange(
    division: PortfolioDivision,
    ticker: string,
    field: PortfolioLevelField,
    value: number | null
  ) {
    setPortfolioStocks((p) => ({
      ...p,
      [division]: p[division].map((s) => (s.ticker === ticker ? { ...s, [field]: value } : s)),
    }));
    await updatePortfolioDivisionEntry(division, ticker, { [field]: value }).catch(() => {});
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
    const list = Object.entries(data).map(([ticker, d]) => ({ ...(d as object), ticker } as CustomStock));
    list.sort((a, b) => a.ticker.localeCompare(b.ticker));
    setCustomStocks(list);
    return list;
  }

  async function loadIhsgCustomStocks() {
    const data = await getIhsgCustomStocks().catch(() => ({}));
    const list = Object.entries(data).map(([ticker, d]) => ({ ...(d as object), ticker } as CustomStock));
    list.sort((a, b) => a.ticker.localeCompare(b.ticker));
    setIhsgCustomStocks(list);
    return list;
  }

  useEffect(() => {
    const seedTickers = SEED_STOCKS.map((s) => s.ticker).join(",");

    fetch(`/api/prices?tickers=${seedTickers}`)
      .then((r) => r.json())
      .then((d) => {
        setPrices((p) => ({ ...p, ...(d.prices ?? {}) }));
        setPreMarketPrices((p) => ({ ...p, ...(d.preMarketPrices ?? {}) }));
      })
      .catch(() => {})
      .finally(() => setPricesLoading(false));

    fetch(`/api/ema?tickers=${seedTickers}`)
      .then((r) => r.json())
      .then((d) => {
        setAtrs((prev) => ({ ...prev, ...(d.atrPct ?? {}) }));
        setEma20s((prev) => ({ ...prev, ...(d.ema20 ?? {}) }));
        setEma50s((prev) => ({ ...prev, ...(d.ema50 ?? {}) }));
        setGoldenCrossDates((prev) => ({ ...prev, ...(d.goldenCrossDate ?? {}) }));
        setSupportLows((prev) => ({ ...prev, ...(d.supportLow ?? {}) }));
        setRsis((prev) => ({ ...prev, ...(d.rsi ?? {}) }));
        setDiPluses((prev) => ({ ...prev, ...(d.diPlus ?? {}) }));
        setDiMinuses((prev) => ({ ...prev, ...(d.diMinus ?? {}) }));
        setAdxs((prev) => ({ ...prev, ...(d.adx ?? {}) }));
        setCmfs((prev) => ({ ...prev, ...(d.cmf ?? {}) }));
      })
      .catch(() => {});

    fetch(`/api/macd?tickers=${seedTickers}`)
      .then((r) => r.json())
      .then((d) => {
        setMacds((prev) => ({ ...prev, ...(d.macd ?? {}) }));
        setMacdSignals((prev) => ({ ...prev, ...(d.signal ?? {}) }));
        setMacdHists((prev) => ({ ...prev, ...(d.histogram ?? {}) }));
        setMacdHistDirs((prev) => ({ ...prev, ...(d.histDirection ?? {}) }));
      })
      .catch(() => {});

    fetch(`/api/funddata?tickers=${seedTickers}`)
      .then((r) => r.json())
      .then((d) => setFundData((prev) => ({ ...prev, ...(d.data ?? {}) })))
      .catch(() => {});

    fetch(`/api/earnings?tickers=${seedTickers}`)
      .then((r) => r.json())
      .then((d) => setEarnings((prev) => ({ ...prev, ...(d.earnings ?? {}) })))
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
          .then((d) => {
            setPrices((p) => ({ ...p, ...(d.prices ?? {}) }));
            setPreMarketPrices((p) => ({ ...p, ...(d.preMarketPrices ?? {}) }));
          })
          .catch(() => {});
        fetch(`/api/funddata?tickers=${tickers}`)
          .then((r) => r.json())
          .then((d) => setFundData((prev) => ({ ...prev, ...(d.data ?? {}) })))
          .catch(() => {});
        fetch(`/api/earnings?tickers=${tickers}`)
          .then((r) => r.json())
          .then((d) => setEarnings((prev) => ({ ...prev, ...(d.earnings ?? {}) })))
          .catch(() => {});
        fetch(`/api/ema?tickers=${tickers}`)
          .then((r) => r.json())
          .then((d) => {
            setAtrs((prev) => ({ ...prev, ...(d.atrPct ?? {}) }));
            setEma20s((prev) => ({ ...prev, ...(d.ema20 ?? {}) }));
            setEma50s((prev) => ({ ...prev, ...(d.ema50 ?? {}) }));
            setGoldenCrossDates((prev) => ({ ...prev, ...(d.goldenCrossDate ?? {}) }));
            setSupportLows((prev) => ({ ...prev, ...(d.supportLow ?? {}) }));
            setRsis((prev) => ({ ...prev, ...(d.rsi ?? {}) }));
            setDiPluses((prev) => ({ ...prev, ...(d.diPlus ?? {}) }));
            setDiMinuses((prev) => ({ ...prev, ...(d.diMinus ?? {}) }));
            setAdxs((prev) => ({ ...prev, ...(d.adx ?? {}) }));
            setCmfs((prev) => ({ ...prev, ...(d.cmf ?? {}) }));
          })
          .catch(() => {});
        fetch(`/api/macd?tickers=${tickers}`)
          .then((r) => r.json())
          .then((d) => {
            setMacds((prev) => ({ ...prev, ...(d.macd ?? {}) }));
            setMacdSignals((prev) => ({ ...prev, ...(d.signal ?? {}) }));
            setMacdHists((prev) => ({ ...prev, ...(d.histogram ?? {}) }));
            setMacdHistDirs((prev) => ({ ...prev, ...(d.histDirection ?? {}) }));
          })
          .catch(() => {});
      }
    });

    loadSets();
    loadPeStats();

    loadIhsgCustomStocks().then((list) => {
      if (list.length === 0) return;
      const jkTickers = list.map((s) => `${s.ticker}.JK`).join(",");
      const remap = (obj: Record<string, unknown>) => {
        const out: Record<string, number | null> = {};
        for (const [k, v] of Object.entries(obj)) out[k.replace(".JK", "")] = v as number | null;
        return out;
      };
      fetch(`/api/prices?tickers=${jkTickers}`)
        .then((r) => r.json())
        .then((d) => {
          const prices: Record<string, number | null> = {};
          for (const [k, v] of Object.entries(d.prices ?? {})) prices[k.replace(".JK", "")] = v as number | null;
          setIhsgPrices((p) => ({ ...p, ...prices }));
        }).catch(() => {});
      fetch(`/api/ema?tickers=${jkTickers}`)
        .then((r) => r.json())
        .then((d) => {
          setIhsgAtrs((p) => ({ ...p, ...remap(d.atrPct ?? {}) }));
          setIhsgEma20s((p) => ({ ...p, ...remap(d.ema20 ?? {}) }));
          setIhsgEma50s((p) => ({ ...p, ...remap(d.ema50 ?? {}) }));
          setIhsgSupportLows((p) => ({ ...p, ...remap(d.supportLow ?? {}) }));
          setIhsgRsis((p) => ({ ...p, ...remap(d.rsi ?? {}) }));
          setIhsgDiPluses((p) => ({ ...p, ...remap(d.diPlus ?? {}) }));
          setIhsgDiMinuses((p) => ({ ...p, ...remap(d.diMinus ?? {}) }));
          setIhsgAdxs((p) => ({ ...p, ...remap(d.adx ?? {}) }));
          setIhsgCmfs((p) => ({ ...p, ...remap(d.cmf ?? {}) }));
        }).catch(() => {});
      fetch(`/api/macd?tickers=${jkTickers}`)
        .then((r) => r.json())
        .then((d) => {
          setIhsgMacds((p) => ({ ...p, ...remap(d.macd ?? {}) }));
          setIhsgMacdSignals((p) => ({ ...p, ...remap(d.signal ?? {}) }));
          setIhsgMacdHists((p) => ({ ...p, ...remap(d.histogram ?? {}) }));
          const dirOut: Record<string, "up" | "down" | "flat" | null> = {};
          for (const [k, v] of Object.entries(d.histDirection ?? {})) dirOut[k.replace(".JK", "")] = v as "up" | "down" | "flat" | null;
          setIhsgMacdHistDirs((p) => ({ ...p, ...dirOut }));
        }).catch(() => {});
      fetch(`/api/funddata?tickers=${jkTickers}`)
        .then((r) => r.json())
        .then((d) => {
          const out: Record<string, FundData> = {};
          for (const [k, v] of Object.entries(d.data ?? {})) out[k.replace(".JK", "")] = v as FundData;
          setIhsgFundData((p) => ({ ...p, ...out }));
        }).catch(() => {});
      fetch(`/api/earnings?tickers=${jkTickers}`)
        .then((r) => r.json())
        .then((d) => {
          const out: Record<string, string | null> = {};
          for (const [k, v] of Object.entries(d.earnings ?? {})) out[k.replace(".JK", "")] = v as string | null;
          setIhsgEarnings((p) => ({ ...p, ...out }));
        }).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load IHSG data when switching to IHSG tab (lazy)
  useEffect(() => {
    if (market !== "ihsg" || IHSG_STOCKS.length === 0) return;
    const tickers = IHSG_STOCKS.map((s) => s.ticker);
    const jkTickers = tickers.map((t) => `${t}.JK`).join(",");

    setIhsgPricesLoading(true);
    fetch(`/api/prices?tickers=${jkTickers}`)
      .then((r) => r.json())
      .then((d) => {
        // remap keys from BBCA.JK → BBCA
        const prices: Record<string, number | null> = {};
        for (const [k, v] of Object.entries(d.prices ?? {})) {
          prices[k.replace(".JK", "")] = v as number | null;
        }
        setIhsgPrices(prices);
      })
      .catch(() => {})
      .finally(() => setIhsgPricesLoading(false));

    fetch(`/api/ema?tickers=${jkTickers}`)
      .then((r) => r.json())
      .then((d) => {
        const remap = (obj: Record<string, unknown>) => {
          const out: Record<string, number | null> = {};
          for (const [k, v] of Object.entries(obj)) out[k.replace(".JK", "")] = v as number | null;
          return out;
        };
        setIhsgAtrs((p) => ({ ...p, ...remap(d.atrPct ?? {}) }));
        setIhsgEma20s((p) => ({ ...p, ...remap(d.ema20 ?? {}) }));
        setIhsgEma50s((p) => ({ ...p, ...remap(d.ema50 ?? {}) }));
        setIhsgSupportLows((p) => ({ ...p, ...remap(d.supportLow ?? {}) }));
        setIhsgRsis((p) => ({ ...p, ...remap(d.rsi ?? {}) }));
        setIhsgDiPluses((p) => ({ ...p, ...remap(d.diPlus ?? {}) }));
        setIhsgDiMinuses((p) => ({ ...p, ...remap(d.diMinus ?? {}) }));
        setIhsgAdxs((p) => ({ ...p, ...remap(d.adx ?? {}) }));
        setIhsgCmfs((p) => ({ ...p, ...remap(d.cmf ?? {}) }));
      })
      .catch(() => {});

    fetch(`/api/macd?tickers=${jkTickers}`)
      .then((r) => r.json())
      .then((d) => {
        const remap = (obj: Record<string, unknown>) => {
          const out: Record<string, number | null> = {};
          for (const [k, v] of Object.entries(obj)) out[k.replace(".JK", "")] = v as number | null;
          return out;
        };
        setIhsgMacds((p) => ({ ...p, ...remap(d.macd ?? {}) }));
        setIhsgMacdSignals((p) => ({ ...p, ...remap(d.signal ?? {}) }));
        setIhsgMacdHists((p) => ({ ...p, ...remap(d.histogram ?? {}) }));
        const dirOut: Record<string, "up" | "down" | "flat" | null> = {};
        for (const [k, v] of Object.entries(d.histDirection ?? {})) dirOut[k.replace(".JK", "")] = v as "up" | "down" | "flat" | null;
        setIhsgMacdHistDirs((p) => ({ ...p, ...dirOut }));
      })
      .catch(() => {});

    fetch(`/api/funddata?tickers=${jkTickers}`)
      .then((r) => r.json())
      .then((d) => {
        const out: Record<string, FundData> = {};
        for (const [k, v] of Object.entries(d.data ?? {})) out[k.replace(".JK", "")] = v as FundData;
        setIhsgFundData((p) => ({ ...p, ...out }));
      })
      .catch(() => {});

    fetch(`/api/earnings?tickers=${jkTickers}`)
      .then((r) => r.json())
      .then((d) => {
        const out: Record<string, string | null> = {};
        for (const [k, v] of Object.entries(d.earnings ?? {})) out[k.replace(".JK", "")] = v as string | null;
        setIhsgEarnings((p) => ({ ...p, ...out }));
      })
      .catch(() => {});

    Promise.all(
      tickers.map(async (ticker) => {
        const data = await loadStockData(`${ticker}.JK`).catch(() => null);
        return { ticker, verdict: data?.latest_verdict ?? null };
      })
    ).then((results) => {
      const map: Record<string, { urgency: string; setup: string } | null> = {};
      results.forEach(({ ticker, verdict }) => {
        map[ticker] = verdict ? { urgency: verdict.urgency, setup: verdict.setup } : null;
      });
      setIhsgVerdicts(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  // Fetch daily indicators (EMA20D/50D, ATR, RSI, cross info, MACD, ATR14, Bandar) for a batch
  // of swing tickers (no .JK suffix) in a single round trip — one chart fetch per ticker
  // server-side instead of four, which is what made this tab slow to (re)load.
  function fetchSwingDaily(tickersNoSuffix: string[]) {
    if (tickersNoSuffix.length === 0) return;
    const jkTickers = tickersNoSuffix.map((t) => `${t}.JK`).join(",");
    fetch(`/api/swing-daily?tickers=${jkTickers}`)
      .then((r) => r.json())
      .then((d) => {
        const remap = <T,>(obj: Record<string, T>) => {
          const out: Record<string, T> = {};
          for (const [k, v] of Object.entries(obj)) out[k.replace(".JK", "")] = v;
          return out;
        };
        setSwingDailyEma20s((p) => ({ ...p, ...remap(d.ema20 ?? {}) }));
        setSwingDailyEma50s((p) => ({ ...p, ...remap(d.ema50 ?? {}) }));
        setSwingDailyAtrs((p) => ({ ...p, ...remap(d.atrPct ?? {}) }));
        setSwingDailyRsis((p) => ({ ...p, ...remap(d.rsi ?? {}) }));
        setSwingEmaCrossAbove((p) => ({ ...p, ...remap(d.emaCrossAbove ?? {}) }));
        setSwingCrossPrice((p) => ({ ...p, ...remap(d.crossPrice ?? {}) }));
        setSwingCrossDate((p) => ({ ...p, ...remap(d.crossDate ?? {}) }));
        setSwingMacds((p) => ({ ...p, ...remap(d.macd ?? {}) }));
        setSwingMacdSignals((p) => ({ ...p, ...remap(d.signal ?? {}) }));
        setSwingMacdHists((p) => ({ ...p, ...remap(d.histogram ?? {}) }));
        setSwingMacdHistDirs((p) => ({ ...p, ...remap(d.histDirection ?? {}) }));
        setSwingAtr14((p) => ({ ...p, ...remap(d.atr ?? {}) }));
        setSwingBandar((p) => ({ ...p, ...remap(d.bandar ?? {}) }));
      })
      .catch(() => {});
  }

  async function loadSwingStocks() {
    const data = await getIhsgSwingStocks().catch(() => ({}));
    const list = Object.entries(data).map(([ticker, d]) => {
      const raw = d as { name?: string | null; industry?: string | null; entry_price?: number | null };
      return { ticker, name: raw.name ?? null, industry: raw.industry ?? null, entryPrice: raw.entry_price ?? null } as SwingStock;
    });
    list.sort((a, b) => a.ticker.localeCompare(b.ticker));
    setSwingStocks(list);
    return list;
  }

  // Load the Midterm/Swing list lazily when switching to the IHSG tab
  useEffect(() => {
    if (market !== "ihsg") return;
    setSwingLoading(true);
    loadSwingStocks().then((list) => {
      setSwingLoading(false);
      if (list.length === 0) return;
      const tickers = list.map((s) => s.ticker);
      const jkTickers = tickers.map((t) => `${t}.JK`).join(",");
      fetch(`/api/prices?tickers=${jkTickers}`)
        .then((r) => r.json())
        .then((d) => {
          const prices: Record<string, number | null> = {};
          for (const [k, v] of Object.entries(d.prices ?? {})) prices[k.replace(".JK", "")] = v as number | null;
          setSwingPrices((p) => ({ ...p, ...prices }));
        }).catch(() => {});
      fetchSwingDaily(tickers);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  async function handleAddSwingTicker(e: React.FormEvent) {
    e.preventDefault();
    const sym = swingAddTicker.trim().toUpperCase();
    if (!sym) return;
    if (swingStocks.some((s) => s.ticker === sym)) {
      setSwingAddError(`${sym} is already in the Midterm/Swing list.`);
      return;
    }
    setSwingAddLoading(true);
    setSwingAddError("");
    try {
      const res = await fetch(`/api/fundamentals?ticker=${sym}.JK`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch data");

      const entry: SwingStock = { ticker: sym, name: data.name ?? null, industry: data.industry ?? data.sector ?? null };
      await saveIhsgSwingStock(sym, { name: entry.name, industry: entry.industry, added_at: new Date().toISOString() });
      setSwingStocks((prev) => [...prev.filter((s) => s.ticker !== sym), entry].sort((a, b) => a.ticker.localeCompare(b.ticker)));
      if (data.price != null) setSwingPrices((p) => ({ ...p, [sym]: data.price }));
      fetchSwingDaily([sym]);
      setSwingAddTicker("");
    } catch (err) {
      setSwingAddError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSwingAddLoading(false);
    }
  }

  async function handleRemoveSwingTicker(ticker: string) {
    await removeIhsgSwingStock(ticker);
    setSwingStocks((prev) => prev.filter((s) => s.ticker !== ticker));
  }

  async function handleSwingEntryPriceChange(ticker: string, value: number | null) {
    setSwingStocks((prev) => prev.map((s) => (s.ticker === ticker ? { ...s, entryPrice: value } : s)));
    await updateIhsgSwingEntryPrice(ticker, value).catch(() => {});
  }

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
    const apiSym = market === "ihsg" ? `${sym}.JK` : sym;
    if (SEED_TICKERS.has(sym) || IHSG_TICKERS.has(sym)) {
      setAddError(`${sym} is already in the master table.`);
      return;
    }
    setAddLoading(true);
    setAddError("");
    try {
      const res = await fetch(`/api/fundamentals?ticker=${apiSym}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch data");

      const entry: CustomStock = {
        ...data,
        ticker: sym, // always use display ticker (no .JK) so state lookups work
        added_at: new Date().toISOString(),
        last_fetched: new Date().toISOString(),
      };
      if (isIhsg) {
        await saveIhsgCustomStock(sym, entry);
        setIhsgCustomStocks((prev) => {
          const without = prev.filter((s) => s.ticker !== sym);
          return [...without, entry].sort((a, b) => a.ticker.localeCompare(b.ticker));
        });
        if (data.price != null) setIhsgPrices((p) => ({ ...p, [sym]: data.price }));
        fetch(`/api/funddata?tickers=${apiSym}`)
          .then((r) => r.json())
          .then((d) => {
            const out: Record<string, FundData> = {};
            for (const [k, v] of Object.entries(d.data ?? {})) out[k.replace(".JK", "")] = v as FundData;
            setIhsgFundData((prev) => ({ ...prev, ...out }));
          }).catch(() => {});
        fetch(`/api/ema?tickers=${apiSym}`)
          .then((r) => r.json())
          .then((d) => {
            const remap = (obj: Record<string, unknown>) => {
              const out: Record<string, number | null> = {};
              for (const [k, v] of Object.entries(obj)) out[k.replace(".JK", "")] = v as number | null;
              return out;
            };
            setIhsgAtrs((prev) => ({ ...prev, ...remap(d.atrPct ?? {}) }));
            setIhsgEma20s((prev) => ({ ...prev, ...remap(d.ema20 ?? {}) }));
            setIhsgEma50s((prev) => ({ ...prev, ...remap(d.ema50 ?? {}) }));
            setIhsgSupportLows((prev) => ({ ...prev, ...remap(d.supportLow ?? {}) }));
            setIhsgRsis((prev) => ({ ...prev, ...remap(d.rsi ?? {}) }));
            setIhsgDiPluses((prev) => ({ ...prev, ...remap(d.diPlus ?? {}) }));
            setIhsgDiMinuses((prev) => ({ ...prev, ...remap(d.diMinus ?? {}) }));
            setIhsgAdxs((prev) => ({ ...prev, ...remap(d.adx ?? {}) }));
            setIhsgCmfs((prev) => ({ ...prev, ...remap(d.cmf ?? {}) }));
          }).catch(() => {});
      } else {
        await saveCustomStock(sym, entry);
        setCustomStocks((prev) => {
          const without = prev.filter((s) => s.ticker !== sym);
          return [...without, entry].sort((a, b) => a.ticker.localeCompare(b.ticker));
        });
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
            setGoldenCrossDates((prev) => ({ ...prev, ...(d.goldenCrossDate ?? {}) }));
            setSupportLows((prev) => ({ ...prev, ...(d.supportLow ?? {}) }));
            setRsis((prev) => ({ ...prev, ...(d.rsi ?? {}) }));
            setDiPluses((prev) => ({ ...prev, ...(d.diPlus ?? {}) }));
            setDiMinuses((prev) => ({ ...prev, ...(d.diMinus ?? {}) }));
            setAdxs((prev) => ({ ...prev, ...(d.adx ?? {}) }));
            setCmfs((prev) => ({ ...prev, ...(d.cmf ?? {}) }));
          }).catch(() => {});
      }
      setAddTicker("");
      setShowAdd(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemoveCustom(ticker: string) {
    if (!confirm(`Remove ${ticker} from the master table?`)) return;
    try {
      if (isIhsg) {
        await removeIhsgCustomStock(ticker);
        setIhsgCustomStocks((prev) => prev.filter((s) => s.ticker !== ticker));
      } else {
        await removeCustomStock(ticker);
        setCustomStocks((prev) => prev.filter((s) => s.ticker !== ticker));
      }
    } catch (err) {
      console.error(`Failed to remove ${ticker}:`, err);
      alert(`Failed to remove ${ticker}: ${err instanceof Error ? err.message : "Unknown error"}`);
      return;
    }
    await removePortfolioEntry(ticker).catch((err) => console.error(`Failed to remove ${ticker} from portfolio:`, err));
    await removeWatchlistEntry(ticker).catch((err) => console.error(`Failed to remove ${ticker} from watchlist:`, err));
    await loadSets();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const sym = inputTicker.trim().toUpperCase();
    if (sym) router.push(`/stock/${market === "ihsg" ? `${sym}.JK` : sym}`);
  }

  const isIhsg = market === "ihsg";

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 sm:p-6">
      <div className="max-w-screen-xl mx-auto space-y-5">
        {/* Top-level market switcher */}
        <div className="segmented w-fit">
          <button
            onClick={() => setMarket("us")}
            className={`segmented-btn ${market === "us" ? "is-active" : ""}`}
          >
            🇺🇸 US Stocks
          </button>
          <button
            onClick={() => setMarket("ihsg")}
            className={`segmented-btn ${market === "ihsg" ? "is-active" : ""}`}
          >
            🇮🇩 IHSG
          </button>
        </div>

        <div className="surface-card p-4 sm:p-5 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {isIhsg ? "IHSG Analysis" : "Stock Analysis"}
            </h1>
            <p className="text-[var(--muted)] text-xs mt-0.5">
              {isIhsg
                ? `${IHSG_STOCKS.length} stocks · Weekly framework · AI verdicts`
                : `${54 + customStocks.length} stocks · Weekly framework · AI verdicts`}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex gap-2 flex-wrap items-center">
              {!isIhsg && (
                <button
                  onClick={handleRefreshPeStats}
                  disabled={peRefreshing}
                  className="btn btn-ghost"
                  title="Recompute 5Y P/E z-score for all stocks from SEC EDGAR + Yahoo Finance"
                >
                  {peRefreshing ? `Refreshing P/E… ${peProgress}` : "Refresh P/E Z-Scores"}
                </button>
              )}
              <button
                onClick={() => { setShowAdd(true); setAddError(""); }}
                className="btn btn-secondary"
              >
                + Add Stock
              </button>
            </div>
            <div className="w-px self-stretch bg-[var(--border)] hidden sm:block" />
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={inputTicker}
                onChange={(e) => setInputTicker(e.target.value)}
                placeholder={isIhsg ? "e.g. BBCA" : "Analyze ticker…"}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                className="input-field w-36 sm:w-40 uppercase"
              />
              <button
                type="submit"
                className="btn btn-primary"
              >
                Analyze →
              </button>
            </form>
          </div>
        </div>

        {showAdd && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-[2px]">
            <form
              onSubmit={handleAddStock}
              className="surface-card p-6 w-full max-w-sm space-y-4 shadow-[var(--shadow-md)]"
            >
              <div>
                <h2 className="font-bold text-lg">Add Stock to Master Table</h2>
                <p className="text-xs text-[var(--muted)] mt-1">Fetches fundamentals + valuation live from Yahoo Finance</p>
              </div>
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">Ticker Symbol</label>
                <input
                  required
                  autoFocus
                  value={addTicker}
                  onChange={(e) => { setAddTicker(e.target.value); setAddError(""); }}
                  placeholder="e.g. TSLA"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  className="input-field w-full font-mono tracking-wider uppercase"
                />
              </div>
              {addError && <p className="text-red-500 text-xs">{addError}</p>}
              {addLoading && <p className="text-[var(--accent)] text-xs animate-pulse">Fetching data from Yahoo Finance…</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="btn btn-primary flex-1 py-2"
                >
                  {addLoading ? "Fetching…" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setAddError(""); setAddTicker(""); }}
                  className="btn btn-ghost flex-1 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {isIhsg ? (
          <MasterTable
            market="ihsg"
            prices={ihsgPrices}
            preMarketPrices={{}}
            verdicts={ihsgVerdicts}
            atrs={ihsgAtrs}
            ema20s={ihsgEma20s}
            ema50s={ihsgEma50s}
            supportLows={ihsgSupportLows}
            rsis={ihsgRsis}
            diPluses={ihsgDiPluses}
            diMinuses={ihsgDiMinuses}
            adxs={ihsgAdxs}
            cmfs={ihsgCmfs}
            macds={ihsgMacds}
            macdSignals={ihsgMacdSignals}
            macdHists={ihsgMacdHists}
            macdHistDirs={ihsgMacdHistDirs}
            earnings={ihsgEarnings}
            fundData={ihsgFundData}
            loading={ihsgPricesLoading}
            customStocks={ihsgCustomStocks}
            portfolioSet={portfolioSet}
            watchlistSet={watchlistSet}
            markedSet={markedSet}
            onSetStatus={handleSetStatus}
            onRemoveCustom={handleRemoveCustom}
            onToggleMark={handleToggleMark}
            ihsgStocks={IHSG_STOCKS}
            swingStocks={swingStocks}
            swingPrices={swingPrices}
            swingDailyEma20s={swingDailyEma20s}
            swingDailyEma50s={swingDailyEma50s}
            swingDailyAtrs={swingDailyAtrs}
            swingDailyRsis={swingDailyRsis}
            swingEmaCrossAbove={swingEmaCrossAbove}
            swingCrossPrice={swingCrossPrice}
            swingCrossDate={swingCrossDate}
            swingMacds={swingMacds}
            swingMacdSignals={swingMacdSignals}
            swingMacdHists={swingMacdHists}
            swingMacdHistDirs={swingMacdHistDirs}
            swingAtr14={swingAtr14}
            swingBandar={swingBandar}
            swingLoading={swingLoading}
            swingAddTicker={swingAddTicker}
            swingAddLoading={swingAddLoading}
            swingAddError={swingAddError}
            onSwingAddTickerChange={setSwingAddTicker}
            onSwingAdd={handleAddSwingTicker}
            onSwingRemove={handleRemoveSwingTicker}
            onSwingEntryPriceChange={handleSwingEntryPriceChange}
          />
        ) : (
          <MasterTable
            market="us"
            prices={prices}
            preMarketPrices={preMarketPrices}
            verdicts={verdicts}
            atrs={atrs}
            ema20s={ema20s}
            ema50s={ema50s}
            goldenCrossDates={goldenCrossDates}
            supportLows={supportLows}
            rsis={rsis}
            diPluses={diPluses}
            diMinuses={diMinuses}
            adxs={adxs}
            cmfs={cmfs}
            macds={macds}
            macdSignals={macdSignals}
            macdHists={macdHists}
            macdHistDirs={macdHistDirs}
            earnings={earnings}
            fundData={fundData}
            peStats={peStats}
            loading={pricesLoading}
            customStocks={customStocks}
            portfolioSet={portfolioSet}
            watchlistSet={watchlistSet}
            markedSet={markedSet}
            onSetStatus={handleSetStatus}
            onRemoveCustom={handleRemoveCustom}
            onToggleMark={handleToggleMark}
            usSwingStocks={usSwingStocks}
            usSwingPrices={usSwingPrices}
            usSwingPrevCloses={usSwingPrevCloses}
            usSwingAtrs={usSwingAtrs}
            usSwingEma20s={usSwingEma20s}
            usSwingEma50s={usSwingEma50s}
            usSwingGoldenCrossDates={usSwingGoldenCrossDates}
            usSwingMacds={usSwingMacds}
            usSwingRoc14s={usSwingRoc14s}
            usSwingRoc63s={usSwingRoc63s}
            usSwingRoc90s={usSwingRoc90s}
            usSwingSortinos={usSwingSortinos}
            usSwingSortino6mos={usSwingSortino6mos}
            usSwingRsis={usSwingRsis}
            usSwingDiPluses={usSwingDiPluses}
            usSwingDiMinuses={usSwingDiMinuses}
            usSwingAdxs={usSwingAdxs}
            usSwingLow6mos={usSwingLow6mos}
            usSwingResistances={usSwingResistances}
            usSwingDaysSinceResistances={usSwingDaysSinceResistances}
            usSwingHigh5yrs={usSwingHigh5yrs}
            usSwingDistHigh5yrs={usSwingDistHigh5yrs}
            usSwingDaysSinceHigh5yrs={usSwingDaysSinceHigh5yrs}
            usSwingLow1yrs={usSwingLow1yrs}
            usSwingDistLow1yrs={usSwingDistLow1yrs}
            usSwingDaysSinceLow1yrs={usSwingDaysSinceLow1yrs}
            usSwingRelVolumes={usSwingRelVolumes}
            usSwingShortFloats={usSwingShortFloats}
            usSwingAdvs={usSwingAdvs}
            usSwingEarnings={usSwingEarnings}
            usSwingLoading={usSwingLoading}
            onUsSwingTabOpen={handleUsSwingTabOpen}
            usSwingAddTicker={usSwingAddTicker}
            usSwingAddLoading={usSwingAddLoading}
            usSwingAddError={usSwingAddError}
            onUsSwingAddTickerChange={setUsSwingAddTicker}
            onUsSwingAdd={handleAddUsSwingTicker}
            onUsSwingRemove={handleRemoveUsSwingTicker}
            onUsSwingToggleStar={handleToggleUsSwingStar}
            onUsSwingTogglePortfolio={handleToggleUsSwingPortfolio}
            usBreakoutStocks={usBreakoutStocks}
            usBreakoutPrices={usBreakoutPrices}
            usBreakoutData={usBreakoutData}
            usBreakoutShortFloats={usBreakoutShortFloats}
            usBreakoutAdvs={usBreakoutAdvs}
            usBreakoutEarnings={usBreakoutEarnings}
            usBreakoutLoading={usBreakoutLoading}
            onUsBreakoutTabOpen={handleUsBreakoutTabOpen}
            usBreakoutAddTicker={usBreakoutAddTicker}
            usBreakoutAddLoading={usBreakoutAddLoading}
            usBreakoutAddError={usBreakoutAddError}
            onUsBreakoutAddTickerChange={setUsBreakoutAddTicker}
            onUsBreakoutAdd={handleAddUsBreakoutTicker}
            onUsBreakoutRemove={handleRemoveUsBreakoutTicker}
            onUsBreakoutToggleStar={handleToggleUsBreakoutStar}
            portfolioStocks={portfolioStocks}
            portfolioPrices={portfolioPrices}
            portfolioPrevCloses={portfolioPrevCloses}
            portfolioLoading={portfolioLoading}
            onPortfolioTabOpen={handlePortfolioTabOpen}
            portfolioAddTicker={portfolioAddTicker}
            portfolioAddLoading={portfolioAddLoading}
            portfolioAddError={portfolioAddError}
            onPortfolioAddTickerChange={(division, v) => setPortfolioAddTicker((p) => ({ ...p, [division]: v }))}
            onPortfolioAdd={handleAddPortfolioTicker}
            onPortfolioRemove={handleRemovePortfolioTicker}
            onPortfolioEntryChange={handlePortfolioEntryChange}
            onPortfolioLevelChange={handlePortfolioLevelChange}
          />
        )}
      </div>
    </main>
  );
}
