// Instrument catalog for the Global Markets dashboard — the single source of truth
// for every symbol, unit, and display precision on /markets. Symbols and units were
// verified against the Yahoo Finance provider (yahoo-finance2) before inclusion.
//
// Deliberately omitted (verified unreliable from this provider — do not re-add
// without re-verifying):
//   - US 2-year Treasury yield: ^TWO has been stale since 2015; 2YY=F fails Yahoo
//     schema validation with ~zero volume. The 2Y–10Y spread is therefore unavailable.
//   - MOVE index: ^MOVE on Yahoo resolves to an unrelated Northern Trust iBoxx
//     5-Year Target Duration instrument, not the ICE MOVE index.
//   - Aluminum / iron ore / nickel / zinc: no verified Yahoo symbols with clear units.

import type { InstrumentDefinition, MarketCategory } from "./types";

export const MARKET_INSTRUMENTS: InstrumentDefinition[] = [
  // --- US equities ---
  { id: "sp500", symbol: "^GSPC", name: "S&P 500", shortName: "S&P 500", category: "us-equities", instrumentType: "index", currency: "USD", unit: "Index points", decimals: 2 },
  { id: "nasdaq", symbol: "^IXIC", name: "Nasdaq Composite", shortName: "Nasdaq", category: "us-equities", instrumentType: "index", currency: "USD", unit: "Index points", decimals: 2 },
  { id: "dow", symbol: "^DJI", name: "Dow Jones Industrial Average", shortName: "Dow Jones", category: "us-equities", instrumentType: "index", currency: "USD", unit: "Index points", decimals: 2 },
  { id: "russell2000", symbol: "^RUT", name: "Russell 2000", shortName: "Russell 2000", category: "us-equities", instrumentType: "index", currency: "USD", unit: "Index points", decimals: 2 },

  // --- Volatility & credit ---
  { id: "vix", symbol: "^VIX", name: "CBOE Volatility Index", shortName: "VIX", category: "volatility", instrumentType: "index", currency: "USD", unit: "Implied volatility (%)", decimals: 2 },
  { id: "hyg", symbol: "HYG", name: "iShares iBoxx $ High Yield Corporate Bond ETF", shortName: "High Yield (HYG)", category: "credit", instrumentType: "etf", currency: "USD", unit: "USD", decimals: 2 },
  { id: "lqd", symbol: "LQD", name: "iShares iBoxx $ Investment Grade Corporate Bond ETF", shortName: "Investment Grade (LQD)", category: "credit", instrumentType: "etf", currency: "USD", unit: "USD", decimals: 2 },

  // --- Rates (Treasury yield indices — yields, not prices) ---
  { id: "us3m", symbol: "^IRX", name: "US 3-Month Treasury Yield", shortName: "US 3M", category: "rates", instrumentType: "yield", currency: "USD", unit: "Yield (%)", decimals: 3 },
  { id: "us5y", symbol: "^FVX", name: "US 5-Year Treasury Yield", shortName: "US 5Y", category: "rates", instrumentType: "yield", currency: "USD", unit: "Yield (%)", decimals: 3 },
  { id: "us10y", symbol: "^TNX", name: "US 10-Year Treasury Yield", shortName: "US 10Y", category: "rates", instrumentType: "yield", currency: "USD", unit: "Yield (%)", decimals: 3 },
  { id: "us30y", symbol: "^TYX", name: "US 30-Year Treasury Yield", shortName: "US 30Y", category: "rates", instrumentType: "yield", currency: "USD", unit: "Yield (%)", decimals: 3 },

  // --- Bonds (Treasury ETF prices — prices, not yields) ---
  { id: "shy", symbol: "SHY", name: "iShares 1-3 Year Treasury Bond ETF", shortName: "Short Treasury (SHY)", category: "bonds", instrumentType: "etf", currency: "USD", unit: "USD", decimals: 2 },
  { id: "ief", symbol: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", shortName: "Intermediate Treasury (IEF)", category: "bonds", instrumentType: "etf", currency: "USD", unit: "USD", decimals: 2 },
  { id: "tlt", symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", shortName: "Long Treasury (TLT)", category: "bonds", instrumentType: "etf", currency: "USD", unit: "USD", decimals: 2 },

  // --- Energy ---
  { id: "wti", symbol: "CL=F", name: "WTI Crude Oil Futures", shortName: "WTI Crude", category: "energy", instrumentType: "future", currency: "USD", unit: "USD per barrel", decimals: 2, isFuture: true },
  { id: "brent", symbol: "BZ=F", name: "Brent Crude Oil Futures", shortName: "Brent Crude", category: "energy", instrumentType: "future", currency: "USD", unit: "USD per barrel", decimals: 2, isFuture: true },
  { id: "natgas", symbol: "NG=F", name: "Natural Gas Futures", shortName: "Natural Gas", category: "energy", instrumentType: "future", currency: "USD", unit: "USD per MMBtu", decimals: 3, isFuture: true },
  { id: "rbob", symbol: "RB=F", name: "RBOB Gasoline Futures", shortName: "RBOB Gasoline", category: "energy", instrumentType: "future", currency: "USD", unit: "USD per gallon", decimals: 4, isFuture: true },
  { id: "heating-oil", symbol: "HO=F", name: "Heating Oil Futures", shortName: "Heating Oil", category: "energy", instrumentType: "future", currency: "USD", unit: "USD per gallon", decimals: 4, isFuture: true },
  { id: "xle", symbol: "XLE", name: "Energy Select Sector SPDR Fund", shortName: "Energy Equities (XLE)", category: "energy", instrumentType: "etf", currency: "USD", unit: "USD", decimals: 2 },

  // --- Precious metals ---
  { id: "gold", symbol: "GC=F", name: "Gold Futures", shortName: "Gold", category: "precious-metals", instrumentType: "future", currency: "USD", unit: "USD per troy ounce", decimals: 2, isFuture: true },
  { id: "silver", symbol: "SI=F", name: "Silver Futures", shortName: "Silver", category: "precious-metals", instrumentType: "future", currency: "USD", unit: "USD per troy ounce", decimals: 3, isFuture: true },
  { id: "platinum", symbol: "PL=F", name: "Platinum Futures", shortName: "Platinum", category: "precious-metals", instrumentType: "future", currency: "USD", unit: "USD per troy ounce", decimals: 2, isFuture: true },
  { id: "palladium", symbol: "PA=F", name: "Palladium Futures", shortName: "Palladium", category: "precious-metals", instrumentType: "future", currency: "USD", unit: "USD per troy ounce", decimals: 2, isFuture: true },

  // --- Industrial metals ---
  { id: "copper", symbol: "HG=F", name: "Copper Futures", shortName: "Copper", category: "industrial-metals", instrumentType: "future", currency: "USD", unit: "USD per pound", decimals: 4, isFuture: true },

  // --- Agriculture (quoted in US cents) ---
  { id: "corn", symbol: "ZC=F", name: "Corn Futures", shortName: "Corn", category: "agriculture", instrumentType: "future", currency: "USC", unit: "US cents per bushel", decimals: 2, isFuture: true },
  { id: "wheat", symbol: "ZW=F", name: "Chicago SRW Wheat Futures", shortName: "Wheat", category: "agriculture", instrumentType: "future", currency: "USC", unit: "US cents per bushel", decimals: 2, isFuture: true },
  { id: "soybeans", symbol: "ZS=F", name: "Soybean Futures", shortName: "Soybeans", category: "agriculture", instrumentType: "future", currency: "USC", unit: "US cents per bushel", decimals: 2, isFuture: true },
  { id: "coffee", symbol: "KC=F", name: "Coffee Futures", shortName: "Coffee", category: "agriculture", instrumentType: "future", currency: "USC", unit: "US cents per pound", decimals: 2, isFuture: true },
  { id: "sugar", symbol: "SB=F", name: "Sugar No. 11 Futures", shortName: "Sugar", category: "agriculture", instrumentType: "future", currency: "USC", unit: "US cents per pound", decimals: 2, isFuture: true },
  { id: "cocoa", symbol: "CC=F", name: "Cocoa Futures", shortName: "Cocoa", category: "agriculture", instrumentType: "future", currency: "USD", unit: "USD per metric ton", decimals: 0, isFuture: true },
  { id: "cotton", symbol: "CT=F", name: "Cotton No. 2 Futures", shortName: "Cotton", category: "agriculture", instrumentType: "future", currency: "USC", unit: "US cents per pound", decimals: 2, isFuture: true, chartOnly: true },

  // --- Global equities ---
  { id: "ihsg", symbol: "^JKSE", name: "Indonesia Composite Index (IDX)", shortName: "IDX Composite", category: "global-equities", instrumentType: "index", currency: "IDR", unit: "Index points", decimals: 2 },
  { id: "nikkei", symbol: "^N225", name: "Japan Nikkei 225", shortName: "Nikkei 225", category: "global-equities", instrumentType: "index", currency: "JPY", unit: "Index points", decimals: 2 },
  { id: "hangseng", symbol: "^HSI", name: "Hong Kong Hang Seng Index", shortName: "Hang Seng", category: "global-equities", instrumentType: "index", currency: "HKD", unit: "Index points", decimals: 2 },
  { id: "shanghai", symbol: "000001.SS", name: "China Shanghai Composite Index", shortName: "Shanghai Composite", category: "global-equities", instrumentType: "index", currency: "CNY", unit: "Index points", decimals: 2 },
  { id: "ftse", symbol: "^FTSE", name: "UK FTSE 100", shortName: "FTSE 100", category: "global-equities", instrumentType: "index", currency: "GBP", unit: "Index points", decimals: 2 },
  { id: "dax", symbol: "^GDAXI", name: "Germany DAX", shortName: "DAX", category: "global-equities", instrumentType: "index", currency: "EUR", unit: "Index points", decimals: 2 },
  { id: "efa", symbol: "EFA", name: "iShares MSCI EAFE ETF (developed markets proxy)", shortName: "Developed Mkts (EFA)", category: "global-equities", instrumentType: "etf", currency: "USD", unit: "USD", decimals: 2 },
  { id: "eem", symbol: "EEM", name: "iShares MSCI Emerging Markets ETF", shortName: "Emerging Mkts (EEM)", category: "global-equities", instrumentType: "etf", currency: "USD", unit: "USD", decimals: 2 },

  // --- Currencies ---
  { id: "dxy", symbol: "DX-Y.NYB", name: "US Dollar Index (ICE)", shortName: "Dollar Index", category: "currencies", instrumentType: "index", currency: "USD", unit: "Index points", decimals: 3, quoteDirectionNote: "USD value against a basket of major currencies" },
  { id: "usdidr", symbol: "IDR=X", name: "USD/IDR", shortName: "USD/IDR", category: "currencies", instrumentType: "currency", currency: "IDR", unit: "IDR per USD", decimals: 0, quoteDirectionNote: "Indonesian rupiah per US dollar" },
  { id: "eurusd", symbol: "EURUSD=X", name: "EUR/USD", shortName: "EUR/USD", category: "currencies", instrumentType: "currency", currency: "USD", unit: "USD per EUR", decimals: 4, quoteDirectionNote: "US dollars per euro" },
  { id: "usdjpy", symbol: "JPY=X", name: "USD/JPY", shortName: "USD/JPY", category: "currencies", instrumentType: "currency", currency: "JPY", unit: "JPY per USD", decimals: 3, quoteDirectionNote: "Japanese yen per US dollar" },
  { id: "usdcny", symbol: "CNY=X", name: "USD/CNY", shortName: "USD/CNY", category: "currencies", instrumentType: "currency", currency: "CNY", unit: "CNY per USD", decimals: 4, quoteDirectionNote: "Chinese yuan per US dollar" },
];

export const INSTRUMENT_BY_ID: Record<string, InstrumentDefinition> = Object.fromEntries(
  MARKET_INSTRUMENTS.map((instrument) => [instrument.id, instrument])
);

export const INSTRUMENT_BY_SYMBOL: Record<string, InstrumentDefinition> = Object.fromEntries(
  MARKET_INSTRUMENTS.map((instrument) => [instrument.symbol, instrument])
);

// Instruments that count as "commodities" for the commodity-trend regime and the
// dollar-vs-commodities signal: the tradable commodity futures (excludes the XLE
// equity proxy).
export const COMMODITY_IDS = MARKET_INSTRUMENTS
  .filter((instrument) => instrument.isFuture)
  .map((instrument) => instrument.id);

// The ten headline cards shown above the fold, in display order.
export const KEY_MARKET_IDS = [
  "sp500", "vix", "us10y", "dxy", "wti", "brent", "natgas", "gold", "silver", "copper",
] as const;

export interface MarketSectionDef {
  key: string;
  title: string;
  description: string;
  categories: MarketCategory[];
}

// Detailed sections in display order. Agriculture sits below the more frequently
// used groups per the product spec.
export const MARKET_SECTIONS: MarketSectionDef[] = [
  { key: "energy", title: "Energy Commodities", description: "Crude, refined products, natural gas, and an energy equities proxy", categories: ["energy"] },
  { key: "precious-metals", title: "Precious Metals", description: "Gold, silver, platinum, and palladium futures", categories: ["precious-metals"] },
  { key: "industrial-metals", title: "Industrial Metals", description: "Copper futures — a growth-sensitive industrial metal", categories: ["industrial-metals"] },
  { key: "agriculture", title: "Agriculture", description: "Grains, softs, and fiber futures (US cents unless noted)", categories: ["agriculture"] },
  { key: "rates-bonds", title: "Rates & Bonds", description: "Treasury yield indices (yields, %) and Treasury ETFs (prices, USD)", categories: ["rates", "bonds"] },
  { key: "volatility-credit", title: "Volatility & Credit", description: "Equity volatility and corporate bond risk appetite", categories: ["volatility", "credit"] },
  { key: "us-equities", title: "US Equities", description: "Major US equity indices", categories: ["us-equities"] },
  { key: "global-equities", title: "Global Equities", description: "Major global indices and developed/emerging market proxies", categories: ["global-equities"] },
  { key: "currencies", title: "Currencies", description: "US Dollar Index and major USD pairs", categories: ["currencies"] },
];

export function instrumentsForSection(section: MarketSectionDef): InstrumentDefinition[] {
  return MARKET_INSTRUMENTS.filter((instrument) => section.categories.includes(instrument.category));
}
