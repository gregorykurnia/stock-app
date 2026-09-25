"use client";

import { useEffect, useState, type FormEvent } from "react";
import PortfolioTable, { PORTFOLIO_DIVISIONS, type PortfolioStock } from "@/components/PortfolioTable";
import {
  getPortfolioDivisionStocks,
  savePortfolioDivisionStock,
  removePortfolioDivisionStock,
  updatePortfolioDivisionEntry,
  type PortfolioDivision,
} from "@/lib/firestore";

const EMPTY_STOCKS: Record<PortfolioDivision, PortfolioStock[]> = { longterm: [], index: [], treasury: [] };
const EMPTY_FLAGS: Record<PortfolioDivision, boolean> = { longterm: false, index: false, treasury: false };
const EMPTY_TEXT: Record<PortfolioDivision, string> = { longterm: "", index: "", treasury: "" };

export default function PortfolioDashboard() {
  const [division, setDivision] = useState<PortfolioDivision>("longterm");
  const [stocks, setStocks] = useState(EMPTY_STOCKS);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [prevCloses, setPrevCloses] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(EMPTY_FLAGS);
  const [addTicker, setAddTicker] = useState(EMPTY_TEXT);
  const [addLoading, setAddLoading] = useState(EMPTY_FLAGS);
  const [addError, setAddError] = useState(EMPTY_TEXT);

  useEffect(() => {
    let cancelled = false;
    setLoading((current) => ({ ...current, [division]: true }));

    void getPortfolioDivisionStocks(division)
      .catch(() => ({}))
      .then((data) => {
        const list = Object.entries(data).map(([ticker, value]) => {
          const raw = value as { name?: string | null; industry?: string | null; entry_price?: number | null; entry_quantity?: number | null };
          return {
            ticker,
            name: raw.name ?? null,
            industry: raw.industry ?? null,
            entry_price: raw.entry_price ?? null,
            entry_quantity: raw.entry_quantity ?? null,
          } satisfies PortfolioStock;
        }).sort((a, b) => a.ticker.localeCompare(b.ticker));
        if (cancelled) return;
        setStocks((current) => ({ ...current, [division]: list }));
        setLoading((current) => ({ ...current, [division]: false }));
        if (list.length) {
          return fetch(`/api/prices?tickers=${list.map((stock) => stock.ticker).join(",")}`)
            .then((response) => response.json())
            .then((data) => {
              if (cancelled) return;
              setPrices((current) => ({ ...current, ...(data.prices ?? {}) }));
              setPrevCloses((current) => ({ ...current, ...(data.previousCloses ?? {}) }));
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setLoading((current) => ({ ...current, [division]: false }));
      });

    return () => { cancelled = true; };
  }, [division]);

  async function addStock(event: FormEvent) {
    event.preventDefault();
    const ticker = addTicker[division].trim().toUpperCase();
    if (!ticker) return;
    if (stocks[division].some((stock) => stock.ticker === ticker)) {
      setAddError((current) => ({ ...current, [division]: `${ticker} is already in this division.` }));
      return;
    }

    setAddLoading((current) => ({ ...current, [division]: true }));
    setAddError((current) => ({ ...current, [division]: "" }));
    try {
      const response = await fetch(`/api/fundamentals?ticker=${ticker}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to fetch data");

      const entry: PortfolioStock = {
        ticker,
        name: data.name ?? null,
        industry: data.industry ?? data.sector ?? null,
        entry_price: null,
        entry_quantity: null,
      };
      await savePortfolioDivisionStock(division, ticker, {
        name: entry.name,
        industry: entry.industry,
        added_at: new Date().toISOString(),
      });
      setStocks((current) => ({
        ...current,
        [division]: [...current[division].filter((stock) => stock.ticker !== ticker), entry].sort((a, b) => a.ticker.localeCompare(b.ticker)),
      }));
      if (data.price != null) setPrices((current) => ({ ...current, [ticker]: data.price }));
      void fetch(`/api/prices?tickers=${ticker}`)
        .then((result) => result.json())
        .then((result) => setPrevCloses((current) => ({ ...current, ...(result.previousCloses ?? {}) })))
        .catch(() => {});
      setAddTicker((current) => ({ ...current, [division]: "" }));
    } catch (error) {
      setAddError((current) => ({ ...current, [division]: error instanceof Error ? error.message : "Unknown error" }));
    } finally {
      setAddLoading((current) => ({ ...current, [division]: false }));
    }
  }

  async function removeStock(ticker: string) {
    await removePortfolioDivisionStock(division, ticker);
    setStocks((current) => ({ ...current, [division]: current[division].filter((stock) => stock.ticker !== ticker) }));
  }

  async function updateEntry(ticker: string, field: "entry_price" | "entry_quantity", value: number | null) {
    setStocks((current) => ({
      ...current,
      [division]: current[division].map((stock) => stock.ticker === ticker ? { ...stock, [field]: value } : stock),
    }));
    await updatePortfolioDivisionEntry(division, ticker, { [field]: value }).catch(() => {});
  }

  return (
    <main className="mx-auto w-full max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Holdings</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Portfolio</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-500">Manage your long term, index, and treasury holdings.</p>
      </header>
      <div className="space-y-3">
        <div className="flex gap-1 border-b border-gray-200">
          {PORTFOLIO_DIVISIONS.map((item) => (
            <button
              key={item.id}
              onClick={() => setDivision(item.id)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px ${division === item.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <PortfolioTable
          division={division}
          stocks={stocks[division]}
          prices={prices}
          prevCloses={prevCloses}
          loading={loading[division]}
          addTicker={addTicker[division]}
          addLoading={addLoading[division]}
          addError={addError[division]}
          onAddTickerChange={(value) => setAddTicker((current) => ({ ...current, [division]: value }))}
          onAdd={addStock}
          onRemove={removeStock}
          onEntryChange={updateEntry}
        />
      </div>
    </main>
  );
}
