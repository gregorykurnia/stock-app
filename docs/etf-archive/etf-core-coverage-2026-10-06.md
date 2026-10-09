# ETF Core free-data coverage — 2026-10-06

## Result

The Core acquisition and assessment path is implemented, but this coverage check publishes **0 of 216 ETF scores** and **0 of 195 non-tactical long-term ETF scores**. The release targets remain 173/216 overall and 156/195 long-term, so the measured shortfalls are 173 and 156 respectively. Three sourced issuer examples also have live-validated and retained Tiingo histories. VTI now has fresh sample inputs but remains `methodologyPending`; VOO and VXUS have stale spreads, and the method is still a candidate.

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
| Tiingo sample histories entitlement-checked and retained | 3 |

## Coverage by catalogue family and horizon

These are the current research-group denominators from the checked-in universe, not verified scorecard assignments. The 21 leveraged/inverse ETFs remain on the Tactical route and are outside long-term Core coverage.

| Catalogue research group | ETFs | Structured issuer inputs | Core 3Y ranked | Core 1Y ranked | Main blocker |
|---|---:|---:|---:|---:|---|
| US broad market and styles | 19 | 2 | 0 | 0 | 17 lack dated mandate/fee/spread inputs; VTI is method-pending and VOO has a stale spread |
| International and global equities | 34 | 1 | 0 | 0 | 33 lack dated inputs; VXUS has complete retained history but a stale spread |
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

Within the 195 non-tactical ETF denominator, 192 have no structured issuer-input bundle. The three Vanguard samples have retained, validated Tiingo history; VTI's spread is fresh by the session rule, while VOO and VXUS remain stale. All 195 still lack a ranked Core score because available inputs are insufficient for frozen, comparable scorecards.

No numerical score is published from the samples. VOO and VXUS have stale spreads; VTI's inputs are fresh but its scorecard methodology remains `candidate`. No inferred or assumed fund rating is used.

## Sample issuer inputs checked

The units below show the adapter boundary: issuer spread percentages are multiplied by 100 to become basis points (`0.01%` becomes `1 bp`). The expense-ratio values remain percentage units (`0.03` means `0.03%`). Financial dates are the dates shown by the issuer, not this report's review date.

| Ticker | Verified issuer facts located | Fee date | 30-day spread disclosure | Spread date | Spread freshness on 2026-10-06 (completed sessions) |
|---|---|---|---:|---|---|
| VOO | Index mandate, S&P 500 exposure, 0.03% expense ratio | 2026-04-28 | 0.004% = 0.4 bp | 2026-09-09 | Stale (age 18 sessions) |
| VTI | Passive total-US-market mandate, 0.03% expense ratio | 2026-04-28 | 0.01% = 1 bp | 2026-10-02 | Fresh (age 1 session) |
| VXUS | Passive international index mandate, 0.05% expense ratio | 2026-02-27 | 0.01% = 1 bp | 2026-09-25 | Stale (age 6 sessions) |

Issuer pages:

- VOO: https://advisors.vanguard.com/investments/products/voo/vanguard-sp-500-etf
- VTI: https://advisors.vanguard.com/investments/products/vti/vanguard-total-stock-market-etf
- VXUS: https://advisors.vanguard.com/investments/products/vxus/vanguard-total-international-stock-etf

These are dated source observations. They do not establish current spread freshness, account tradability, or Tiingo ticker coverage. The page's reported spread can be refreshed through the checked-in issuer-input schema; a live quote cannot replace it.

## Live Tiingo sample validation

After rotating the token, the server-side Tiingo request returned HTTP 200 for VOO, VTI, and VXUS. Each response contained 775 valid daily rows from 2023-09-01 through 2026-10-05, with no malformed rows or duplicate dates. The normal `/api/etf-metrics?provider=tiingo&ticker=...` path retained the histories in Firestore and saved each assessment with a history hash. The read API returned the saved assessments. This is a three-ticker sample, not a catalogue backfill.

All three histories form complete windows through the shared 2026-09-30 cutoff: 37 month-end levels and 36 monthly returns for 3Y, 13 levels and 12 returns for 1Y, with 753 and 252 expected US sessions respectively and zero missing sessions. Tiingo returned 13 rows with dividend or split actions per ticker; those actions still need row-by-row comparison with issuer records.

| Ticker | Tiingo adjusted-close market-price CAGR, 1Y | Tiingo adjusted-close market-price CAGR, 3Y | Max drawdown, 1Y / 3Y | Assessment status after freshness correction |
|---|---:|---:|---:|---|
| VOO | 15.7752% | 22.8513% | 8.8954% / 18.6886% | stale spread |
| VTI | 15.3473% | 22.3304% | 8.9132% / 19.3023% | methodology pending |
| VXUS | 18.6313% | 20.1450% | 11.2715% / 13.5788% | stale spread |

Vanguard reports VTI market-price average annual returns of 15.35% for 1Y and 22.34% for 3Y through 2026-09-30. The Tiingo values differ by -0.0027 and -0.0096 percentage points respectively; the 1Y value agrees at the issuer's displayed precision, while the 3Y value displays as 22.33% versus Vanguard's 22.34%. Record this as a small unresolved reconciliation difference until the endpoint and distribution-reinvestment conventions are confirmed; do not call it an accepted tolerance. The comparison uses Vanguard's [official VTI performance table](https://advisors.vanguard.com/investments/products/vti/vanguard-total-stock-market-etf).

The assessment pipeline now measures spread age in completed US trading sessions. VTI's Oct 2 disclosure is one completed session old at the Oct 6 live API observation and passes the two-session input limit; its assessments remain `methodologyPending` because the curves are not approved for publication. VOO and VXUS are 18 and 6 sessions old respectively and remain `staleInput`. The live API read confirmed the saved assessments and 0/216 numerical coverage. No numerical score is publishable from these three records yet.

## Remaining blockers

| Scope | Current gap | Effect |
|---|---|---|
| Tiingo | Only VOO, VTI, and VXUS have live-validated and retained histories. VTI's return comparison has a 0.0096 percentage-point 3Y difference; VOO/VXUS issuer-return reconciliation and all action-level reconciliation remain open. | The three-ticker test validates access and session completeness only; 213 non-tactical market histories remain untested and unretained. |
| Issuer fees and mandate | Only VOO, VTI, and VXUS have reviewed structured issuer inputs. | The other 213 ETFs have no reusable, dated input bundle and remain unrouted or source-pending. |
| Issuer spreads | VTI is fresh (age 1 completed session); VOO and VXUS are stale (ages 18 and 6 sessions). | VTI reaches `methodologyPending`; stale VOO/VXUS assessments remain unavailable until disclosures are refreshed. |
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
- Issuer spread freshness measured in completed US trading sessions, with a 15-minute buffer after the regular 4:00 p.m. ET close.
- Saved Core and cost-only assessments with source dates, comparison evidence, run IDs, input hashes, explicit gap reasons, and independent score freshness. Legacy metric refreshes preserve them.
- A separate hourly workflow that advances one quota-sized batch and leaves the stored Yahoo refresh authorization separate.

Tiingo's official product page describes Starter as $0/month, internal-use licensed, with 50 hourly requests, 1,000 daily requests, and 1 GB monthly bandwidth. It lists ETF coverage and adjusted prices, dividends, and splits. These general limits do not prove this account's entitlement or coverage for any particular ticker. The API adapter therefore keeps ticker errors and missing sessions as blockers.

## Next acceptance checkpoint

The rotated token and Tiingo EOD entitlement have now been live-checked for VOO, VTI, and VXUS. Next, reconcile returned corporate actions and month-end market-price total returns with issuer disclosures using matched dates and conventions; VTI's 3Y return differs by 0.0096 percentage points at the displayed issuer precision. Record exact values and tolerances in a dated audit before enabling a scorecard variant. Refresh VOO/VXUS spread inputs inside the two-completed-session limit, then expand validated samples by scorecard family and horizon. The catalogue-wide 80% targets remain unmet until actual ranked-ready counts reach 173/216 and 156/195.
