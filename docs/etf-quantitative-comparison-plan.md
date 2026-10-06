# ETF quantitative comparison implementation plan

Requested: 2026-10-06. Status: phased implementation in progress as of 2026-10-06. See [the dated coverage and phase report](etf-quantitative-coverage-2026-10-06.md) and [source/readiness manifest](etf-quantitative-readiness.json). Provider-gated benchmarks, risk-free returns, full holdings, scoring, raw-history storage, and matched-date charts are not treated as ready.

## Outcome

Extend `/etf` so users can distinguish ETFs quantitatively beyond CAGR. Include **Sharpe, Sortino, Calmar, rolling returns, benchmark-relative performance, and index tracking quality**, with selectable sortable columns and a comparison view. Fetch financial inputs from providers and calculate statistics on the server. Never hardcode fund returns, ratios, yields, expenses, or rankings.

This extends [the existing ETF page plan](etf-page-plan.md). Keep Explore, Compare, and Shortlist. Preserve all catalogue entries and explicit unresolved identities. Historical statistics describe past outcomes; the UI must not present them as forecasts or universal buy recommendations.

## Current implementation and gaps

| Existing file | Current responsibility | Required extension |
|---|---|---|
| `lib/etfCatalog.ts` | Catalogue, metric keys, snapshot types | Typed metric definitions, benchmark relationships, richer provenance |
| `lib/etfMetricCalculations.ts` | Adjusted-price CAGR, daily drawdown/recovery, monthly volatility, distributions | Shared date alignment, ratios, rolling returns, benchmark statistics |
| `lib/etfReturnDisplay.ts` | Chooses available headline return | Preserve descriptive fallback; prohibit mixed-window ranking |
| `lib/etfMetricStore.ts` | Firestore `etf_metrics` snapshots | Versioned snapshots, shared inputs, comparison cache |
| `app/api/etf-metrics/route.ts` | Authenticated refresh, Yahoo history/fund metadata | Provider adapters, common reference series, staged refresh |
| `.github/workflows/refresh-etf-metrics.yml` | Scheduled batches | Dynamic universe pagination, reference-data refresh, coverage audit |
| `components/ETFExplorer.tsx` | Fixed columns, textual sorting, details, CSV | Column presets, numeric sorting, matched-window Compare, explanations |

Important gaps: history currently starts only about 10.1 years ago; raw history is not persisted; snapshots use fund-level provenance; benchmark and risk-free series are absent. Holdings may be only a provider's top holdings. The workflow has a fixed batch-offset loop. These must be addressed before advanced statistics are treated as comparable.

## Comparison modes

1. **Same index / implementation:** same verified index version, currency, hedging policy, and mandate. Compare NAV tracking difference/error, expenses, spread, and premium/discount. Use returns with matching gross/net dividend treatment. An index name alone is insufficient to establish equivalence.
2. **Similar exposure / different indexes:** verified peer groups such as US broad equity, with style/size differences visible. Compare matched-period growth, risk, consistency, concentration, and a shared comparison benchmark.
3. **Custom comparison:** selected funds may span exposures, but identify differences explicitly. Do not create cross-asset peer rankings.

Store `officialBenchmarkId` separately from `comparisonBenchmarkId`. The first measures mandate implementation; the second provides a common reference. Active funds can have a comparison benchmark without being assigned an index tracking score. Separate leveraged/inverse products, ETNs, options income, commodities, and digital assets from conventional equity peer groups. Current `strategy: core` is too broad to define peers by itself.

## Columns and presentation

Default quantitative preset: fund, peer group, 5Y CAGR, 5Y Sharpe, 5Y maximum drawdown, worst rolling 5Y CAGR, expense ratio, and data status. Offer Growth, Risk, Consistency, and Index efficiency presets plus a persisted column picker. Keep income columns available in the existing view. Desktop uses horizontal scrolling and pinned identity; mobile uses concise cards and expanded metrics.

| Key / label | Display | Direction when comparable | Placement |
|---|---|---|---|
| `cagr5Y`, `cagr10Y` | % annualized | Higher historical growth | Default / Growth |
| `volatility5Y` | % annualized | Lower fluctuations | Risk |
| `sharpe5Y` | Ratio, 2 decimals | Higher excess return per volatility | Default / Risk |
| `sortino5Y` | Ratio, 2 decimals | Higher excess return per downside deviation | Risk |
| `calmar5Y` | Ratio, 2 decimals | Higher CAGR relative to worst loss | Risk |
| `maxDrawdown5Y` | Negative % | Closer to zero | Default / Risk |
| `recoveryTime` | Trading days plus state | Shorter, subject to recovery status | Risk |
| `rolling5YMedianCagr` | % | Higher typical historical window | Consistency |
| `rolling5YP10Cagr` | % | Higher weak-window result | Consistency |
| `rolling5YWorstCagr` | % | Higher worst observed window | Default / Consistency |
| `rolling5YBestCagr` | % | Context; no default winner | Consistency |
| `rolling5YPositiveRate` | % of windows | Higher historical positive share | Consistency |
| `rolling5YBenchmarkWinRate` | % of paired windows | Higher historical benchmark win share | Consistency |
| `benchmarkExcessCagr5Y` | Percentage points/year | Higher relative growth | Growth |
| `trackingDifference5Y` | Percentage points/year | Near target; inspect systematic shortfall | Index efficiency |
| `trackingError5Y` | % annualized | Lower deviation variability | Index efficiency |
| `expenseRatio` | %/year, retain net/gross label | Lower recurring expense | Default / Index efficiency |
| `medianSpread30D` | Basis points | Lower trading friction | Index efficiency, provider gated |
| `premiumDiscount` | Signed %, dated observation | Smaller absolute deviation | Index efficiency, provider gated |
| `topTenWeight` | % of assets | Concentration context; no universal direction | Holdings |
| `netAssets`, `inceptionDate` | Currency / date | Context; no automatic score | Optional |

Reuse existing keys rather than duplicate risk metrics. Support a 5Y/10Y period selector through structured metric periods; initial new keys above describe the 5Y release. A 10Y rolling horizon requires more than 10 years of inputs to produce multiple windows.

Numeric sorting must use unrounded values, put unavailable values last in both directions, preserve deterministic ticker tie breaks, and expose `aria-sort`. A selected 5Y ranking must not substitute 3Y or since-inception results for young funds. CSV includes all selected metrics, units, dates, reference IDs, calculation versions, and states.

Each metric tooltip explains its definition and window. Compare adds aligned wealth and drawdown charts, rolling-return chart, metric differences, benchmark identity, sample counts, and reasons a statistic is unavailable. Show ratios as ratios, return gaps as percentage points, and spreads as basis points.

## Sources and automatic acquisition

Financial values must originate from fetched inputs or server calculations. Configuration may contain provider identifiers, formulas, refresh intervals, validated benchmark mappings, and methodology choices. Such mappings require source evidence and effective dates; do not infer them from ticker/name similarity or embed numeric performance observations.

| Input | Preferred acquisition | Fallback / release rule |
|---|---|---|
| ETF adjusted daily market prices, distributions, splits | Existing `yahoo-finance2.chart` server adapter | Validate adjusted-price behavior; use a compatible licensed feed if unavailable; no raw-price substitution for total return |
| Fees, assets, inception | Existing `quoteSummary`; issuer machine-readable factsheets/downloads for verification | Track net/gross, waiver expiry, as-of dates; missing remains unavailable |
| Historical risk-free returns | Provider series of actual USD Treasury-bill holding-period returns | FRED Treasury-bill yields may support a separately labeled yield-derived proxy only with documented conversion; never treat annual quoted discount yield as monthly realized return |
| Official benchmark total-return levels | Index administrator or licensed historical index feed | A reference ETF can be a labeled comparison proxy; it cannot produce official tracking metrics |
| Historical ETF NAV total-return levels | Issuer historical NAV/distribution files or licensed feed | Market-price series remains usable for investor performance; official NAV tracking metrics stay unavailable |
| Index identity / mandate / hedging | Issuer objective, prospectus, index documentation | Persist sourced mappings for review; unresolved mapping disables index peer comparison |
| Full holdings / sector weights | Issuer holdings CSV/API or licensed feed | Partial top holdings support a labeled lower-bound overlap only; no full diversification claims |
| Historical bid/ask spreads | Issuer reported 30-day median spread or licensed historical quote feed | One live quote is an indicative spread, never a 30-day median |
| Premium/discount | Issuer reported matched NAV/market-price observations | Calculate only from matching valuation dates, currency, share units, and conventions |

Execution starts with a provider feasibility audit: verify credentials, licensing, history depth, units, adjustment definitions, rate limits, coverage, and operational cost. Record choices in a source registry. No provider is assumed to cover every input. API keys belong in server environment variables and GitHub secrets, never client bundles or exported records. Do not scrape protected endpoints or manufacture values when access is unavailable.

Keep adapter interfaces provider independent: `fetchFundHistory`, `fetchFundMetadata`, `fetchBenchmarkHistory`, `fetchRiskFreeReturns`, `fetchNavHistory`, `fetchHoldings`, and `fetchTradingMetrics`. Normalize inputs before calculation; each result includes source, financial date, retrieval timestamp, currency, return convention, coverage, and errors. Verify installed library documentation/types before implementing calls.

## Data contract and storage

Extend snapshots with `schemaVersion`, `calculationVersion`, `runId`, and per-metric records:

```ts
type MetricResult = {
  value: number | null; // unrounded; explicit unit determines scaling
  unit: "percent" | "percentagePoints" | "ratio" | "basisPoints" | "tradingDays";
  status: "available" | "insufficientHistory" | "unavailable" | "notApplicable"
    | "stale" | "invalidInput" | "unrecovered" | "undefined";
  reason?: string;
  startDate: string | null;
  endDate: string | null;
  observations: number;
  sourceIds: string[];
  benchmarkId?: string;
  riskFreeSeriesId?: string;
  methodologyId: string;
};
```

Keep freshness independent from availability where needed: a stale historical value can retain its number and original source date. Record fetched versus verified metadata separately. Include holdings coverage, mandate periods, benchmark versions, date gaps, NAV versus market-price basis, and rolling-window count in snapshot metadata. Ratios/percentiles should not be stored as formatted strings.

Use shared reference collections such as `etf_benchmarks`, `etf_reference_series`, and `etf_source_registry`. Persist normalized raw history in chunked documents or object storage with a manifest; do not put decades of daily prices into one Firestore document. Choose storage after sizing document limits and read/write costs. Serve compact summaries to Explore and fetch charts on demand. Version comparison cache keys by tickers, window, cutoff, references, and methodology.

## Calculation rules

### Alignment and history

- Baseline currency: USD, distributions reinvested, gross of investor-specific taxes/platform fees. Report fund expenses already embedded in returns; do not subtract them again.
- Default cutoff: last completed common month-end. Risk ratios use complete monthly returns; drawdown uses daily observations through that cutoff. Exclude incomplete current months.
- Require 60 aligned monthly returns for 5Y ratios and 120 for 10Y. Use the previous month-end level to form the first return. Do not silently calculate a shorter period under a 5Y label.
- Fetch maximum available genuine fund history, with incremental updates and periodic overlapping backfills for revisions. Five-year rolling analysis defaults to a trailing 15-year observation span, limited by actual fund/mandate history. Display the available span.
- For Compare and peer rankings, intersect dates and use one explicit cohort window. Missing funds become ineligible for that window. If users select a shorter common period, show it clearly; do not shrink other funds' 5Y labels.
- Align fund, benchmark, and risk-free months exactly. No zero filling missing returns, unconstrained forward filling, or using today's risk-free rate for all past months. Apply provider calendars and documented month-end tolerances. Missing expected observations invalidate affected windows.
- Validate positive levels, duplicates, ordering, currency, splits, distributions, and unexplained discontinuities. Do not remove real market losses as outliers. Unresolved identities and incompatible mandate changes block series joins.

### Formula specification

Use decimal simple returns internally: `r[t] = P[t] / P[t-1] - 1`. Use sample standard deviation (denominator `n-1`) except the explicitly defined downside moment below. Annualization assumptions are displayed; serial correlation and non-normal option strategies can limit ratio interpretation.

| Metric | Formula / rule |
|---|---|
| CAGR | `(P[end] / P[start])^(1 / elapsedYears) - 1`; use actual elapsed days / 365.2425 |
| Volatility | `sd(monthly fund returns) * sqrt(12)` |
| Sharpe | With aligned monthly risk-free holding returns `rf[t]`, define `x[t] = r[t] - rf[t]`; `mean(x) / sd(x) * sqrt(12)` |
| Sortino | Default monthly minimum acceptable return `MAR[t] = rf[t]`; `mean(r-MAR) / sqrt(mean(min(r-MAR,0)^2)) * sqrt(12)`. Average downside squares over **all** months, including zero contributions |
| Maximum drawdown | Minimum daily `P[t] / runningPeak[t] - 1` within the stated window, including its starting level |
| Calmar | Same-window CAGR / absolute maximum drawdown; a negative CAGR produces a negative ratio |
| Recovery | Trading intervals from the maximum-drawdown peak to first recovery of that peak; also retain peak/trough/recovery dates |
| Benchmark excess CAGR | Fund CAGR minus shared reference CAGR on identical dates; this is a return gap, not regression alpha |
| Tracking difference | Fund **NAV total-return** CAGR minus official benchmark total-return CAGR, same dates and dividend convention; negative indicates lag |
| Tracking error | `sd(monthly NAV fund return - official benchmark return) * sqrt(12)` |
| Premium/discount | `(marketPrice / NAV - 1) * 100`, with matched source valuations |
| Indicative quoted spread | `(ask-bid) / ((ask+bid)/2) * 10000`; live timestamp required, not interchangeable with issuer median spread |

If the denominator is zero or numerically degenerate, return `undefined` with a reason, not infinity or a huge score. Maximum drawdown may legitimately be zero; Calmar is then undefined. An unrecovered fund remains `unrecovered` with elapsed underwater duration; never replace recovery time with zero. Zero downside deviation makes Sortino undefined. Risk-free input absence disables Sharpe and the default Sortino; an optional zero-MAR Sortino must be labeled as a different methodology.

### Rolling returns

For each complete month-end `t`, calculate a five-year CAGR from `t-60` to `t`, using 61 valid month-end levels. Retain each window's dates and benchmark result. Use linear-interpolated quantiles (`position = (n-1)*p`) for median and P10; report min/max and positive share (`CAGR > 0`). Benchmark win share counts strictly positive paired CAGR gaps; ties are not wins and should be reported separately.

Require at least 12 valid rolling windows to show summary statistics. Five years of data yields just one five-year window and is insufficient for the default summary. In Compare, summarize the same window endpoints for every eligible fund. Show window count and evaluation span beside results. Overlapping windows are correlated: historical positive/win shares are not independent samples or probabilities of future success. Do not attach naive binomial confidence intervals.

## Quantitative selection and ranking

Include an explainable overall score, fund-quality subscore, and historical-performance subscore once the data and peer eligibility gates below pass. Sortable individual statistics and matched-date tradeoff comparisons remain available even when scores are unavailable. Do not use arbitrary Sharpe thresholds to declare a fund good.

Later, add a historical tradeoff frontier within verified peer groups. Use matched-period CAGR (higher), volatility (lower), absolute drawdown (lower), and expense ratio (lower). A fund is dominated only when another is no worse on every selected available dimension and better on at least one. Use declared numerical precision/tolerance rules; expose dimensions and the comparison fund. Do not impute missing values or mix currencies/windows. Do not double-count correlated Sharpe/Sortino/Calmar in a composite.

Label outcomes “Historical tradeoff frontier” or “Higher return / larger drawdown,” not “Best to buy.” Lower concentration and larger AUM are context rather than universally better inputs. Suppress frontier labels when fewer than two fully comparable funds exist. Distinguish tiny numeric differences from persuasive evidence; formal significance claims are deferred until a dependence-aware statistical method is designed.

## Overall scoring methodology

### Purpose and eligible universe

Provide a 0–100 score for comparing conventional unleveraged equity index ETFs **within a verified peer group**. The score combines implementation quality and historical outcomes; it is not a probability of profit, a forecast, or an assessment of whether an exposure fits a particular investor. Methodology version 1 uses proposed product weights, not empirically proven optimal weights. Validate its behavior before release rather than tuning it to make familiar tickers win.

VOO, VXUS, and VT illustrate different roles: US large-cap blend, broad international equity excluding the US, and global all-cap equity. Each can offer a strong implementation of its mandate while producing different historical performance. They belong to different scored cohorts. Never hardcode their scores or assume their ranking from reputation. A 90 in one group and an 85 in another does not establish which region will outperform or which ETF is universally better.

Scoring for bonds, active funds, options income, leveraged/inverse products, ETNs, commodities, and digital assets requires separately specified methodologies and is outside version 1. These entries retain their metrics and show `notApplicable` for this score.

### Weights and component inputs

Convert each input into a peer-relative percentile score using the rules below, then average inputs within a component. Weights are versioned configuration. Financial inputs and results are fetched/calculated, never manually assigned.

| Component | Overall weight | Inputs and within-component weights | Favorable direction |
|---|---:|---|---|
| Cost efficiency | 20% | Net expense ratio 75%; verified 30-day median spread 25% | Lower |
| Index implementation | 20% | Absolute official NAV/index CAGR gap 60%; tracking error 40% | Lower deviation from mandate |
| Diversification within mandate | 20% | Effective holdings count 50%; largest holding weight 25%; largest sector weight 25% | More effective holdings / less concentration, within equivalent mandate |
| Risk-adjusted performance | 20% | Sharpe 50%; Sortino 50% | Higher |
| Return consistency | 10% | Rolling 5Y median CAGR 50%; rolling 5Y P10 CAGR 50% | Higher |
| Drawdown resilience | 10% | Absolute maximum drawdown 70%; fraction of daily observations underwater 30% | Lower |

`fundQualityScore = (costScore + implementationScore + diversificationScore) / 3`.

`historicalPerformanceScore = 0.50 * riskAdjustedScore + 0.25 * consistencyScore + 0.25 * resilienceScore`.

`overallScore = 0.60 * fundQualityScore + 0.40 * historicalPerformanceScore`.

Calmar, headline CAGR, recovery time, rolling benchmark win share, AUM, and fund age remain supporting metrics. Do not add them as extra weighted inputs in version 1. Calmar duplicates growth/drawdown information; AUM and age do not establish quality by themselves. Cost and tracking outcomes also overlap economically, so audit sensitivity to their combined 40% weight and disclose that dependence.

For index implementation, retain signed tracking difference in the explanation, but score absolute deviation from zero. Persistent positive deviation requires investigation of benchmark convention, lending, or replication rather than automatically receiving bonus points. Do not apply this criterion to active strategies.

Diversification is a deliberate preference for broad index building blocks, not a universal investment advantage. Peer groups must have equivalent geography, size/style mandate, currency/hedging, and index weighting approach. Do not penalize a sector fund for failing to diversify outside its sector or compare equal-weight with capitalization-weight mandates under the same quality cohort.

Keep mandate breadth (countries, market segments, and index scope) descriptive and separate from implementation quality. Within a common index, small differences caused by sampling, holdings dates, or rounding must not create large diversification score differences. Align holdings valuation dates and classification conventions; require every scored diversification input to pass a materiality rule before distinguishing funds. Phase 1 sets fixed bins based on source precision and economic relevance, including relative bins for effective holdings count. If all peer differences fall below materiality, assign that input 50 to every member. Quantization boundaries alone must not turn immaterial differences into different scores: merge adjacent bins when their boundary values differ by less than the configured materiality tolerance. Keep raw concentration visible even when scores tie. Do not reward holding extra tiny positions simply for increasing the nominal holdings count.

### Additional data and calculation requirements

- Add `effectiveHoldingsCount = 1 / sum(w[i]^2)` using normalized weights of a complete portfolio and retain reported coverage. Require provider-confirmed full holdings coverage and reconcile rounding/cash using a documented tolerance; top-ten holdings cannot produce this score.
- Add `largestHoldingWeight` and `largestSectorWeight` from verified holdings and a common sector taxonomy. Handle cash and unmapped assets explicitly; missing sector classification blocks the relevant component.
- Add `underwaterObservationRate`: fraction of daily observations below the running total-return peak over the common score window. Equality to the peak is not underwater. This includes ongoing drawdowns without pretending that recovery occurred. Keep recovery time and ongoing underwater duration visible separately.
- Use a common 5Y or 10Y window for ratios, tracking, and drawdown inputs. Rolling 5Y statistics use an identical evaluation span and window endpoints across the scored cohort. The score label includes both the main window and rolling evaluation span.
- Current fees, spreads, and holdings have their own financial dates, displayed separately. Configure and document freshness limits by source during the feasibility audit; inputs outside those limits cannot produce a current score. Never describe current-holdings concentration as historical concentration.

### Percentile normalization and cohort rules

1. Build a persisted cohort from a broader verified provider universe where feasible, then intersect displayed results with the Pluang catalogue. Store `scoringUniverseScope` and source evidence. If only platform-listed funds are available, label scores “Within platform-listed peers”; do not imply a whole-market ranking.
2. Remove duplicate share classes of the same portfolio from the reference cohort using stable portfolio identifiers and a deterministic representative rule. Keep distinct ETF products tracking the same index, since differences in their implementation are relevant. Never deduplicate by name alone.
3. Require at least 10 unique eligible reference portfolios **for the score being calculated**. Overall, quality-only, and history-only eligibility are defined below. Audit actual cohort counts during Phase 1, including broad international and global all-cap groups. This is a versioned launch policy, not a statistical significance threshold. If a valid group has fewer than 10 eligible peers, show direct raw-metric comparisons and `insufficientPeers`; do not broaden into unlike exposures, invent a percentile, or silently lower the minimum. Freeze each cohort/run membership manifest so values are reproducible. Show excluded count and reasons; completeness selection can bias the reference group.
4. Convert every input to a favorable-direction value (negate lower-is-better inputs). Before ranking, apply fixed, unit-specific quantization and materiality rules from the methodology registry. Finalize tolerances after the source precision/uncertainty audit; they must not vary by ticker or be chosen to obtain desired rankings. Persist any merged tie groups and their algorithm version so the result is deterministic.
5. Sort favorable values ascending. With one-based average rank `rank` across ties and cohort size `N`, use `percentileScore = 100 * (rank - 1) / (N - 1)`. An all-tied cohort gives every member 50. Retain raw values and ranks; extremes are not evidence of a large economic advantage.
6. Calculate components and weighted scores from unrounded percentile values; display whole-number scores. Put unavailable scores last when sorting, without substituting zero. Do not label a 0 as a bad investment or a 100 as a perfect investment.

Scores change when peers or methodology change even if a fund's own inputs do not. Explain changes using raw-input changes versus cohort/methodology changes. Never pool scores from different cohort IDs or cutoff dates into a universal winner list.

### Missing data, sensitivity, and reproducibility

- Full overall score requires every weighted input, an eligible peer cohort, compatible periods, and fresh sources. No imputation or redistribution of missing component weights.
- Build three reference cohorts per peer group/window/run: `overall` requires all six components, `qualityOnly` requires the three quality components, and `historyOnly` requires the three performance components. Each cohort independently requires 10 eligible portfolios. Missing NAV/spread/holdings data therefore need not prevent a fully supported standalone historical subscore.
- Overall scores and their breakdown must normalize every input against the **same overall cohort**. Standalone quality/history scores use their respective cohorts and carry distinct cohort IDs. Never combine standalone subscores from different cohorts into an overall score. When showing an overall score, display its own quality/history breakdown in the main columns; otherwise show eligible standalone subscores with “Quality-only peers” / “History-only peers” labels. Persist the basis alongside each displayed subscore.
- Show `provisional` coverage and available raw metrics when required inputs are missing; suppress the overall number. Use explicit reasons including `insufficientPeers`, `missingInput`, `staleInput`, and `incompatibleWindow`. A weighted component cannot be calculated with one of its own inputs missing. Raw metrics remain visible when no reference cohort qualifies.
- Define data coverage as the sum of resolved input weights within overall methodology: e.g. net expense ratio contributes `20% * 75% = 15` percentage points; its missing spread input contributes zero. An input is resolved only when validated, fresh, finite/defined, and period-compatible. Coverage is separate from peer eligibility: 100% data coverage can still have `insufficientPeers`. Do not display coverage as score confidence or a probability.
- Compute sensitivity scenarios with fund-quality/history splits of 50/50, 60/40, and 70/30, preserving weights within each subscore. Show score/rank range; flag a rank movement exceeding 20 percentile points under these scenarios. These thresholds are declared product policies. Historical period sensitivity uses separate 5Y/10Y scores, never mixed-window inputs.
- Store `methodologyVersion`, `cohortId`, membership hash/count, universe scope, cutoff/window dates, rolling span/count, raw-input references, component scores, input ranks, quality/history/overall scores, coverage, status/reasons, and sensitivity outputs. Recompute on coherent refresh runs; keep old versions inspectable.
- Suggested code boundary: a pure `lib/etfScoring.ts` consumes validated metrics plus a cohort/configuration; a server cohort builder resolves eligibility and sources. The UI reads stored results and never recalculates against only currently filtered rows.

### Score columns and explanation panel

Add selectable `overallScore`, `fundQualityScore`, `historicalPerformanceScore`, and `scoreCoverage` columns. Offer a Scoring preset: fund, scored peer group, Overall, Fund quality, Historical performance, Coverage, and data date. A peer selector is required for meaningful score sorting; use grouped results when browsing the full catalogue.

Clicking a score opens its six-component breakdown, raw metrics, weights, percentile standing, sample size, dates, limitations, and sensitivity range. Show provisional reasons directly. Example UI copy may use hypothetical numbers, but production pages must use fetched/calculated results. CSV exports include all score provenance and component values. A high quality score can coexist with modest historical returns; explain that relationship without claiming expected outperformance.

## Refresh and reliability

1. Create a refresh run with a fixed cutoff and methodology version.
2. Resolve universe/mappings and fetch shared benchmark/risk-free inputs once per run.
3. Fetch ETF inputs with bounded concurrency, retries/backoff, incremental history, and revision backfills.
4. Validate normalized data, calculate metrics, and persist per-field outcomes. Preserve last successful values if a source fails, with visible age/error; do not give retained values a new financial date.
5. Build peer/comparison summaries only from compatible run inputs and common cutoffs. Publish coherent run manifests; do not rank a mixture of yesterday's references and today's funds without an explicit alignment check.
6. Publish coverage: requested/updated/failed/skipped identities, eligible 5Y samples, risk-free coverage, benchmark/NAV coverage, rolling eligibility, and stale fields.

Replace `seq 0 12 216` with server-returned `nextOffset`/`remaining` and a stable run universe identifier. The scheduler must fail visibly for incomplete batches or exhausted retries while keeping previous snapshots readable. Refresh history after completed US sessions, ratios at completed month-ends, and metadata/holdings on source-appropriate schedules. Cache and fetch input revisions deliberately; shared-series failures should not trigger hundreds of identical retries.

## Execution phases and gates

### Phase 1 — data feasibility and contracts

Audit sources and existing adjustment behavior. Define peer/index mappings with evidence, adapter interfaces, units, methodology registry, raw-history storage, and migration behavior. Produce a coverage report identifying inputs immediately available versus credential/provider gated. Read relevant installed `node_modules/next/dist/docs/` guides before application code changes.

Required deliverable: a checked-in source/configuration manifest plus a dated coverage report, containing:

- Chosen provider/endpoint and normalized field mapping for each input; sample-response evidence, licensing/cost, credential names (no secret values), and fallback behavior. Identify unavailable inputs explicitly.
- Exact risk-free series and return basis; if yield-derived, its conversion formula, timing convention, and proxy label. Record compatible NAV/index dividend conventions and corporate-action checks.
- Peer membership rules and counts before/after quality-only, history-only, and overall eligibility. Keep small valid groups unscored rather than changing their economic meaning.
- Numerical freshness limits, allowable cross-fund metadata date differences, complete-holdings reconciliation thresholds, month-end calendar tolerances, and per-input score quantization/materiality rules.
- Deterministic rolling evaluation-span selection, storage sizing/location, migration mapping for existing metric keys versus structured periods, retry policy, and run-publishing behavior. For a fixed scoring cohort, use the latest common contiguous month-end history ending at the run cutoff, capped at 15 years, with at least 12 rolling windows; record which portfolios are excluded and why before freezing membership.
- A metric readiness matrix: `ready`, `blockedByProvider`, or `blockedByPolicy`, plus each dependency and release phase. Scoring weights stay as proposed until source coverage and sensitivity review confirm the release methodology version.

Gate: no assumed official benchmark/NAV coverage. Downstream work for a metric begins only when its source, normalization, and policy entries are concrete and `ready`; blocked metrics retain explicit UI states. An overall-score release requires all its input paths and cohort rules ready. Legacy snapshots continue rendering during migration. This plan authorizes phased execution once requested; it does not claim that provider selection or full scoring coverage is already complete.

### Phase 2 — ratios and consistent periods

Implement shared monthly/daily alignment, expanded cached history, risk-free acquisition, Sharpe, Sortino, Calmar, and corrected period/provenance handling for existing risk statistics. Update server refresh and compact snapshot storage.

Gate: verified risk-free basis and complete matched windows; independent calculation fixtures agree; undefined/unrecovered cases stay distinct. If risk-free access is unresolved, ship Calmar/volatility but keep Sharpe and default Sortino explicitly unavailable; this phase remains partially complete.

### Phase 3 — rolling and benchmark comparisons

Implement rolling distributions, shared-reference CAGR gaps and win shares, common-window comparison cache, and history-span/sample metadata. Fetch official NAV/index series for tracking statistics where verified. Keep proxy comparisons labeled and separate.

Gate: comparisons use identical windows; insufficient rolling history is visible; official tracking metrics never silently use an ETF proxy or market prices.

### Phase 4 — UI and exports

Add presets/picker, metric sorting/filtering, tooltips, matched-period Compare charts, source details, and expanded CSV. Implement versioned cohort scoring, score columns/breakdowns, coverage, and sensitivity after source gates pass. Preserve current shortlist behavior and explicitly explain disabled statistics. Add frontier analysis only after peer coverage supports it.

Gate: a user can compare two broad index ETFs and see growth, risk, consistency, expenses, source dates, and missing dependencies without treating unlike windows as a ranking. Scores are reproducible within their cohort and unavailable when required inputs or peer counts are insufficient. No hardcoded fund scores or score-based cross-cohort winners.

### Phase 5 — operations and release audit

Replace fixed scheduler offsets, add run/coverage manifests, complete a production backfill, inspect failures and values against sources, and document ongoing provider costs/limitations. Validate changes, commit only related files, and push the current branch as required by `AGENTS.md`.

## Validation required during implementation

- Calculation fixtures: dividends/splits, identical fund and benchmark, constant returns/zero denominators, negative CAGR, unrecovered drawdown, known Sharpe/Sortino values, sample deviation versus population deviation, downside denominator across all observations, quantile interpolation, rolling ties, short histories, and missing month-ends.
- Independent reference calculation for representative broad-equity, bond, distribution-heavy, and new funds; compare unrounded results with explicit tolerances. Hand-entered test fixtures are allowed; production financial values are fetched.
- Integration: provider partial failure, unavailable NAV/index/risk-free, retries, stale retention, run consistency, old snapshot migration, and a universe change beyond the current batch range.
- UI: numeric sorting including negative values/missing values, column persistence, keyboard accessibility, mobile layout, chart/common-date alignment, and CSV provenance. No same-index grouping from name similarity alone.
- Scoring: weights sum to 100%; component/subscore formulas agree; favorable directions, average-rank ties/all-tied cohorts, quantization, duplicate share classes, cohort minimums, missing/stale inputs, full versus partial holdings, and sensitivity scenarios behave as specified. Changing a search filter must not change stored scores. Independently review correlated inputs and cohort selection bias; do not tune fixtures or weights to favor VOO/VXUS/VT.
- Readiness/scoring edge cases: small global-equity cohorts produce `insufficientPeers`; full historical inputs with missing NAV can produce a standalone history score if its own cohort qualifies; standalone cohorts cannot be blended into an overall score; 100% data coverage does not bypass the peer minimum. Immaterial same-index holdings differences and values straddling bin boundaries tie under the persisted materiality rule. Maximum drawdown zero remains a valid raw value with undefined Calmar.
- Run relevant lint/type checks, focused tests, and build for implementation changes; `git diff --check` for every delivery. A documentation-only delivery validates links and internal consistency without requiring an application build.

## Source references

These references establish definitions and provider feasibility leads; formulas and policy choices above are this application's explicit methodology, not claims that all providers use identical conventions.

- [Vanguard: tracking difference and tracking error](https://www.vanguard.ca/en/tools-and-resources/etf-fundamentals/management/index-tracking).
- [Yahoo Finance adapter chart implementation](https://github.com/gadicc/yahoo-finance2/blob/dev/src/modules/chart.ts). Consult the installed package version at execution time; the development branch can change.
- [FRED TB3MS: quoted Treasury-bill rate on a discount basis](https://fred.stlouisfed.org/series/TB3MS). This is a yield input, not a directly usable realized monthly return series.
- [SEC: ETF holdings, spreads, NAV premiums/discounts, and costs](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-24).
