# ETF quantitative comparison coverage — 2026-10-06

## Audit result

Phase 1 is implemented as a checked-in readiness manifest at [etf-quantitative-readiness.json](etf-quantitative-readiness.json). The audit found no licensed market-history source, realized risk-free return series, official benchmark history, issuer NAV history, full holdings feed, historical spread feed, or verified peer mapping configured in this application. The existing Yahoo Finance adapter is operational, but its automated-use permission, price-adjustment behavior, coverage, and redistribution rights are not evidenced here. The new calculations keep those requirements visible and do not create benchmark mappings or score outputs from ticker names.

The app now calculates complete-window CAGR, annualized sample monthly volatility, daily maximum drawdown and recovery, Calmar, underwater observation rate, and rolling five-year summaries from the current adjusted-price input where the window requirements are met. Rolling summaries require 12 windows and use linear-interpolated P10 and median. The current history request is capped at 10.1 years, so the configured 15-year rolling evaluation span cannot be reached for longer-lived funds. Sharpe and Sortino remain unavailable without aligned monthly risk-free holding-period returns.

New scheduled refresh requests are gated off by default. The API requires `ETF_YAHOO_AUTOMATION_AUTHORIZED=true` in its server environment, and the workflow requires the same repository variable before it sends a request. Set this only after Yahoo automation permission is documented. The gate preserves existing snapshots while preventing the scheduled job from making new requests until then.

## Source readiness

| Input | Source currently present | Readiness | Release limitation |
|---|---|---|---|
| Adjusted market history and distributions | Existing `yahoo-finance2.chart` adapter | `blockedByPolicy` | Yahoo's terms restrict automated data collection without express prior permission. No permission or data license is recorded. The adapter's adjusted-price and corporate-action behavior has not been independently checked. |
| Expense ratio, assets, inception, top holdings | Existing `yahoo-finance2.quoteSummary` adapter | `blockedByPolicy` | Provider values are fetched, not issuer-verified. Holdings are partial; field financial dates and share-class AUM meaning are not consistently available. |
| Risk-free monthly holding returns | None | `blockedByProvider` | FRED TB3MS is a monthly average of annualized discount-basis yields, not a realized monthly holding return. It is not used as one. |
| Official benchmark total returns | None | `blockedByProvider` | No source, license, benchmark versions, or effective-dated mandate mappings are configured. |
| ETF NAV total returns | None | `blockedByProvider` | Market-price returns cannot substitute for NAV tracking difference or tracking error. |
| Full holdings and sector weights | None | `blockedByProvider` | Current top-holdings data cannot support effective holdings count or a full diversification score. |
| Historical median spread / matched premium-discount | None | `blockedByProvider` | No historical quote feed or matched NAV/market-price observations are available. |
| Verified peer cohorts | None | `blockedByPolicy` | No sourced memberships are configured; scoring requires at least 10 eligible portfolios in the same verified cohort. |

The local `yahoo-finance2` 3.15.4 chart declarations show `date`, `close`, optional `adjclose`, and distribution/split events. This verifies the adapter's field contract only. It is not a retained live sample response, entitlement, license, or proof of total-return adjustment behavior. Yahoo's general terms currently prohibit automated collection without prior permission; resolve that with a licensed source or explicit permission before expanding or releasing the automated comparison data product. The FRED series notes identify TB3MS as a monthly average of business-day discount-basis yields, which is why it does not enter the Sharpe or Sortino calculations.

References: [installed Yahoo Finance chart contract](https://github.com/gadicc/yahoo-finance2/blob/dev/src/modules/chart.ts), [Yahoo Terms of Service](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html), [FRED TB3MS notes](https://fred.stlouisfed.org/series/TB3MS), [Firestore storage sizing](https://firebase.google.com/docs/firestore/storage-size).

## Implemented in this change

- Added schema version 2, calculation and per-ticker run IDs, numeric metric results, units, states, reasons, observation dates/counts, source IDs, methodology IDs, and fetched-versus-issuer-verified metadata state. Old snapshots still render without a migration job.
- Changed 1Y, 3Y, 5Y, and 10Y return windows to use complete monthly observations through the last completed UTC month. Missing monthly observations do not get filled or silently bridged.
- Added the Calmar ratio, underwater observation rate, recovery peak/trough/recovery dates, elapsed open-underwater duration, and five-year rolling median/P10/worst/best/positive-rate calculations.
- Added explicit unavailable records for risk-free, benchmark, NAV, full-holdings, spread, premium/discount, and score dependencies.
- Added Quantitative, Growth, Risk, Consistency, Index efficiency, and Income presets with a persisted custom metric picker. Numeric sorting uses unrounded results and keeps unavailable values last in either sort direction. Five-year CAGR sorting no longer falls back to shorter or since-inception history.
- Expanded CSV output for the selected metrics with unit, state, period, sample count, source/reference IDs, and methodology version.
- Added metric definitions and provenance to the detail panel, and changed Compare copy to say that individual 5Y periods are not a matched-date ranking. The existing colors, card styles, table layout, mobile cards, Explore/Compare/Shortlist navigation, shortlist behavior, and pinned ticker column are retained.
- Added bounded per-ticker retries and changed the scheduled refresh workflow to follow API `nextOffset`, verify a stable universe ID across batches, and fail on failed or incomplete batches.

## Still gated by the source audit

- Persisted normalized raw price history, atomic full-run reference manifests, and on-demand aligned comparison cache/API. The current source has no approved retention or redistribution terms, so raw series are not added to Firestore and comparison charts are not enabled.
- User-selected comparison-reference excess returns and rolling win shares. A market-price proxy may be used only when it is explicit and sourced; it cannot be called official tracking.
- Sharpe and Sortino until an actual matched monthly risk-free holding-return series is chosen.
- Official tracking difference/error until NAV and official index total-return sources share dates and dividend conventions.
- Score computation, score columns, and tradeoff-frontier labels. There are zero verified peer mappings today; the minimum cohort is 10. Quantization/materiality policies remain blocked until source precision and full-holdings uncertainty are reviewed.
- Full holdings concentration, spreads, and premium/discount until issuer or licensed historical feeds provide complete dated inputs.

## Provisional policies recorded for the next source review

- Market history freshness: 5 days; expense ratio financial date: 365 days; assets: 90 days; full holdings: 45 days; spread observations: 2 days; NAV/premium-discount observations: 1 day.
- Cross-peer metadata dates may differ by at most 30 days; full-holdings dates by 7 days. Month-end observations must be within 3 calendar days and every expected month must exist.
- A full holdings set must reconcile to 99–101% after documented cash and rounding treatment. This range is provisional until a provider precision audit.
- Rolling horizon: 60 monthly returns and 61 levels per window; use the latest 180 months of evaluation endpoints, limited by actual series history; require 12 windows before showing summaries.
- Firestore Standard documents have a 1 MiB maximum. The target is yearly history chunks in a separate collection or object storage, with chart reads on demand. Measure serialized sizes, indexes, and cost before enabling retention.
- Refresh policy: up to three attempts per ticker, 500 ms and 1,000 ms backoff, two workers, 12 records maximum per batch. Successful snapshots retain per-ticker run IDs; a cross-fund coherent scoring run is not published.
- Score tie tolerances and materiality are not finalized. Display precision is documented but will not be reused as a scoring threshold.

## Phase status

| Phase | State |
|---|---|
| 1. Data feasibility and contracts | Audit and metric contract checked in; source selection, live sample evidence, licensing, and raw-history storage are gated. |
| 2. Ratios and consistent periods | Implemented where current adjusted price inputs suffice. Sharpe and Sortino remain unavailable; source approval is pending. |
| 3. Rolling and benchmark comparisons | Rolling summaries implemented where at least 12 windows exist. Benchmark excess, paired win rates, aligned charts, and official tracking remain gated. |
| 4. UI and exports | Presets, column picker, numeric sorting, metric definitions, provenance, exports, and explicit missing-input states implemented. Scoring and matched-date charts remain gated. |
| 5. Operations and release audit | Dynamic pagination, run-universe checks, bounded retries, and failure reporting implemented. A licensed backfill and source-value audit remain outstanding. |
