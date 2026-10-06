# ETF quantitative comparison implementation plan

Requested: 2026-10-06. Status: execution plan; no application changes implemented by this document.

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

If the denominator is zero or numerically degenerate, return `undefined` with a reason, not infinity or a huge score. No drawdown can legitimately be zero; Calmar is then undefined. An unrecovered fund remains `unrecovered` with elapsed underwater duration; never replace recovery time with zero. Zero downside deviation makes Sortino undefined. Risk-free input absence disables Sharpe and the default Sortino; an optional zero-MAR Sortino must be labeled as a different methodology.

### Rolling returns

For each complete month-end `t`, calculate a five-year CAGR from `t-60` to `t`, using 61 valid month-end levels. Retain each window's dates and benchmark result. Use linear-interpolated quantiles (`position = (n-1)*p`) for median and P10; report min/max and positive share (`CAGR > 0`). Benchmark win share counts strictly positive paired CAGR gaps; ties are not wins and should be reported separately.

Require at least 12 valid rolling windows to show summary statistics. Five years of data yields just one five-year window and is insufficient for the default summary. In Compare, summarize the same window endpoints for every eligible fund. Show window count and evaluation span beside results. Overlapping windows are correlated: historical positive/win shares are not independent samples or probabilities of future success. Do not attach naive binomial confidence intervals.

## Quantitative selection and ranking

Initial release: sortable individual statistics and matched-date tradeoff comparisons. Do not collapse all metrics into an unexplained weighted score or use arbitrary Sharpe thresholds to declare a fund good.

Later, add a historical tradeoff frontier within verified peer groups. Use matched-period CAGR (higher), volatility (lower), absolute drawdown (lower), and expense ratio (lower). A fund is dominated only when another is no worse on every selected available dimension and better on at least one. Use declared numerical precision/tolerance rules; expose dimensions and the comparison fund. Do not impute missing values or mix currencies/windows. Do not double-count correlated Sharpe/Sortino/Calmar in a composite.

Label outcomes “Historical tradeoff frontier” or “Higher return / larger drawdown,” not “Best to buy.” Lower concentration and larger AUM are context rather than universally better inputs. Suppress frontier labels when fewer than two fully comparable funds exist. Distinguish tiny numeric differences from persuasive evidence; formal significance claims are deferred until a dependence-aware statistical method is designed.

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

Gate: no assumed official benchmark/NAV coverage; each requested metric has an explicit available or blocked input path. Legacy snapshots continue rendering during migration.

### Phase 2 — ratios and consistent periods

Implement shared monthly/daily alignment, expanded cached history, risk-free acquisition, Sharpe, Sortino, Calmar, and corrected period/provenance handling for existing risk statistics. Update server refresh and compact snapshot storage.

Gate: verified risk-free basis and complete matched windows; independent calculation fixtures agree; undefined/unrecovered cases stay distinct. If risk-free access is unresolved, ship Calmar/volatility but keep Sharpe and default Sortino explicitly unavailable; this phase remains partially complete.

### Phase 3 — rolling and benchmark comparisons

Implement rolling distributions, shared-reference CAGR gaps and win shares, common-window comparison cache, and history-span/sample metadata. Fetch official NAV/index series for tracking statistics where verified. Keep proxy comparisons labeled and separate.

Gate: comparisons use identical windows; insufficient rolling history is visible; official tracking metrics never silently use an ETF proxy or market prices.

### Phase 4 — UI and exports

Add presets/picker, metric sorting/filtering, tooltips, matched-period Compare charts, source details, and expanded CSV. Preserve current shortlist behavior and explicitly explain disabled statistics. Add frontier analysis only after peer coverage supports it.

Gate: a user can compare two broad index ETFs and see growth, risk, consistency, expenses, source dates, and missing dependencies without treating unlike windows as a ranking.

### Phase 5 — operations and release audit

Replace fixed scheduler offsets, add run/coverage manifests, complete a production backfill, inspect failures and values against sources, and document ongoing provider costs/limitations. Validate changes, commit only related files, and push the current branch as required by `AGENTS.md`.

## Validation required during implementation

- Calculation fixtures: dividends/splits, identical fund and benchmark, constant returns/zero denominators, negative CAGR, unrecovered drawdown, known Sharpe/Sortino values, sample deviation versus population deviation, downside denominator across all observations, quantile interpolation, rolling ties, short histories, and missing month-ends.
- Independent reference calculation for representative broad-equity, bond, distribution-heavy, and new funds; compare unrounded results with explicit tolerances. Hand-entered test fixtures are allowed; production financial values are fetched.
- Integration: provider partial failure, unavailable NAV/index/risk-free, retries, stale retention, run consistency, old snapshot migration, and a universe change beyond the current batch range.
- UI: numeric sorting including negative values/missing values, column persistence, keyboard accessibility, mobile layout, chart/common-date alignment, and CSV provenance. No same-index grouping from name similarity alone.
- Run relevant lint/type checks, focused tests, and build for implementation changes; `git diff --check` for every delivery. A documentation-only delivery validates links and internal consistency without requiring an application build.

## Source references

These references establish definitions and provider feasibility leads; formulas and policy choices above are this application's explicit methodology, not claims that all providers use identical conventions.

- [Vanguard: tracking difference and tracking error](https://www.vanguard.ca/en/tools-and-resources/etf-fundamentals/management/index-tracking).
- [Yahoo Finance adapter chart implementation](https://github.com/gadicc/yahoo-finance2/blob/dev/src/modules/chart.ts). Consult the installed package version at execution time; the development branch can change.
- [FRED TB3MS: quoted Treasury-bill rate on a discount basis](https://fred.stlouisfed.org/series/TB3MS). This is a yield input, not a directly usable realized monthly return series.
- [SEC: ETF holdings, spreads, NAV premiums/discounts, and costs](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-24).
