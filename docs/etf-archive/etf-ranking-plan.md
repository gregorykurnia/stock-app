# ETF ranking plan: one score, best to worst, across categories

> **Superseded 2026-10-09 by the [blank-slate plan](../etf-blank-slate-ranking-plan.md).** This first draft is kept as the starting point it came from. Its open decisions were answered and carried into the blank-slate plan.

Drafted 2026-10-09. Status: **proposal awaiting the user's decisions** (see the last section). If adopted, this replaces the scoring direction in the [ETF scoring roadmap](etf-scoring-roadmap.md) (M4–M9) and the Core/Full/execution formulas in the [independent Grand Score plan](etf-independent-grand-score-plan.md). The metric definitions in the [ETF page plan](../etf-page-plan.md) still apply.

## Goal

Rank every eligible ETF in the Pluang catalogue (222 entries, 15 research groups) from best to worst, in two ways:

1. **Overall rank** across all categories, so a bond fund, a gold trust and a semiconductor ETF sit on one list.
2. **Category rank** within its peer group, so you can pick the best vehicle for a given exposure (for example VOO vs IVV vs SPLG).

The score has to be explainable in one sentence per component, refreshable monthly at no cost, and honest about what it measures.

## What the score measures and what it doesn't

The only thing every ETF has in common is its **return stream**: what an investor actually earned, how efficiently, and how painful the ride was. A cross-category score therefore has to be built from the return stream. It can't use category-specific metrics like duration, tracking error or option premium yield, because most funds lack them.

So the score answers: **"Over the past 3–10 years, which ETFs delivered the best risk-adjusted outcome, and are they sound vehicles to own?"**

It does **not** answer:

- **"What will do best next?"** Historical rankings persist weakly, especially across categories.
- **"What belongs in my portfolio?"** A bond fund can rank low on its own and still be valuable as a diversifier. Correlation is shown as context for that (see Layer 4).
- **"Which is best in a different market regime?"** The ranking reflects the period measured. A window containing 2022 punishes bonds and long-duration growth; a window without it flatters them. The multi-horizon blend below reduces, but doesn't remove, this effect.

## Scoring mechanism

### Overview

```text
Grand Score (0–100) = 70% × Outcome Score + 30% × Vehicle Score
Trend Score (0–100) = shown next to Grand Score, not blended in by default
```

| Layer | Question it answers | Compared against | Normalization |
|---|---|---|---|
| 1. Outcome | How good was the return stream? | **All** eligible ETFs | Percentile rank |
| 2. Vehicle | Is it a cheap, liquid, durable fund to hold? | Fixed absolute bands | 0–100 by formula |
| 3. Trend | Is it working right now? | **All** eligible ETFs | Percentile rank |
| 4. Context | How does it behave against US equities? | Shown only | n/a |

### Why percentile ranks for the outcome layer

The current candidate method maps each metric through hand-picked curves (for example "8% CAGR = 50 points, 25% drawdown scale"). Those anchors are arbitrary, and they behave differently for bonds than for equities. A percentile rank instead asks "what share of the ETF universe did this fund beat on this metric?" That approach:

- needs no anchors or scales to tune;
- is robust to outliers (a single +300% crypto year doesn't stretch everything else);
- puts every metric on the same 0–100 footing, so components can be averaged;
- is the standard way cross-sectional fund rankings are built.

The trade-off is that a fund's score depends on the universe it's ranked in. That's acceptable because the universe is fixed (the Pluang catalogue) and every run is stored with its cutoff date.

**Percentile formula:** For a metric where higher is better, `percentile = (number of other funds with a worse value + 0.5 × number of other funds tied) ÷ (N − 1) × 100`, where N is the number of eligible funds with that metric at that horizon. The best fund scores 100, the worst 0, and tied funds share the same value. Invert the comparison for lower-is-better metrics.

### Layer 1: Outcome Score (70% of Grand)

All components use monthly total returns from dividend- and split-adjusted closes, through the **last completed month-end**, on identical dates for every fund.

| Component | Weight | Metric | Why |
|---|---|---|---|
| Return | 35% | Annualized total return (CAGR) | What you actually got |
| Efficiency | 35% | Sortino ratio (excess return over cash ÷ downside deviation) | Return per unit of bad volatility; doesn't punish upside swings |
| Pain | 30% | Average of two percentiles: max drawdown (depth) and share of days spent below the prior peak (duration) | How hard it was to hold; depth alone misses funds that stay underwater for years |

Each component is a percentile across all eligible funds at that horizon. Outcome for a horizon is the weighted average of the three.

**Cash series for Sortino:** use **BIL** (SPDR 1–3 Month T-Bill ETF) adjusted total return from the same Tiingo feed as the realized monthly cash return. This removes the existing blocker that FRED TB3MS is a yield, not a holding return. BIL has history from 2007, enough for 10Y windows.

**Horizon blend:** Score each available horizon separately, then combine them using the weights Morningstar uses for its overall star rating:

| History at cutoff | Outcome = |
|---|---|
| < 36 months | Not ranked ("Too new"); Vehicle score still shown |
| 36–59 months | 100% 3Y |
| 60–119 months | 60% 5Y + 40% 3Y |
| ≥ 120 months | 50% 10Y + 30% 5Y + 20% 3Y |

This rewards durable records without throwing out younger funds, and it dilutes any single regime. Show a "3Y only" badge on funds scored on 3Y alone, because their score rests on a shorter, more regime-specific record.

### Layer 2: Vehicle Score (30% of Grand)

This layer captures what the past return stream can't tell you about owning the fund going forward. Fees are the most reliable known predictor of future relative performance among similar funds. Small, illiquid funds carry closure and trading-cost risk.

These use **absolute bands**, not percentiles. A 0.60% fee costs you the same whether the fund sits among bonds or themes, and absolute bands avoid shaky percentiles in small peer groups.

| Component | Weight | 0 points | 100 points | Formula |
|---|---|---|---|---|
| Cost | 50% | Net expense ratio ≥ 1.00% | 0.00% | `100 × (1 − ER ÷ 1.00%)`, floored at 0 |
| Liquidity | 25% | Median 30-day dollar volume ≤ $1M | ≥ $50M | Linear on log scale between the bounds |
| Size | 25% | AUM ≤ $50M | ≥ $1B | Linear on log scale between the bounds |

Dollar volume is computed from Tiingo daily close × volume, so no spread feed is needed. Disclosed bid/ask spreads can replace it later if a source appears.

Most large index funds will score 85–100 on Vehicle. The layer mainly **penalizes** expensive, tiny or thinly traded funds, which is the intent.

### Layer 3: Trend Score (separate column)

This is for timing, and it matches the trend framework used elsewhere in the app. It's computed from the same monthly data:

- **Momentum percentile:** average of 3M, 6M and 12M-excluding-the-latest-month total return, percentile-ranked across all eligible funds.
- **Trend state:** price above or below its 10-month simple moving average, shown as Uptrend or Downtrend. This is the well-known Faber timing rule.

Trend is **not** blended into the Grand Score by default. Grand Score changes slowly (monthly, multi-year windows), while Trend can flip in a month. Mixing the two produces a number that's hard to read. Instead the UI offers two sorts:

- **Quality rank:** sort by Grand Score. "What are the best ETFs to own?"
- **Tactical rank:** sort by `50% Grand + 50% Trend`. "What are the best ETFs to own right now?"

### Layer 4: Context, shown but not scored

- **Correlation to VOO** (3Y monthly). A low or negative correlation explains why a low-ranked bond or gold fund may still be useful.
- **Distribution yield**, for income-focused users. Total return already includes distributions, so yield is never added to the score.
- **History basis** (3Y only / 5Y blend / 10Y blend) and the cutoff date.

## Eligibility

| Group | Treatment |
|---|---|
| ETFs, commodity pools, physical-metal trusts, spot-bitcoin trusts | Ranked. Their return streams are comparable. |
| Leveraged/inverse (21), single-stock funds | **Not ranked.** Daily-reset decay makes multi-year outcomes misleading for holding, and they would dominate both ends of the list. Shown in a separate tactical list with Vehicle and Trend only. |
| ETNs (3) | Not ranked; separate list (issuer credit risk, different structure). |
| Exclusions (3: operating companies, closed-end fund) | Not shown in ETF rankings. |
| Funds with < 36 months of history | Listed as "Too new", with Vehicle score and Trend only. |
| Unresolved identity or missing price history | Listed with the precise reason; never scored from partial data. |

## Category ranking

Category rank uses the **same Grand Score**, filtered to the peer group. No separate formula is needed. Peer groups start from the 15 research groups and are refined into subgroups where the exposures differ materially:

- **Fixed income:** cash/ultra-short, Treasury short/intermediate/long, aggregate, investment-grade corporate, high yield, inflation-linked, international, preferred.
- **International equity:** developed ex-US, emerging, total ex-US, single-country.
- **US broad:** total market, large cap, mid/small cap, growth, value.
- **Sector/thematic:** one subgroup per sector; themes grouped where they hold similar stocks.

Funds tracking the **same index** (for example VOO/IVV/SPLG) will land within a few points of each other. That's the correct answer: they're near-substitutes, and the Vehicle layer (fee, liquidity, size) settles the choice.

## Display rules

These come from the lessons of the M1 audit:

- Show Grand, Outcome, Vehicle and Trend as **whole numbers**. Decimals imply precision the method doesn't have.
- Show **tiers** next to ranks: Tier 1 = top 20% … Tier 5 = bottom 20%. Treat two funds within the **tie threshold** as effectively equal. Start the threshold at 3 points and set it from the sensitivity check in step 5.
- Every score has an expandable breakdown: component values, their percentiles, horizon weights, cutoff date and data source.
- Label the ranking as **historical**: "Ranked on returns through {cutoff}. Past results; not a forecast."

## Data path

| Input | Source | Refresh | Notes |
|---|---|---|---|
| Daily adjusted close, volume | **Tiingo Starter EOD (free)**, `lib/etfTiingo.ts` already exists | Monthly, plus incremental | Starter is listed for personal internal use: 500 unique symbols/month, 50 requests/hour, 1,000/day (as recorded 2026-10-06). 223 symbols (222 + BIL) ≈ 5–6 hourly windows for a full refresh (the existing `reserveTiingoRequest` throttles to 40/hour). Re-confirm the limits and the token before backfill. |
| Net expense ratio, AUM, inception | Issuer fund pages, entered in a checked-in CSV with source URL and as-of date | Quarterly (fees rarely change) | One-time effort for ~200 funds. Existing stored snapshot values are a to-verify list only, not a source. |
| Cash return (BIL) | Tiingo, same as above | Monthly | |
| Yahoo | **Not used.** Retire the gated Yahoo refresh path. | | Removes the terms-of-use blocker entirely. |

**Storage:** Daily history goes in the existing year-partitioned Firestore chunks (`saveETFCoreHistory` in `lib/etfMetricStore.ts`). Each monthly ranking run is stored as one small document (scores, components, cutoff, input hash), well under the 1 MiB limit for ~200 funds. Page reads use stored runs only; no live provider calls.

## Implementation steps

Each step is small enough for one session. Validate, then commit and push, per `AGENTS.md`.

1. **Confirm data access.** Check that `TIINGO_API_TOKEN` works, run a coverage pass over all 223 symbols (history start date, gaps), and record any symbols Tiingo lacks.
2. **Build the fees/AUM CSV.** Columns: ticker, net expense ratio, AUM, inception, source URL, as-of date. Flag missing values; never impute them.
3. **Extend metrics.** Reuse `calculateETFMetrics` in `lib/etfMetricCalculations.ts` (CAGR, max drawdown and underwater rate already exist). Add 3Y/10Y variants where missing, Sortino against BIL, 3M/6M/12M-ex-1M momentum, the 10-month SMA state, 30-day median dollar volume and correlation to VOO.
4. **Write the ranking module.** Add a new pure module, `lib/etfRanking.ts`, containing the percentile helper, Outcome/Vehicle/Trend/Grand calculations, the horizon blend, eligibility and tiers. Unit-test it with synthetic data: monotonicity, ties, missing horizons, the eligibility gates and invariance to input order.
5. **Run a sanity check, not an audit.** This takes one session:
   - Recompute 5 funds independently in a spreadsheet; the scores must match.
   - Same-index pairs (VOO/IVV, VTI/ITOT) land within the tie threshold.
   - High-fee, decaying or tiny funds land in Tier 4–5.
   - Weight sensitivity: shift each layer/component weight ±10 points and report the share of funds that change tier. If more than ~20% move, revisit the weights before shipping.
   - Stability: compare rankings at two cutoffs three months apart and report how many change tier.
6. **Add UI to `/etf`.** In `components/ETFExplorer.tsx`, add Rank, Tier, Grand, Trend and category-rank columns; the Quality/Tactical sort toggle; the component breakdown drawer; and the historical label. Keep the existing Explore/Compare/Shortlist flows.
7. **Schedule the monthly refresh.** Reuse the hourly Tiingo cursor workflow (`.github/workflows/refresh-etf-core.yml`). After the month-end data is complete, compute and store one ranking run.
8. **Clean up.** Once the ranking ships, remove the superseded Core/Full/execution formulas, the equity-index experiment pages and the M4 run-store code, or keep them read-only if you want the record.

## What this drops from the current approach, and why

| Dropped | Reason |
|---|---|
| M1–M9 gated milestones, dated reports and frozen SHA-256 samples | Built for an externally published product. For a personal tool, a unit-tested pure module plus a one-session sanity check gives the same confidence. |
| M4 run store (leases, retry budgets, compare-and-set, TTL, Firebase Admin) | The ranking for ~200 funds is one small document per month. The existing Firestore helpers are enough. |
| Hand-tuned curves (8% growth anchor, 25% drawdown scale, etc.) | Arbitrary and category-biased; replaced by percentiles. |
| "No ranking across mandates" | That restriction made sense for a 12-fund experiment. Ranking across categories is the goal here, so the plan handles it with an honest label, a horizon blend and a correlation context column. |
| Yahoo automation | Terms-of-use blocker; Tiingo covers the same need for personal use. |
| Tracking difference and NAV-based metrics | No free source. Within same-index peers, net-return differences already capture most of it. |

**Kept:** month-end cutoffs, adjusted total returns without double-counting distributions, explicit "missing/too new" states, no imputed fees, page reads from stored results only, and whole-number display.

## Decisions needed from you

1. **Default sort.** Quality rank (Grand Score) or Tactical rank (Grand + Trend)? *Recommended: Quality as default, Tactical as a toggle.*
2. **Outcome/Vehicle split.** 70/30? *Recommended: yes.* A higher Vehicle weight favors cheap index funds more strongly.
3. **Diversification in the score.** Keep correlation to VOO as context only, or award points for low correlation (which would lift bonds and gold)? *Recommended: context only to start, because adding it makes the score depend on your current holdings.*
4. **Leveraged/inverse funds.** A separate tactical list as proposed, or omit them entirely?
5. **Currency.** USD only for now, or also an IDR view later (uses matched USD/IDR rates)?
