# Long Term metric data map

The active column-level label, definition, source category, and reporting period live in `lib/longTermColumns.ts`. This document records the provider-field and missing-data contract used by `app/api/long-term/route.ts`.

| Metric family | Classification | Source / required inputs | Calculation and period | Missing-data behavior |
|---|---|---|---|---|
| Company, sector, industry | Directly sourced | Yahoo `quote` and `assetProfile` | Latest provider snapshot | `Data unavailable` |
| Price and market cap | Directly sourced | Yahoo `quote.regularMarketPrice`, `quote.marketCap` | Latest quote | `Data unavailable` |
| Historical total returns | Calculated from sourced data | Monthly Yahoo `chart.adjclose` | Trailing 1Y/3Y/5Y/10Y; adjusted close is required | `Insufficient history` when the requested window is unavailable; no close-price fallback |
| Rolling returns | Calculated from sourced data | Monthly adjusted-close observations | Overlapping monthly 5Y or 12M windows | `Insufficient history` until a complete window exists |
| VOO comparison | Calculated from sourced data | Date-matched stock and VOO adjusted closes | Matched rolling 5Y windows or trailing 10Y | `Insufficient history` when matched history is too short |
| Drawdown and underwater periods | Calculated from sourced data | Monthly adjusted closes | Full available history; durations are calendar days | `Not yet recovered` for an open maximum-drawdown episode; otherwise `Insufficient history`/`Not meaningful` |
| Volatility | Calculated from sourced data | Up to 61 monthly adjusted-close observations | Sample deviation of monthly returns × √12 | `Insufficient history` below 4.5 years |
| Down-market capture | Calculated from sourced data | Date-matched stock/VOO monthly adjusted closes | Stock return sum / VOO return sum in VOO down months | `Insufficient history` below 12 matched down months |
| Gross and operating margins | Directly sourced | Yahoo `financialData.grossMargins`, `operatingMargins` | Latest provider snapshot | Suspicious or non-finite values become `Calculation error` and are hidden |
| FCF margin | Calculated from sourced data | Yahoo `financialData.freeCashflow`, `totalRevenue` | FCF / revenue from the same response snapshot | Invalid denominator is `Calculation error`; absent inputs are `Data unavailable` |
| Net debt ratios | Calculated from sourced data | Yahoo total debt, total cash, EBITDA or positive FCF | Latest provider snapshot | `N/A` for financial firms; zero/negative denominator is `Not meaningful` |
| P/E and EV/EBITDA | Directly sourced | Yahoo `summaryDetail` / `defaultKeyStatistics` | Latest provider snapshot | `Data unavailable` |
| Price/FCF and FCF yield | Calculated from sourced data | Market cap and positive FCF | Exact reciprocals from identical inputs | Non-positive FCF is `Not meaningful`; inconsistent reciprocals are `Calculation error` |
| Fair values and expected return | Manually entered | Firestore `long_term_analysis` | User-maintained | `Not researched`; never generated automatically |
| Qualitative research and verdict | Manually entered | Firestore `long_term_analysis` | User-maintained | `Not researched`; verdict defaults in the UI to `Not Yet Researched` |
| 3Y/5Y/10Y historical fundamentals | Unsupported | Annual statements are not fetched | No calculation | Hidden until comparable annual fiscal-period inputs are implemented |
| Sortino | Unsupported pending validation | Previous implementation mixed a 5Y CAGR, 4% annual hurdle, and negative monthly-return deviation | No active calculation | Hidden |
| IDR-adjusted return | Unsupported pending matched FX-period validation | Historical USD/IDR and stock series | No active calculation | Hidden |
| Composite/category scores and suggested verdict | Deprecated | Legacy Firestore fields may remain | No active calculation | Excluded from UI and exports |

Data coverage counts only applicable essential quantitative fields. `N/A`, `Not meaningful`, and `Insufficient history` fields are excluded from the denominator; provider failures and calculation errors are not converted to zero.
