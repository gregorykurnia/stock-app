# Independent ETF Grand Score implementation plan

Requested: 2026-10-06. Expanded: 2026-10-06 to cover the catalogue with strategy-specific scorecards. Updated: 2026-10-06 with the personal-use, free-data implementation handoff and Core pipeline. Status: the Tiingo Core acquisition path is live-validated and retained for VOO, VTI, and VXUS; catalogue-wide history, issuer-data breadth, return reconciliation beyond VTI, and methodology approval remain unfinished. See the [Core coverage report](etf-core-coverage-2026-10-06.md).

## Agreed outcome

### Authorized two-fund Free Core trial — 2026-10-07

The user requested a trial for VOO and VXUS of the simpler free-data approach discussed after this plan: Yahoo historical prices, sourced annual net fees, and no mandatory spread input. The separately labelled trial uses `(0.30 × FeePoints + 0.40 × HistoricalOutcomes) / 0.70`, reusing the equity-index outcome curves below. Its 1Y/3Y results are saved and displayed at `/etf/free-core-trial`; [the trial report](etf-free-core-trial-2026-10-07.md) records sources, numbers, provider differences and reproduction. This authorizes the two-fund experiment, not changing existing Core/Full formula versions or claiming broad release coverage. The remaining plan below continues to describe those original scorecards.

Add a visible, explainable Score column to `/etf`, calculated independently for each eligible fund. Publish a broadly available Core Score first, and retain the more demanding Full Grand Score for verified equity index funds. The agreed Full Grand Score remains:

```text
Grand Score = 0.60 × Fund Quality + 0.40 × Historical Performance
```

The user accepted this blend. Scores must come from fetched financial inputs and server calculations. The previously simulated quality score of 95 and rolling-return assumptions are examples, not fund ratings or production inputs. Do not tune thresholds to give VOO, VTI, or VXUS a desired result.

This document supersedes the score-related peer percentiles, minimum-ten-peer requirement, score weights, and scoring release instructions in [the quantitative comparison plan](etf-quantitative-comparison-plan.md). Its other metric, provenance, comparison, and source requirements continue to apply. [The dated coverage report](etf-quantitative-coverage-2026-10-06.md) remains a record of the earlier implementation state; writing this plan does not resolve its source gaps.

## Implementation handoff: personal use with free data

This section records the user's latest decisions and makes the Core implementation concrete. Use the formulas and eligibility rules below rather than inventing an easier score to fill empty rows.

### Decisions and access

- The app is for the user's personal use. Start with Core 3Y and Core 1Y scores, plus clearly separate cost-only results. Full and Tactical/ETN execution are later enrichment with their own input requirements.
- Use Tiingo's free Starter EOD API for market history, subject to live entitlement and ticker checks, and official issuer disclosures for identity, mandate, comparison dimensions, net fees and 30-day median spreads. Do not buy a provider subscription.
- The chat-shared token was rotated; the replacement is configured as server-only `TIINGO_API_TOKEN` and has returned HTTP 200 for VOO, VTI, and VXUS history requests. This confirms current entitlement and history only for those three symbols, not the whole catalogue. Do not copy the token into documentation, source, fixtures, logs or commits. Keep it server-only and never use a `NEXT_PUBLIC_` prefix.
- Tiingo's [current pricing](https://www.tiingo.com/about/pricing), checked 2026-10-06, lists Starter at $0/month with 500 unique symbols/month, 50 requests/hour, 1,000 requests/day and 1 GB/month, for personal internal use. These limits fit the 216-ETF symbol count, but do not prove every ticker or historical period is available. Confirm the account's actual limits before backfill. Do not expose source history or scores to other users without confirming the applicable display/derived-data rights.
- The [EOD documentation](https://www.tiingo.com/documentation/end-of-day) describes raw and dividend/split-adjusted prices, `adjClose`, `divCash`, `splitFactor`, and historical date-range requests. Use daily adjusted closes for returns; do not add dividends again to an already adjusted series. Retain raw close, actions, source dates and adjustment provenance for reconciliation.
- Fees and spreads can be available without another paid feed: [iShares IVV](https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf) publishes fees, a dated 30-day median spread and mandate documents; [State Street SPY](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-sp-500-etf-trust-spy) is another issuer disclosure example. These examples establish available fields, not full-catalogue coverage or a supported bulk API. Check download interfaces, access terms and field definitions per issuer. If automatic access is unavailable, support a validated dated file import with provenance.

No additional API key is currently confirmed necessary for Core. Issuer spread coverage, exact net-fee definitions/dates, mandate evidence and Tiingo history completeness remain the principal data uncertainties. Full needs separate NAV and official total-return index histories; Tactical needs exact daily references and NAV; ETNs need indicative-value histories. Do not promise these are all freely available. Risk-free series and full holdings are supporting metrics, not Core prerequisites.

### What is already implemented

| Existing area | Current state | Next work |
|---|---|---|
| `lib/etfScoring.ts` | Pure Core, cost-only, Full and execution formulas with validity checks | Validate candidate curves and wire real normalized inputs; do not duplicate the math |
| `lib/etfScorecard.ts` | Candidate constants/version IDs, routing, comparison dimensions and assessment selection | Populate sourced mandate verification and freeze only reviewed variants |
| `lib/etfCatalog.ts` | Snapshot and `scoreAssessments` contracts | Extend only for normalized input/provenance requirements |
| `components/ETFExplorer.tsx` | Score column, coverage, details, grouping and CSV | Verify real saved assessments, matched horizons and missing-input reasons |
| `app/api/etf-metrics/route.ts` | Yahoo refresh and saved-snapshot reads | Added separate Tiingo Core refresh, persisted cursor, account gate and assessment publication; live-validated on VOO, VTI and VXUS |
| `lib/etfMetricStore.ts` | Firestore snapshot writes/reads | Added year-partitioned Core history, hourly request budget, retained assessments and legacy-write preservation |
| `.github/workflows/refresh-etf-metrics.yml` | Yahoo-authorized batch refresh | Yahoo path remains separate; `.github/workflows/refresh-etf-core.yml` advances the Tiingo cursor hourly |

Current scoring methodology states are `candidate`; complete inputs still yield `methodologyPending` and no publishable number. Never fix this by toggling the state alone or setting `verified`, `authorized`, `complete` or `fresh` to true without supporting checks.

### Ordered implementation checklist

1. **Confirm access and produce a coverage manifest.** Check the rotated Tiingo credential using a small sample without printing it. Inventory all catalogue records and issuer families. For each ticker record identity, source URL/file, source/financial dates, fee designation/waiver, spread window/method, mandate/comparison evidence, currency, inception/continuity, history endpoints and precise missing-input reasons. Record ETF, ETN and excluded denominators separately. Assess source retention/use and supported download interfaces. API errors and missing fields are blockers, not zero values.
2. **Validate a representative batch before broad collection.** Include VOO, VTI and VXUS plus at least one sourced example from every proposed launch family, active/passive mandates, dividend-heavy funds, short histories, leverage and unresolved identities. Reconcile provider actions and returns with dated issuer disclosures using the same endpoints and conventions. Record tolerances and discrepancies. Family-specific validation is required before that family publishes scores.
3. **Build shared acquisition adapters.** Add one server-only Tiingo history adapter and shared issuer adapters/import schemas, then run ticker records through them. Normalize fees in percentage units (`0.03` means 0.03%), spreads in basis points (`0.01%` means 1 bp), and monthly returns as decimals. Preserve net/gross designation, waiver expiry and genuine financial dates. Capture spread definition and window: a current bid/ask quote cannot substitute for the disclosed 30-day median. Verify comparison dimensions against dated sources rather than inferring them from ticker/category names.
4. **Store and validate complete windows.** Retain authorized daily history in bounded chunks and input manifests in the existing Firestore setup, measuring document size/read cost. Preserve hashes or immutable references sufficient to reproduce each score run. Derive exactly 12/36 monthly returns from 13/37 endpoints and daily drawdowns on those same periods through the last completed UTC month. Validate missing trading sessions against the relevant exchange calendar, duplicates, splits, distributions, currency and mandate continuity. Do not fill missing months or use today's price with a month-end historical window.
5. **Review and version the methodology.** Run the existing acceptance checks below, including synthetic edge cases, monotonicity, reproducibility and sensitivity across cutoffs/families/horizons. Retain the validation report and accepted configuration. Assign frozen version IDs only to reviewed variants; leave unsupported variants candidate. User authorization to implement is not evidence that the curves or sources passed validation.
6. **Calculate and persist assessments.** Feed verified routing and normalized inputs into the existing pure functions. Store separate Core 3Y, Core 1Y and cost-only assessments, components, dates, source IDs, common cutoff, comparison evidence and run/method IDs. Publish `available` only for complete validated inputs and frozen methods. Save explicit statuses/reasons for every other route. Preserve successful prior results after acquisition failures, but mark their current freshness/eligibility accurately. Prevent a legacy metrics write from silently deleting assessments. Recompute or withdraw availability when an input becomes stale or invalid; a recent market snapshot alone cannot make an old spread fresh.
7. **Backfill with persistent progress.** Use a provider budget and resumable cursor across process restarts/jobs, bounded retries with backoff, and a stable universe ID. A 12-ticker batch alone does not enforce Tiingo's 50/hour limit. With one history request per ETF, 216 ETFs need five hourly quota windows; metadata calls, retries, reconciliation and bandwidth add work. Do not keep a serverless request asleep for hours. Validate whether permitted bulk updates can reduce request volume before using them. Budget other jobs that share the account and avoid overlapping runs.
8. **Refresh and publish from the selected provider.** Add a distinct Tiingo configuration path; do not set `ETF_YAHOO_AUTOMATION_AUTHORIZED=true` to enable Tiingo. Separate per-input acquisition freshness from the completed-month score cutoff. Refresh incremental daily histories with enough overlap to detect provider revisions, re-fetch older affected chunks when adjustments change, and update issuer disclosures within configured freshness limits. Monthly score windows change after the next completed month; current fees/spreads can require recomputation sooner. Give all ranked comparisons the same cutoff. Cache per-fund results so page reads need neither provider calls nor LLM calls.
9. **Verify the user-visible result and release coverage.** Confirm server-rendered `/etf` and `/api/etf-metrics` return the saved assessments; test selection, grouping, numeric sorting, mobile, details, Compare and CSV. Keep 1Y/3Y, Core/Full and cost-only distinct. Produce numerical/ranked coverage and blocker counts by family/horizon. Use the existing 80% targets as acceptance goals and report actual shortfalls honestly. Leveraged ETFs, ETNs and exclusions must retain explicit routes/reasons while their execution inputs remain unavailable. Run relevant validations, commit only related changes and push the branch as required by `AGENTS.md`.

### Completion and cost expectations

The first milestone is a reproducible numerical Core score displayed from a saved assessment for the representative validated batch. Broad release additionally requires validated shared adapters, a resumable backfill, scheduled refresh, a catalogue-wide coverage report and the UI/export checks above. An API key, a functioning price download or a visible Score column alone does not complete the feature.

216 records are ordinary batch-processing scale; adapter and source reconciliation work determine development effort. Build by issuer family rather than writing 216 individual scrapers. The data budget is $0 for this personal-use route, subject to measured coverage and limits. Hosting/storage remain subject to existing quotas and are not guaranteed free at every usage level. Runtime scoring and refreshes are deterministic code with no LLM calls or ongoing AI-credit cost; development/research consumes session usage. Do not quote a guaranteed implementation time or credit total before the sample audit. Retain specific blockers if free sources cannot meet the coverage target instead of fabricating inputs, changing the formula or purchasing a feed.

## Coverage objective and comparison frame

The user wants scores on most catalogue names and a clear way to identify stronger and weaker ETFs. Broaden the scoring inputs and strategy support rather than requiring official index/NAV history before any number can appear. A calculated number must still identify what it measures and how much actual history supports it.

The checked-in research universe contains 222 records: 216 ETF entries, three ETNs and three exclusions. Its groups are research classifications, not verified scorecard assignments:

| Catalogue group | ETF entries | Intended routing after mandate verification |
|---|---:|---|
| US broad market and styles | 19 | Equity index or active equity |
| International and global equities | 34 | Equity index or active equity |
| Sector and thematic equities | 59 | Equity index or active equity; narrow exposures separately |
| Dividend equities | 7 | Dividend equity, index or active |
| Real estate and infrastructure equities | 5 | Real-asset equity, index or active |
| Fixed income and preferred securities | 28 | Bond or preferred-security scorecard |
| Options income and distribution strategies | 20 | Options-income scorecard |
| Physical precious metals | 7 | Physically backed metal scorecard |
| Commodity futures | 12 | Futures strategy scorecard |
| Spot digital asset trusts | 2 | Spot digital scorecard |
| Digital asset futures | 1 | Futures strategy scorecard, digital exposure |
| Multi-asset allocation | 1 | Allocation scorecard |
| Leveraged and inverse ETFs | 21 | Tactical execution scorecard |
| **ETF total** | **216** | Identity and legal structure must be verified individually |

Target numerical-score coverage of at least **80% of ETF entries: 173 of the current 216**. This is a release acceptance target, not measured availability or a promise that providers cover those names. Recompute the denominator when the catalogue changes. Count each ticker once; exclude ETNs and exclusions from the ETF denominator, but keep unresolved ETF identities in it. Report Core 3Y, Core 1Y, Full, Tactical, cost-only and unavailable counts separately. Cost-only numbers and stale scores do not count toward the target. Also target at least **80% long-term Core/Full coverage within non-tactical ETF entries: 156 of the current 195**. Report this separately from tactical coverage so execution ratings cannot disguise a lack of investment comparisons.

Every record needs a routing result and data-gap reason. If the audit falls below the target, resolve adapters and missing fields, or report the measured shortfall; do not lower validity standards, impute values or declare coverage complete. Expanding scorecards resolves eligibility gaps, not missing-source gaps.

Provide comparison groups based on verified exposures and objectives, not catalogue membership alone. A numeric score answers “how strong is this product on this scorecard over this period?” Default ranked lists answer “which scored funds are stronger within this investment role?” They do not establish which asset class will perform best next.

## Scope and interpretation

- The Full Grand Score below covers conventional, unleveraged equity index ETFs. The additional Core and Tactical scorecards cover the other verified strategies listed later. Eligibility requires a verified mandate and instrument identity; catalogue category or `strategy: core` alone is insufficient.
- Each fund uses fixed, versioned rules. Full and Tactical scores require their specified benchmark; Core scores do not. A score needs no other fund and cannot change when the displayed catalogue, filters, or peer membership changes.
- Preserve every catalogue record. Route each verified mandate to an explicit scorecard. Exclusions remain unscored; ETNs receive a separate execution assessment only after note identity and terms are verified. Unresolved routing shows a reason rather than applying the equity formula.
- These are product-cost, implementation and historical-outcome assessments with different depth. They do not measure personal suitability, expected future returns, or a fund's diversification benefit to the user's portfolio.
- Ranked comparisons require the same scorecard, depth, history horizon, methodology, cutoff and verified comparison group. Different scorecards must not be pooled into a universal ranking. All-catalogue browsing can show individual scores, but must group ranked results.
- Display actual drawdown, volatility, recovery state, and concentration beside the score. A high-quality product can still have substantial exposure risk.

## Full equity-index Historical Performance formula

Use percentage units throughout: `13.75` represents 13.75% return; `0.03` represents a 0.03% expense ratio. Convert provider decimal fractions once at the adapter boundary.

| Component | Weight | Formula producing points from 0 to 100 |
|---|---:|---|
| Growth `G` | 40% | `100 / (1 + exp(-(g - 8) / 4))` |
| Drawdown resilience `R` | 35% | `100 / (1 + (d / 25)^2)` |
| Consistency `C` | 15% | `100 / (1 + (s / 5)^2)` |
| Fee efficiency `F` | 10% | `100 × exp(-e / 0.50)` |

Inputs:

- `g`: five-year CAGR from genuine total-return market-price levels, using the last completed UTC month as cutoff.
- `d`: magnitude of the worst daily peak-to-trough drawdown over the same five-year window, including its starting level. A -25% drawdown enters the formula as `25`.
- `s`: `max(0, rolling5YMedianCagr - rolling5YP10Cagr)`, in percentage points, across exactly 36 monthly rolling-window endpoints ending at the cutoff. Each window uses 61 complete month-end total-return levels. This needs about eight years of underlying history. Use linear-interpolated quantiles and retain endpoints. A negative gap beyond rounding tolerance signals invalid input rather than being silently clamped.
- `e`: verified current annual net expense ratio, retaining waiver expiry, financial date, and net/gross designation.

Combine without rounding intermediate values:

```text
Historical Performance =
100 × (G/100)^0.40 × (R/100)^0.35 × (C/100)^0.15 × (F/100)^0.10
```

Implement the geometric mean in log space and use a numerically stable logistic function. Validate finite inputs, nonnegative expenses, and drawdown in [0, 100]. Negative CAGR is valid. A genuine zero component produces zero; missing values must never enter the formula as zero. Round only for display.

The curve anchors are product preferences, not empirically established thresholds. Historical Performance still includes some related dimensions. Current fees also influence Fund Quality, and historical total returns already reflect expenses; assess that overlap explicitly during sensitivity validation.

Do not weight underwater time, Sharpe, Sortino, Calmar, or absolute P10 again. Keep them available as supporting metrics. Missing risk-free history does not block this scorecard.

## Full equity-index Fund Quality formula: initial specification to validate

The 60% Grand Score weight is agreed. The following quality component weights and curves are proposed implementation candidates; validate them against source precision and a representative fund sample before freezing version 1.

| Component | Quality weight | Initial curve | Input |
|---|---:|---|---|
| Fee efficiency `Qfee` | 20% | `100 × exp(-e / 0.50)` | Verified annual net expense ratio, in % |
| Trading efficiency `Qspread` | 20% | `100 / (1 + (b / 10)^2)` | Verified 30-day median bid/ask spread, in basis points |
| Tracking difference `Qdifference` | 30% | `100 / (1 + (abs(td) / 0.25)^2)` | Five-year NAV CAGR minus official index CAGR, in percentage points |
| Tracking error `Qerror` | 30% | `100 / (1 + (te / 0.50)^2)` | Annualized standard deviation of matched monthly NAV/index return gaps, in % |

```text
Fund Quality =
0.20 × Qfee + 0.20 × Qspread + 0.30 × Qdifference + 0.30 × Qerror
```

Use sample standard deviation across exactly 60 complete aligned monthly return gaps for tracking error, multiplied by `sqrt(12)`. Calculate NAV and benchmark CAGR on identical five-year endpoints. NAV levels alone are not total returns: reconstruct reinvested distributions and corporate actions unless the source supplies a documented NAV total-return series.

Match currency, hedging, valuation conventions, and gross/net dividend treatment to the fund's official mandate. Store sourced benchmark identifiers and effective dates; benchmark changes require an explicitly documented transition or make the affected window unavailable. A comparison ETF or a price-only index cannot substitute for official tracking inputs.

Retain signed tracking difference in the breakdown. Positive deviations receive no automatic bonus: investigate convention mismatches and structural explanations. Fees and net tracking difference overlap economically, so test alternative weights and disclose the dependence. Expense ratio is only one part of ownership cost.

Do not score issuer reputation, fund age, AUM, nominal holdings count, or a manually assigned quality tier. Full holdings are supporting research rather than a dependency of this proposed quality formula.

## Broad-coverage Core Score

Core is an additional, explicitly limited assessment; it does not silently replace missing Full Grand Score components. It measures observable ownership costs and historical outcomes without requiring official benchmark or NAV histories. Use normal server calculations, cached inputs and no LLM calls during refresh or page viewing.

```text
Core Score = 0.60 × Cost and Trading Score + 0.40 × Historical Outcomes
Cost and Trading Score = 0.50 × FeePoints + 0.50 × SpreadPoints
FeePoints = 100 × exp(-e / feeScale)
SpreadPoints = 100 / (1 + (b / spreadScale)^2)
```

`e` is the verified current annual net expense ratio in percent, with waivers and dates retained. `b` is the verified 30-day median spread in basis points. Neither a missing fee nor a live spread can enter as zero. Cost and Trading is narrower than Full Fund Quality; do not label it as proof of sound custody, strategy construction, credit quality or index tracking.

Core historical variants:

- **Core 3Y:** exactly 36 complete monthly returns plus complete daily history over matching endpoints. Use the last completed UTC month as cutoff. This is the default Core assessment when available.
- **Core 1Y · Limited history:** exactly 12 complete monthly returns plus complete daily history over matching endpoints. Offer this for newer funds, in a separate ranked list. Keep a 1Y variant available for established funds to allow a matched-period comparison with newer funds; never mix a fund's 3Y number with another fund's 1Y number.
- **Under one year:** show a complete Cost and Trading Score if possible, labeled cost-only with no Core composite or historical ranking. This does not count toward the numerical-score coverage target.

No backtested index history, predecessor history or simulated strategy returns may extend a fund's live track record. Benchmark changes and material mandate changes start a new eligible period unless continuity has been specifically validated.

For either Core horizon, calculate:

```text
GrowthPoints = 100 / (1 + exp(-(g - growthAnchor) / growthScale))
DrawdownPoints = 100 / (1 + (d / drawdownScale)^2)
DownsidePoints = 100 / (1 + (u / downsideScale)^2)
Historical Outcomes =
100 × (GrowthPoints/100)^growthWeight
    × (DrawdownPoints/100)^drawdownWeight
    × (DownsidePoints/100)^downsideWeight
```

`g` is annualized market-price total return over the exact horizon. `d` is the magnitude of daily maximum drawdown over it. `u = 100 × sqrt(12 × mean(min(r[t], 0)^2))`, where `r[t]` is a decimal monthly total return and the mean includes every month. This uses a declared zero monthly minimum acceptable return; it is downside deviation, not Sortino. Require every monthly return; never substitute zero for missing observations. Zero observed drawdown/downside is valid and produces 100 component points. Validate `g > -100`, `d` in [0,100], `u >= 0`, finite inputs, positive scales and component weights summing to one. Compute the geometric mean in log space without intermediate rounding.

These formulas intentionally avoid a rolling-window requirement that would block younger funds. They still overlap in their use of past risk and return; validate that overlap and sensitivity before release. A one-year score is much more sensitive to its market regime and must remain visibly labeled even if its number is high.

### Strategy scorecards and proposed anchors

All constants below are initial product preferences to test, not researched optimal investment rules. Returns, drawdown, downside and expense scales use percentage units; spread scales use basis points. These are separate versioned scorecards, even where constants match. Freeze constants only after provider, precision and sensitivity validation. Horizons have distinct version IDs and rankings; start with the same candidate constants to make differences observable, then validate both horizons independently.

| Core scorecard | feeScale | spreadScale | growthAnchor / growthScale | drawdownScale | downsideScale | Growth / drawdown / downside weights |
|---|---:|---:|---:|---:|---:|---|
| Equity index | 0.50 | 10 | 8 / 4 | 25 | 15 | 40% / 35% / 25% |
| Active equity | 0.75 | 15 | 8 / 4 | 25 | 15 | 40% / 35% / 25% |
| Dividend equity | 0.50 | 10 | 7 / 4 | 25 | 15 | 40% / 35% / 25% |
| Real estate/infrastructure equity | 0.75 | 15 | 7 / 4 | 30 | 18 | 40% / 35% / 25% |
| Investment-grade bonds | 0.40 | 10 | 3 / 2 | 10 | 6 | 30% / 40% / 30% |
| High-yield/emerging-market bonds | 0.60 | 20 | 5 / 3 | 20 | 12 | 30% / 40% / 30% |
| Preferred securities | 0.60 | 20 | 5 / 3 | 25 | 15 | 30% / 40% / 30% |
| Options income | 0.75 | 20 | 6 / 4 | 25 | 15 | 35% / 40% / 25% |
| Physically backed metals | 0.50 | 15 | 5 / 5 | 30 | 20 | 40% / 35% / 25% |
| Commodity/digital futures | 1.00 | 25 | 5 / 6 | 40 | 25 | 35% / 40% / 25% |
| Spot digital assets | 0.75 | 20 | 8 / 8 | 60 | 40 | 35% / 40% / 25% |
| Multi-asset allocation | 0.60 | 15 | 5 / 3 | 20 | 12 | 35% / 40% / 25% |

Active management is an overlay to record for every applicable family. Non-equity active funds retain their bond/income/allocation scorecard and separate active/passive comparison groups. Dividend and real-asset equity route to their specialized scorecards before generic equity; leverage/inverse and ETN structure take priority over exposure. Exclusions take priority over all scoring. Single-security funds, synthetic structures and trusts require legal/mandate verification; do not classify them from ticker names.

The higher expense scale for active equity does not establish that its fees are worthwhile. Default groups separate active and passive products. An optional explicitly labeled equity Core comparison using identical index-equity constants can compare active and passive funds on the same cost/outcome frame, but cannot assess mandate fidelity or turn excess performance into demonstrated manager skill.

### Comparison groups and supporting checks

| Family | Required group boundaries and context |
|---|---|
| Broad, international, sector, thematic, dividend and real-asset equities | Geography, sector/theme, size/style, income objective, active/passive, currency and hedging. Broad core portfolios and single-sector/single-security exposures stay separate. Display concentration; do not universally reward low P/E or many holdings. |
| Bonds | Currency/hedging, government versus corporate, credit quality, duration bucket, fixed/floating rate and inflation linkage. Investment-grade long-duration bonds must not rank against cash-like Treasury funds as if they served the same role. |
| Preferreds | Separate from ordinary bonds; record issuer concentration, subordination, fixed/floating rates and currency. |
| Options income | Underlying exposure, single-security versus diversified, covered-call/put-write/other mandate, option coverage and tenor, leverage and distribution policy. Use reinvested total return; a high distribution yield or return of capital earns no automatic bonus. Display price/NAV change and distribution composition separately where sourced. |
| Physical metals | Same metal and backing model. Retain verified custody/backing/redemption disclosures and structural flags. Strong historical returns do not certify backing. |
| Futures | Same commodity/basket, long/inverse exposure, roll methodology and collateral conventions. Separate digital futures from spot. Display roll/collateral context when available; spot-price history cannot substitute for the fund's total-return history. |
| Spot digital | Same asset, custody/backing model and currency. Separate from futures and leveraged products. Display structural and exposure risks beside any Core result. |
| Allocation | Strategic equity/bond mix, target-risk or target-date objective, currency/hedging and active/passive mandate. Look-through allocation is context, not an invented diversification score. |

Missing mandatory group/mandate metadata blocks default ranked placement. A fund may show a provisional unranked Core result only after its family and scoring inputs are verified; show the unresolved group explicitly and exclude it from the coverage acceptance numerator until ranking eligibility is resolved. Serious unresolved structural issues require review and exclusion from default “stronger funds” lists, not an arbitrary numeric penalty. Encode sourced facts and dated review outcomes; avoid manually assigned reputation points.

A low-risk bond fund and an equity fund can both score well in their respective roles. Cross-role capital allocation requires a separate investor objective and cannot be answered by sorting their scores together. Supporting benchmark excess returns, Sharpe/Sortino, yields, AUM and holdings remain visible when verified, without becoming hidden Core dependencies.

## Leveraged/inverse and ETN execution scorecards

The 21 leveraged/inverse ETF entries receive a **Tactical Execution Score**, not a long-term Core or Grand Score. Most leveraged/inverse ETFs reset daily; their long-term results need not equal the stated multiple of an index's long-term return. See the [SEC leveraged/inverse ETF bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/sec). Exclude tactical products from the default long-term ETF shortlist regardless of numeric score.

```text
Tactical Execution Score = 0.40 × Tactical Cost and Trading + 0.60 × Daily Fidelity
Tactical Cost and Trading = 0.50 × FeePoints + 0.50 × SpreadPoints
Daily Fidelity = 100 / (1 + (dailyRmsGapBps / 10)^2)
```

Use candidate feeScale `1.00%` and spreadScale `25 bps`. `dailyRmsGapBps = 10000 × sqrt(mean((navReturn[t] - L × referenceReturn[t])^2))`, with returns as decimal fractions and signed mandate leverage `L`. Require verified NAV total returns, the exact official daily reference, matching currency/valuation/calendar, and the documented reset interval. This candidate card supports daily resets only; other reset intervals require separate specifications. Retain signed mean gaps and tracking variation to explain cost/financing effects. Do not adjust away financing drag unless a separately versioned methodology explicitly specifies it. Cost/fidelity overlap must be evaluated.

End execution windows at the last completed UTC month cutoff, with matched valuation-session dates. Publish a 252-session variant when complete, otherwise a separate 60-session limited-history variant. Never mix variants or different underlying/leverage/reset mandates in ranked comparisons. If official daily inputs are missing, show cost-only when complete; no invented Tactical composite. Daily history is independently sufficient for this execution rating; it is not a substitute for a Core long-term history requirement.

ETNs use a separate **ETN Execution Score** with the same proposed execution math only when their exact payoff, reset/leverage, official indicative-value series and daily reference make it applicable. Use indicative-value returns instead of fund NAV. Retain CUSIP/series continuity, issuer credit exposure, maturity/call terms and issuance/redemption status. ETNs are unsecured issuer obligations with credit and reference-market risk; see the [SEC ETN bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-50). This score does not assess default risk and must never be labeled an overall ETN quality grade. Non-daily or path-dependent payoffs stay unscored until a dedicated specification exists. ETNs remain outside ETF coverage counts and default ETF rankings.

## Full-score enrichment and displayed-score selection

Retain the original Full equity-index methodology above as an optional richer assessment. It still needs about eight years of live market history, five years of official NAV/index total returns, and complete fee/spread data. These requirements do not block Core publication.

The main Score column defaults to **Core 3Y**, otherwise **Core 1Y · Limited history**, otherwise **Cost and Trading only** or an explicit unavailable reason. Tactical products show their separately named execution score. Detail shows any independently complete Full Grand Score. A Full-score view ranks only Full results within compatible equity-index groups; never silently swap Full values into a Core-ranked list. A family can have Core and Full results at once, with distinct methodology IDs and breakdowns.

Additional richer strategy-quality scores are future enrichment work, not a hidden prerequisite for broad Core coverage. Official benchmark data can assess active excess returns or mandate implementation later, but lower active tracking error is not inherently better. Dividend/distribution yield, low P/E, AUM and issuer reputation receive no automatic quality bonuses.

## Sources informing the strategy distinctions

The proposed numeric curves and weights are our product choices, not formulas endorsed by these sources. [FINRA's bond guidance](https://www.finra.org/investors/investing/investment-products/bonds) identifies duration and credit risk as separate considerations. [Cboe's index-income explanation](https://www.cboe.com/us/index_income/help/) explains the premium/upside-cap tradeoff in buywrite strategies. Together with the SEC links above, these support separate comparison roles, not a universal highest-score winner.

## Acquisition for the whole catalogue

Build provider and issuer adapters once, then process ticker records through them. Do not implement a bespoke scraper or scoring function for every fund.

| Required input | Acquisition route | Coverage requirement |
|---|---|---|
| Expense ratio, mandate, identifiers and comparison metadata | Issuer data or ETF reference provider | Share-class identity, family, objective, exposure, active/passive, units, source date, net/gross fee and waiver status; Core and Full dependency |
| Historical market total returns | Authorized historical price/distribution feed | Core needs 1Y or 3Y; Full needs about 8Y. Verify adjustment definitions, distributions, corporate actions, currencies and complete dates |
| Median spread | Issuer's disclosed 30-day median or a historical quote provider | Core, Full and execution dependency; comparable window/method; a live quote is not a 30-day statistic |
| NAV total returns / ETN indicative values | Issuer or documented provider history with distributions | Full needs 5Y NAV history; Tactical/ETN needs daily payoff-compatible history for its horizon. Core does not depend on NAV history |
| Official benchmark total returns | Index provider or entitled financial-data feed | Full needs exact index/version and compatible dividend convention for 5Y; execution needs aligned daily references; Core does not depend on benchmark history |

Potential integrations to evaluate, not commitments:

- [Alpha Vantage documentation](https://www.alphavantage.co/documentation/) documents ETF profiles; inspect actual responses for metadata fields, dates, catalogue coverage, and permitted use.
- [Massive / ETF Global](https://www.massive.com/blog/announcing-massive-etf-global-partnership-constituents-fund-flows-analytics-profiles-and-taxonomies-2) documents profiles with expense ratios and fund-flow data with NAV. These descriptions do not establish sufficient historical NAV total returns, distributions, median spreads, or official total-return benchmark coverage. Evaluate datasets separately.
- [Vanguard's VOO page](https://advisors.vanguard.com/investments/products/voo/vanguard-sp-500-etf) illustrates issuer fee, benchmark and median-spread disclosures. Similar issuer families may support shared adapters; public display does not establish a supported bulk API.
- [Massive's index documentation](https://massive.com/docs/rest/indices/overview) documents index-level history. Confirm exact symbols, total-return versions, history depth, and usage entitlements before using any series for tracking calculations.

The expensive part is coverage and consistent financial definitions, especially official benchmarks; 200+ ticker records are routine batch-processing scale. A paid provider can reduce adapter maintenance but cannot be assumed to cover every catalogue entry. A public-source-only approach needs more issuer adapters and ongoing maintenance.

First run a read-only coverage audit across the entire catalogue. For every required input, record provider, field, financial date, history length, permitted retention/display, units, and failure reason. Start live sample validation with VOO, VTI, and VXUS, then include a verified sample from every additional family, active and passive variants, short histories and unresolved identities. No family is launch-ready solely because another family passed. Publish actual coverage counts rather than claiming all funds are ready.

Cache shared index series by exact benchmark ID/version so funds tracking the same index reuse one download. Fetch fund inputs with bounded concurrency, pagination, retries, and provider-aware rate limits. Use incremental history updates with a revision overlap. Refresh current metadata and spread disclosures according to source availability; refresh histories after complete month-end data become available. A live source audit found that a two-calendar-day spread limit marks VTI's Oct 2 disclosure stale on Oct 6 even though only one US market session had completed since its source date. Core spread freshness therefore uses a maximum of two completed US trading sessions, counting the current session only after a 15-minute buffer past the regular 4:00 p.m. ET close. The [dated coverage report](etf-core-coverage-2026-10-06.md) records the audit and implementation. Revisit this limit if issuer disclosure cadence or source semantics change.

Retain existing source-authorization gates until evidence supports the selected adapter. No new provider subscription or expenditure is authorized by this document. Once provider access is selected, keep credentials server-side and retain authorized raw history in chunks with source manifests.

## Availability rules

Requirements apply to the selected scorecard and horizon, not the union of every possible scorecard's inputs. Core, Full, cost-only and execution results have independent statuses.

- Every required component must be present, valid, fresh under its configured limit, and sourced before publishing its composite.
- Missing any required input makes that selected composite unavailable. For Full, missing a quality input blocks Full Fund Quality and missing a historical input blocks Full Historical Performance. For Core, missing fee or median spread blocks Cost and Trading; missing a required return observation blocks Historical Outcomes. Show independently complete subscores.
- Full Grand Score requires both complete Full subscores; Core requires complete Core Cost and Trading and Historical Outcomes; execution requires complete cost and fidelity inputs. Never assign 95, substitute zero, estimate missing inputs, or redistribute remaining weights.
- Report distinct reasons: `notApplicable`, `identityUnresolved`, `insufficientHistory`, `missingSource`, `staleInput`, and `invalidInput`. Data coverage is completeness, not confidence or a probability.
- Insufficient rolling history blocks Full, not an independently complete Core variant. Select only explicitly specified 3Y/1Y or 252/60-session variants, retaining their labels and ranking partitions. No silently substituted shorter-history composite.
- Preserve a prior complete run separately when refreshing fails. Display its cutoff and stale status; exclude stale/incompatible runs from current score rankings.
- A mandate change or inconsistent return conventions prevents publication until resolved.

## Code and storage changes

| Area | Change |
|---|---|
| `lib/etfScoring.ts` (existing) | Pure component functions, quality/historical/composite calculation, typed reasons, unrounded results |
| `lib/etfScorecard.ts` (existing) | Versioned Core/Full/execution variants, strategy routing precedence, comparison-group definitions, weights, curves, input contracts and eligibility; no fund-specific scores |
| Provider adapters (new) | Shared normalized metadata, price, NAV, benchmark and spread acquisition interfaces |
| Benchmark registry (new) | Verified effective-dated fund-to-index mappings with evidence; no peer cohort requirement |
| `lib/etfCatalog.ts` | Extend snapshot contracts with scorecard ID, methodology version, common cutoff, statuses and breakdown |
| `lib/etfMetricCalculations.ts` | Reuse existing return/drawdown calculations; add fixed-span rolling summaries and validated tracking inputs |
| `lib/etfMetricStore.ts` | Versioned score snapshots and authorized history manifests; store shared references separately |
| `app/api/etf-metrics/route.ts` | Fetch/validate inputs and publish complete server-calculated runs; remove unconditional score-unavailable stubs only when replaced by real eligibility checks |
| Refresh workflow | Provider-aware batching, common cutoff, retry/failure reporting and coverage audit |
| `components/ETFExplorer.tsx` | Visible Score column with assessment/horizon labels, grouped ranked views, mobile score, Core/Full breakdowns, input/source details and availability reasons |

Read installed Next.js and provider documentation before implementation. Store a per-score run ID, scorecard family/depth/horizon and methodology version, comparison-group ID and evidence, historical cutoff, observation/rolling span counts, input IDs and financial dates, component points, subscore values, coverage and status. Persist Core and Full independently rather than overwriting one generic number. Coverage reports record current numerical availability and ranked eligibility by family and variant. Freeze inputs/configuration used by each run so it can be reproduced.

## UI and export behavior

- Default quantitative columns include Score, assessment type/horizon, comparison group, matched-horizon return and drawdown, fee and data status. Keep column presets/picker and pinned identity.
- Label the assessment, e.g. `Core · Bond IG · 3Y`, `Core · Options income · 1Y · Limited history`, or `Full Grand Score · Equity index · 5Y`. Cost-only and Tactical labels remain explicit. Show a score only with its scale and cutoff. Do not introduce school-grade colors or "good/bad" bands before validating their meaning.
- Display unavailable scores visibly with a concise explanation, so the feature cannot disappear behind a detail drawer.
- Sort unrounded results with unavailable values last and a deterministic ticker tie break, within compatible groups only. Ranking keys include scorecard, depth, horizon, group, methodology and cutoff. All-catalogue Score sorting presents separately labeled groups; no universal rank or automatic winner across groups.
- Detail and Compare show the selected blend, component weights, inputs, formulas, sources, dates, depth limitations and missing dependencies. Explain the difference between Core Cost and Trading and Full Fund Quality. Exposure and risk remain visible.
- CSV includes scores, family/depth/horizon, comparison group, ranked eligibility, component inputs/points, statuses/reasons, financial dates, window/span, source IDs and methodology/run IDs.
- Default entry is “Compare ETFs by investment role,” with broad diversified equity first and other roles accessible. Show stronger/lower-scoring funds within the selected role, complete breakdowns and data freshness. Explain short-history and structural limitations beside the score. Do not introduce “buy/avoid” labels, guaranteed winners or a hidden preference for high yield.
- Display actual coverage near the scores: numerical ETF scores out of all ETF entries, Core/Full versus Tactical counts, limited-history counts and top missing-data reasons. A cost-only badge must not visually resemble a complete score.

## Validation and acceptance

1. Check curve anchors, input units, monotonicity, finite output, numerical stability and bounds. Better growth or lower costs/losses must not worsen the relevant component.
2. Validate missing, stale, malformed and short-history cases; identity and benchmark transitions; dividend/split handling; NAV versus market-price basis; and aligned dates.
3. Verify deterministic independent results: changing table filters, adding another ETF, or reordering records cannot change a fund's score.
4. Reproduce all formulas from retained inputs and compare calculations with verified issuer/provider figures. Use synthetic cases for severe losses, flat/negative returns, unusually high fees and tracking failures.
5. Test multiple historical cutoffs, horizons and every supported family. Assess sensitivity to curve constants, weights, overlapping fee/tracking inputs and small data revisions. Validate behavior rather than targeting familiar winners.
6. Check desktop/mobile discoverability, breakdowns, sorting, Compare and CSV. Run relevant type/lint checks and meaningful calculation tests before committing and pushing implementation changes as required by `AGENTS.md`.
7. Validate routing precedence and verified comparison groups: active bonds must not use the equity card; preferreds stay separate; digital futures do not become spot; leverage and ETN structure override ordinary exposure routing.
8. Verify 1Y and 3Y complete-window selection, 60/252-session execution windows, dividend-heavy total returns, zero downside cases, extreme drawdowns and distribution-policy changes. Never allow mixed depth/horizon/group scores into one ranked list.
9. Produce a catalogue-wide coverage report with the 216-ETF baseline and dynamic denominator. Verify at least 173 current, valid, ranked-eligible numerical scores overall, including at least 156 long-term Core/Full scores among the current 195 non-tactical ETF entries, before declaring the 80% targets achieved. If not achieved, publish actual counts and adapter/source blockers. Separately show long-term Core/Full coverage and limited-history counts.
10. Stress score behavior for a bull-market leveraged fund, high-distribution but declining-total-return income fund, cash-like bond fund, long-duration bond fund and strong-return digital fund. A high result must not erase role, horizon, backing or credit context. Check curve/weight revisions across cutoffs and avoid false precision or target-ticker tuning.

Prior simulation, for arithmetic reference only:

| Fund | Historical score with assumed 4 pp consistency gap | Assumed Quality | Simulated Grand Score |
|---|---:|---:|---:|
| VOO | 66.9335 | 95 | 83.7734 |
| VTI | 64.4782 | 95 | 82.7913 |
| VXUS | 54.6562 | 95 | 78.8625 |

These examples use previously reported 2026-09-30 return/drawdown inputs and then-current fees. They are not validation fixtures for actual fund quality, and must never become runtime defaults. The quality values and consistency gaps were assumed; the mixed-source return conventions were not reconciled.

## Implementation sequence

1. Audit all catalogue records: verified identity/mandate, scorecard route, comparison group, inception/mandate continuity, fee, median spread and authorized 1Y/3Y market total-return coverage. Produce counts and the exact missing dependencies per ticker. Audit Full and execution inputs separately. No provider purchase is authorized by this plan.
2. Prioritize shared fee/spread/market-history adapters for broad Core coverage. Freeze candidate scorecards only after validating a sample in each family, both Core horizons and sensitivity across market cutoffs. Record public-source versus paid-source options and actual entitlement/coverage.
3. Implement normalized adapters, reference/history storage, deterministic routing, comparison groups and pure scoring functions. Store distinct Core/Full/cost-only/execution results with explicit validity and ranking rules. Read relevant installed Next.js guides before writing code.
4. Backfill and publish Core scores across every supported long-term family; use explicitly labeled 1Y variants for newer funds. Add Tactical/ETN execution only where the daily contracts are validated. Report the coverage target and shortfall before calling the rollout complete.
5. Add default visible Score columns, role-based ranked views, depth/horizon labels, mobile breakdowns, matched-frame Compare and CSV. Validate calculation and user flows; commit and push only validated related work as required by `AGENTS.md`.
6. Enrich eligible equity index funds with the original Full Grand Score when official NAV/benchmark coverage is ready. Do not block the Core rollout or merge Full and Core rankings. Reaudit coverage and score stability on subsequent refreshes and catalogue changes.
