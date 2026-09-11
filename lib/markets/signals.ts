// Cross-market signals for /markets — derived comparisons between instruments.
//
// Every signal is a deterministic, formula-based comparison computed from the
// instrument snapshot (price + period returns). Past ratio values are
// reconstructed exactly from each leg's price and period return, so no extra
// history has to be shipped to the client. Interpretations are factual
// coincidences ("consistent with"), never causal claims.

import { COMMODITY_IDS } from "./instruments";
import { median, priceBeforeReturn } from "./calc";
import type { MarketInstrument } from "./types";

export interface CrossMarketSignal {
  key: string;
  title: string;
  // Current value of the comparison, already formatted (e.g. "5.47", "86.2", "+2.1 pp").
  value: string | null;
  valueNote: string;   // unit / what the value means
  // Signed change over one week and one month, formatted with units (null when
  // the underlying data is missing).
  weekLabel: string | null;
  monthLabel: string | null;
  interpretation: string;
  formula: string;     // source instruments and computation, shown in expandable detail
  unavailable?: boolean;
}

type InstrumentMap = Record<string, MarketInstrument>;

function pct(value: number | null): string | null {
  return value == null || !Number.isFinite(value) ? null : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function signed(value: number | null, digits = 2, suffix = ""): string | null {
  return value == null || !Number.isFinite(value) ? null : `${value >= 0 ? "+" : ""}${value.toFixed(digits)}${suffix}`;
}

function price1mAgo(instrument: MarketInstrument | undefined): number | null {
  if (!instrument || instrument.error) return null;
  return priceBeforeReturn(instrument.price, instrument.return1m);
}

function price1wAgo(instrument: MarketInstrument | undefined): number | null {
  if (!instrument || instrument.error) return null;
  return priceBeforeReturn(instrument.price, instrument.return1w);
}

// ----------------------------------------------------------------- oil spread

function brentWtiSpread(map: InstrumentMap): CrossMarketSignal {
  const brent = map.brent;
  const wti = map.wti;
  const available = brent && wti && brent.price != null && wti.price != null && !brent.error && !wti.error;

  const brent1w = price1wAgo(brent);
  const wti1w = price1wAgo(wti);
  const brent1m = price1mAgo(brent);
  const wti1m = price1mAgo(wti);

  const spreadNow = available ? (brent.price as number) - (wti.price as number) : null;
  const spread1w = brent1w != null && wti1w != null ? brent1w - wti1w : null;
  const spread1m = brent1m != null && wti1m != null ? brent1m - wti1m : null;

  return {
    key: "brent-wti-spread",
    title: "Brent–WTI Spread",
    value: spreadNow == null ? null : `$${spreadNow.toFixed(2)}`,
    valueNote: "Brent minus WTI, USD per barrel (absolute price spread)",
    weekLabel: spread1w == null ? null : signed(spreadNow! - spread1w, 2, " $/bbl"),
    monthLabel: spread1m == null ? null : signed(spreadNow! - spread1m, 2, " $/bbl"),
    interpretation: spreadNow == null
      ? "Not enough data to compute the spread."
      : spreadNow >= 3
        ? "A wide Atlantic-basin premium is consistent with tighter non-US supply or stronger international demand versus US crude."
        : "A narrow spread is consistent with balanced US and international crude pricing.",
    formula: "Brent (BZ=F) price − WTI (CL=F) price. 1W/1M directions reconstruct each leg's prior close from its current price and period return.",
    unavailable: !available,
  };
}

// ------------------------------------------------------------- gold/silver

function goldSilverRatio(map: InstrumentMap): CrossMarketSignal {
  const gold = map.gold;
  const silver = map.silver;
  const available = gold && silver && gold.price != null && silver.price != null && !gold.error && !silver.error && (silver.price as number) !== 0;

  const gold1w = price1wAgo(gold);
  const silver1w = price1wAgo(silver);
  const gold1m = price1mAgo(gold);
  const silver1m = price1mAgo(silver);

  const ratioNow = available ? (gold.price as number) / (silver.price as number) : null;
  const ratio1w = gold1w != null && silver1w != null && silver1w !== 0 ? gold1w / silver1w : null;
  const ratio1m = gold1m != null && silver1m != null && silver1m !== 0 ? gold1m / silver1m : null;

  const weekChange = ratioNow != null && ratio1w != null && ratio1w !== 0 ? (ratioNow / ratio1w - 1) * 100 : null;
  const monthChange = ratioNow != null && ratio1m != null && ratio1m !== 0 ? (ratioNow / ratio1m - 1) * 100 : null;

  return {
    key: "gold-silver-ratio",
    title: "Gold/Silver Ratio",
    value: ratioNow == null ? null : ratioNow.toFixed(1),
    valueNote: "Gold price ÷ silver price (troy ounces of silver per ounce of gold)",
    weekLabel: pct(weekChange),
    monthLabel: pct(monthChange),
    interpretation: ratioNow == null
      ? "Not enough data to compute the ratio."
      : monthChange != null && monthChange > 1
        ? "A rising ratio is consistent with preference for monetary/safe-haven metals over industrial silver."
        : monthChange != null && monthChange < -1
          ? "A falling ratio is consistent with stronger industrial demand for silver relative to gold."
          : "A steady ratio is consistent with precious metals moving broadly together.",
    formula: "Gold (GC=F) price ÷ Silver (SI=F) price. 1W/1M are percentage changes of the ratio.",
    unavailable: !available,
  };
}

// ------------------------------------------------------------- copper/gold

function copperGoldRatio(map: InstrumentMap): CrossMarketSignal {
  const copper = map.copper;
  const gold = map.gold;
  const available = copper && gold && copper.price != null && gold.price != null && !copper.error && !gold.error;

  const copper1w = price1wAgo(copper);
  const gold1w = price1wAgo(gold);
  const copper1m = price1mAgo(copper);
  const gold1m = price1mAgo(gold);

  const ratioNow = available ? (copper.price as number) / (gold.price as number) : null;
  const ratio1w = copper1w != null && gold1w != null && gold1w !== 0 ? copper1w / gold1w : null;
  const ratio1m = copper1m != null && gold1m != null && gold1m !== 0 ? copper1m / gold1m : null;

  const weekChange = ratioNow != null && ratio1w != null && ratio1w !== 0 ? (ratioNow / ratio1w - 1) * 100 : null;
  const monthChange = ratioNow != null && ratio1m != null && ratio1m !== 0 ? (ratioNow / ratio1m - 1) * 100 : null;

  return {
    key: "copper-gold-ratio",
    title: "Copper/Gold Ratio",
    // Directional macro indicator: the absolute value mixes units ($/lb vs $/oz),
    // so the headline is the 1-month change rather than the level.
    value: pct(monthChange),
    valueNote: "1-month change in copper ÷ gold (directional macro indicator; level mixes $/lb and $/oz)",
    weekLabel: pct(weekChange),
    monthLabel: pct(monthChange),
    interpretation: monthChange == null
      ? "Not enough data to compute the ratio."
      : monthChange > 1
        ? "Copper outperforming gold is consistent with growth-friendly macro conditions."
        : monthChange < -1
          ? "Gold outperforming copper is consistent with defensive macro positioning."
          : "Copper and gold are moving broadly in line — a mixed macro read.",
    formula: "Copper (HG=F) ÷ Gold (GC=F), shown as the 1-month percentage change of the ratio (both legs reconstructed from their 1M returns).",
    unavailable: !available,
  };
}

// --------------------------------------------------------------- HYG/LQD

function hygLqdRatio(map: InstrumentMap): CrossMarketSignal {
  const hyg = map.hyg;
  const lqd = map.lqd;
  const available = hyg && lqd && hyg.price != null && lqd.price != null && !hyg.error && !lqd.error;

  const hyg1w = price1wAgo(hyg);
  const lqd1w = price1wAgo(lqd);
  const hyg1m = price1mAgo(hyg);
  const lqd1m = price1mAgo(lqd);

  const ratioNow = available ? (hyg.price as number) / (lqd.price as number) : null;
  const ratio1w = hyg1w != null && lqd1w != null && lqd1w !== 0 ? hyg1w / lqd1w : null;
  const ratio1m = hyg1m != null && lqd1m != null && lqd1m !== 0 ? hyg1m / lqd1m : null;

  const weekChange = ratioNow != null && ratio1w != null && ratio1w !== 0 ? (ratioNow / ratio1w - 1) * 100 : null;
  const monthChange = ratioNow != null && ratio1m != null && ratio1m !== 0 ? (ratioNow / ratio1m - 1) * 100 : null;

  return {
    key: "hyg-lqd-ratio",
    title: "HYG/LQD Credit Ratio",
    value: ratioNow == null ? null : `${ratioNow.toFixed(3)}`,
    valueNote: "High-yield ETF price ÷ investment-grade ETF price — relative credit-risk appetite",
    weekLabel: pct(weekChange),
    monthLabel: pct(monthChange),
    interpretation: monthChange == null
      ? "Not enough data to compute the ratio."
      : monthChange > 0.5
        ? "A rising ratio is consistent with investors reaching for credit risk."
        : monthChange < -0.5
          ? "A falling ratio is consistent with caution toward lower-grade credit."
          : "A steady ratio is consistent with unchanged credit-risk appetite.",
    formula: "HYG price ÷ LQD price. 1W/1M are percentage changes of the ratio.",
    unavailable: !available,
  };
}

// ----------------------------------------------------- Russell vs S&P (relative)

function russellVsSp500(map: InstrumentMap): CrossMarketSignal {
  const rut = map.russell2000;
  const spx = map.sp500;
  const available = rut && spx && !rut.error && !spx.error;

  const relative1m = available && rut.return1m != null && spx.return1m != null ? rut.return1m - spx.return1m : null;
  const relative1w = available && rut.return1w != null && spx.return1w != null ? rut.return1w - spx.return1w : null;

  return {
    key: "russell-vs-sp500",
    title: "Russell 2000 vs S&P 500",
    value: relative1m == null ? null : `${relative1m >= 0 ? "+" : ""}${relative1m.toFixed(1)} pp`,
    valueNote: "1-month relative performance (normalized return comparison, not index-point division)",
    weekLabel: relative1w == null ? null : `${relative1w >= 0 ? "+" : ""}${relative1w.toFixed(1)} pp`,
    monthLabel: relative1m == null ? null : `${relative1m >= 0 ? "+" : ""}${relative1m.toFixed(1)} pp`,
    interpretation: relative1m == null
      ? "Not enough data to compare the indices."
      : relative1m > 0.5
        ? "Small caps outperforming large caps is consistent with broadening risk appetite."
        : relative1m < -0.5
          ? "Small caps lagging large caps is consistent with defensive, mega-cap-led leadership."
          : "Small and large caps are performing in line.",
    formula: "Russell 2000 (^RUT) 1M return − S&P 500 (^GSPC) 1M return, in percentage points.",
    unavailable: !available,
  };
}

// ------------------------------------------------------- dollar vs commodities

function dollarVsCommodities(map: InstrumentMap): CrossMarketSignal {
  const dxy = map.dxy;
  const commodityReturns = COMMODITY_IDS
    .map((id) => map[id]?.return1m)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const commodityMedian = median(commodityReturns);
  const dollarReturn = dxy && !dxy.error ? dxy.return1m : null;
  const available = dollarReturn != null && commodityMedian != null;

  return {
    key: "dollar-vs-commodities",
    title: "Dollar vs Commodities",
    value: available ? `${signed(dollarReturn, 1, "%")} vs ${signed(commodityMedian, 1, "%")}` : null,
    valueNote: "1-month return: US Dollar Index vs the median tracked commodity",
    weekLabel: null,
    monthLabel: available
      ? (dollarReturn as number) < 0 && commodityMedian > 0
        ? "Dollar down, commodities up"
        : (dollarReturn as number) > 0 && commodityMedian < 0
          ? "Dollar up, commodities down"
          : "Moving in the same direction"
      : null,
    interpretation: !available
      ? "Not enough data to compare."
      : (dollarReturn as number) < 0 && commodityMedian > 0
        ? "A softer dollar alongside rising commodity prices is consistent with the usual inverse relationship between the two."
        : (dollarReturn as number) > 0 && commodityMedian < 0
          ? "A firmer dollar alongside falling commodity prices is consistent with the usual inverse relationship between the two."
          : "The dollar and commodities are moving in the same direction over the past month — the usual inverse relationship is not showing here.",
    formula: "US Dollar Index (DX-Y.NYB) 1M return vs the median 1M return of all tracked commodity futures.",
    unavailable: !available,
  };
}

export function buildCrossMarketSignals(map: InstrumentMap): CrossMarketSignal[] {
  return [
    brentWtiSpread(map),
    goldSilverRatio(map),
    copperGoldRatio(map),
    hygLqdRatio(map),
    russellVsSp500(map),
    dollarVsCommodities(map),
  ];
}
