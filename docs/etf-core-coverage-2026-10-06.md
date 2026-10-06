# ETF Core free-data coverage — 2026-10-06

## Result

The Core acquisition and assessment path is implemented, but this first coverage check publishes **0 of 216 ETF scores** and **0 of 195 non-tactical long-term ETF scores**. The release targets remain 173/216 overall and 156/195 long-term, so the measured shortfalls are 173 and 156 respectively. The three sourced examples below are issuer-input fixtures for adapter validation; they do not count as scores.

| Measure | Result |
|---|---:|
| ETF entries | 216 |
| ETNs, tracked separately | 3 |
| Exclusions, tracked separately | 3 |
| Tactical ETFs | 21 |
| Non-tactical ETFs | 195 |
| Current ranked Core 3Y scores | 0 |
| Current ranked Core 1Y scores | 0 |
| Published cost-only scores | 0 |
| Equity-index issuer-input samples recorded | 3 |
| Tiingo histories entitlement-checked and retained | 0 |

## Coverage by catalogue family and horizon

These are the current research-group denominators from the checked-in universe, not verified scorecard assignments. The 21 leveraged/inverse ETFs remain on the Tactical route and are outside long-term Core coverage.

| Catalogue research group | ETFs | Structured issuer inputs | Core 3Y ranked | Core 1Y ranked | Main blocker |
|---|---:|---:|---:|---:|---|
| US broad market and styles | 19 | 2 | 0 | 0 | 17 lack dated mandate/fee/spread inputs; sample spreads are stale and Tiingo history is unvalidated |
| International and global equities | 34 | 1 | 0 | 0 | 33 lack dated inputs; the sample spread is stale and Tiingo history is unvalidated |
| Sector and thematic equities | 59 | 0 | 0 | 0 | Mandate, active/passive state, comparison groups, fee/spread sources and history are unverified |
| Dividend equities | 7 | 0 | 0 | 0 | Dividend objective, grouping and required issuer inputs are unverified |
| Real estate and infrastructure equities | 5 | 0 | 0 | 0 | Asset type, mandate, grouping and required issuer inputs are unverified |
| Fixed income and preferred securities | 28 | 0 | 0 | 0 | Credit, duration, rate type, preferred status and required issuer inputs are unverified |
| Options income and distribution strategies | 20 | 0 | 0 | 0 | Option mandate, coverage, tenor, leverage and distribution policy are unverified |
| Physical precious metals | 7 | 0 | 0 | 0 | Metal, backing, custody and required issuer inputs are unverified |
| Commodity futures | 12 | 0 | 0 | 0 | Basket, direction, roll method and collateral conventions are unverified |
| Spot digital asset trusts | 2 | 0 | 0 | 0 | Asset, backing/custody and required issuer inputs are unverified |
| Digital asset futures | 1 | 0 | 0 | 0 | Futures strategy, roll method and required issuer inputs are unverified |
| Multi-asset allocation | 1 | 0 | 0 | 0 | Allocation mix, objective and required issuer inputs are unverified |
| Leveraged and inverse ETFs | 21 | 0 | n/a | n/a | Separate Tactical inputs are not implemented |

Within the 195 non-tactical ETF denominator, 192 have no structured issuer-input bundle and the three Vanguard samples lack current spreads and retained Tiingo histories. That leaves all 195 without a ranked Core score at this checkpoint.

No score is published from the sample fees and spreads: their issuer inputs are either outside the plan's two-calendar-day spread freshness window or still need current revalidation, and the scorecard methodology remains `candidate`. No inferred or assumed fund rating is used.

## Sample issuer inputs checked

The units below show the adapter boundary: issuer spread percentages are multiplied by 100 to become basis points (`0.01%` becomes `1 bp`). The expense-ratio values remain percentage units (`0.03` means `0.03%`). Financial dates are the dates shown by the issuer, not this report's review date.

| Ticker | Verified issuer facts located | Fee date | 30-day spread disclosure | Spread date | Spread freshness on 2026-10-06 |
|---|---|---|---:|---|---|
| VOO | Index mandate, S&P 500 exposure, 0.03% expense ratio | 2026-04-28 | 0.004% = 0.4 bp | 2026-09-09 | Stale |
| VTI | Passive total-US-market mandate, 0.03% expense ratio | 2026-04-28 | 0.01% = 1 bp | 2026-10-02 | Stale under the two-day rule |
| VXUS | Passive international index mandate, 0.05% expense ratio | 2026-02-27 | 0.01% = 1 bp | 2026-09-25 | Stale |

Issuer pages:

- VOO: https://advisors.vanguard.com/investments/products/voo/vanguard-sp-500-etf
- VTI: https://advisors.vanguard.com/investments/products/vti/vanguard-total-stock-market-etf
- VXUS: https://advisors.vanguard.com/investments/products/vxus/vanguard-total-international-stock-etf

These are dated source observations. They do not establish current spread freshness, account tradability, or Tiingo ticker coverage. The page's reported spread can be refreshed through the checked-in issuer-input schema; a live quote cannot replace it.

## Remaining blockers

| Scope | Current gap | Effect |
|---|---|---|
| Tiingo | Rotation and account entitlement have not been confirmed for this run. No request was made. | No authorized sample history, action reconciliation, ticker coverage, or daily-session completeness result is claimed. |
| Issuer fees and mandate | Only VOO, VTI, and VXUS have reviewed structured issuer inputs. | The other 213 ETFs have no reusable, dated input bundle and remain unrouted or source-pending. |
| Issuer spreads | The three sample windows are stale under the plan's two-day input freshness rule. | Core and cost-only calculations remain unavailable even when market history is present. |
| Methodology | Core family/horizon curves are still candidates. | Complete inputs return `methodologyPending`; they do not publish a numeric rating until family-specific sensitivity review is approved. |
| Comparison groups | Sample groups use different geographies and exposures. | VOO, VTI, and VXUS do not form a shared ranked peer group merely because they are broad equity ETFs. |
| Remaining families | No structured, source-reviewed facts are loaded for active/dividend/real-asset equity, bonds, preferreds, options income, metals, futures, spot digital assets, or allocation funds. | Their scorecard families remain candidate and their route-specific input reasons must be resolved before rankings. |
| Tactical and ETN | 21 leveraged/inverse ETFs and 3 ETNs need separate execution inputs; 3 exclusions remain out of the ETF denominator. | They do not receive a Core equity formula or contribute to the long-term target. |

## Implemented path

- Server-only Tiingo EOD adapter; the token is sent in an authorization header and never returned in API responses.
- Separate `ETF_TIINGO_AUTOMATION_AUTHORIZED` gate; Yahoo's authorization flag is unchanged.
- Year-partitioned retained history with raw close, adjusted close, cash distributions, split factor, fetch time, and reproducible hashes.
- Incremental overlap refresh, full-window re-fetch after newly observed corporate actions, a persistent cursor, and a 40-request hourly safety budget under Tiingo Starter's documented 50/hour ceiling.
- Core 1Y/3Y monthly return, daily drawdown, downside-deviation, freshness, and US trading-session completeness checks.
- Saved Core and cost-only assessments with source dates, comparison evidence, run IDs, input hashes, explicit gap reasons, and independent score freshness. Legacy metric refreshes preserve them.
- A separate hourly workflow that advances one quota-sized batch and leaves the stored Yahoo refresh authorization separate.

Tiingo's official product page describes Starter as $0/month, internal-use licensed, with 50 hourly requests, 1,000 daily requests, and 1 GB monthly bandwidth. It lists ETF coverage and adjusted prices, dividends, and splits. These general limits do not prove this account's entitlement or coverage for any particular ticker. The API adapter therefore keeps ticker errors and missing sessions as blockers.

## Next acceptance checkpoint

After the user confirms that the replacement token is configured and the account's EOD entitlement is active, run VOO, VTI, and VXUS first. Compare returned corporate actions and month-end market-price total returns with issuer disclosures using matched dates and conventions. Reconcile exact values and tolerances in a dated audit before enabling a scorecard variant. Refresh issuer spread inputs inside their freshness limit, then repeat coverage by scorecard family and horizon. The catalogue-wide 80% targets remain unmet until actual ranked-ready counts reach 173/216 and 156/195.
