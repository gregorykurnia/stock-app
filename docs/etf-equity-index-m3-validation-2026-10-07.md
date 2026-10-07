# ETF scoring M3 validation report · 2026-10-07

Validation snapshot evaluated at 2026-10-07T06:00:24.801Z using method equity-index-free-core-trial-v1 at common market cutoff 2026-09-30; per-ticker history retrieval timestamps are retained in the artifact. This is experimental validation evidence, not approval for Browse funds publication or a rank across unlike mandates.

## Frozen sample and source contract

- Frozen sample: equity-index-m3-sample-v1; SHA-256 bbe0ad71f1477b214ae80d99df2cf11e875ef80ccbcf88fe77b226ba959b5853 (validated against the committed sidecar before history requests).
- Sample: 12 funds from 4 issuers; U.S. broad equity 4; Developed ex-U.S. 4; Broad international ex-U.S. 4.
- Excluded all M1 funds: VOO, VTI, IVV, ITOT, SCHB, VXUS, VEA, IXUS.
- Price input: Yahoo Finance adjusted closes in USD; dividends and splits are already reflected in adjclose. Retrieval and latest-session limits are five calendar days.
- Official identity, mandate, index, issuer domain, fee, dated net/gross designation, and peer grouping were recorded before history acquisition in the [frozen manifest](../data/etf-equity-index-m3-sample-v1.json).

## Current-cutoff coverage

The candidate uses current net fees and exact 12/36 monthly returns from 13/37 month-end endpoints, with complete daily U.S. equity-session coverage. Scores are shown to one decimal only.

| Stratum | Ticker | Index | Net fee | Fee date | Latest bar | 1Y | 3Y | Peer treatment |
|---|---|---|---:|---|---|---:|---:|---|
| U.S. broad equity | SPYM | S&P 500 Index | 0.0200% | 2026-07-09 | 2026-10-06 | 91.7 | 88.1 | sp500 |
| U.S. broad equity | SPY | S&P 500 Index | 0.0945% | 2026-07-09 | 2026-10-06 | 86.0 | 82.4 | sp500 |
| U.S. broad equity | SPTM | S&P Composite 1500 Index | 0.0300% | 2026-07-09 | 2026-10-06 | 90.8 | 87.1 | unranked-pending-peer |
| U.S. broad equity | SCHX | Dow Jones U.S. Large-Cap Total Stock Market Index | 0.0300% | 2026-08-27 | 2026-10-06 | 90.4 | 87.0 | unranked-pending-peer |
| Developed ex-U.S. | IEFA | MSCI EAFE IMI Index (Net) | 0.0700% | 2026-08-31 | 2026-10-06 | blocked: Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. | blocked: Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. | unranked-pending-peer |
| Developed ex-U.S. | EFA | MSCI EAFE Index (Net) | 0.3200% | 2026-08-31 | 2026-10-06 | blocked: Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. | blocked: Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. | unranked-pending-peer |
| Developed ex-U.S. | SCHF | FTSE Developed ex US Index (Net) | 0.0300% | 2026-08-27 | 2026-10-06 | 89.4 | 89.4 | unranked-pending-peer |
| Developed ex-U.S. | SPDW | S&P Developed Ex-U.S. BMI Index | 0.0300% | 2026-07-09 | 2026-10-06 | 89.1 | 89.3 | unranked-pending-peer |
| Broad international ex-U.S. | ACWX | MSCI ACWI ex-US Index (Net) | 0.3200% | 2026-08-31 | 2026-10-06 | blocked: Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. | blocked: Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. | msci-acwi-ex-us-large-mid |
| Broad international ex-U.S. | CWI | MSCI ACWI ex USA Index | 0.3000% | 2026-07-09 | 2026-10-06 | 72.2 | 72.7 | msci-acwi-ex-us-large-mid |
| Broad international ex-U.S. | VEU | FTSE All-World ex US Index | 0.0400% | 2026-02-27 | 2026-10-06 | 88.3 | 88.7 | unranked-pending-peer |
| Broad international ex-U.S. | VSGX | FTSE Global All Cap ex US Choice Index | 0.1000% | 2025-12-19 | 2026-10-06 | 82.6 | 83.9 | unranked-pending-peer |

## Blocked rows and historical windows

The capture included 12/12 Yahoo history payloads. Yahoo/source-capture validity across the preregistered sample: **pass**. Independent return blockers and incomplete historical windows are reported separately; no invalid score is substituted.

| Ticker | Cutoff | Horizon | Classification | Result | Reason |
|---|---|---|---|---|---|
| SPYM | 2019-12-31 | 1Y | market-window sensitivity only | 94.5 | Current fee held constant; not a point-in-time historical score. |
| SPYM | 2019-12-31 | 3Y | market-window sensitivity only | 83.7 | Current fee held constant; not a point-in-time historical score. |
| SPYM | 2020-03-31 | 1Y | market-window sensitivity only | blocked | Known index/mandate transition on 2020-01-24 falls inside the 2019-03-29–2020-03-31 window. |
| SPYM | 2020-03-31 | 3Y | market-window sensitivity only | blocked | Known index/mandate transition on 2020-01-24 falls inside the 2017-03-31–2020-03-31 window. |
| SPYM | 2022-12-30 | 1Y | market-window sensitivity only | 43.8 | Current fee held constant; not a point-in-time historical score. |
| SPYM | 2022-12-30 | 3Y | market-window sensitivity only | blocked | Known index/mandate transition on 2020-01-24 falls inside the 2019-12-31–2022-12-30 window. |
| SPYM | 2024-12-31 | 1Y | market-window sensitivity only | 94.6 | Current fee held constant; not a point-in-time historical score. |
| SPYM | 2024-12-31 | 3Y | market-window sensitivity only | 73.2 | Current fee held constant; not a point-in-time historical score. |
| SPY | 2019-12-31 | 1Y | market-window sensitivity only | 88.8 | Current fee held constant; not a point-in-time historical score. |
| SPY | 2019-12-31 | 3Y | market-window sensitivity only | 78.3 | Current fee held constant; not a point-in-time historical score. |
| SPY | 2020-03-31 | 1Y | market-window sensitivity only | 42.8 | Current fee held constant; not a point-in-time historical score. |
| SPY | 2020-03-31 | 3Y | market-window sensitivity only | 58.0 | Current fee held constant; not a point-in-time historical score. |
| SPY | 2022-12-30 | 1Y | market-window sensitivity only | 38.1 | Current fee held constant; not a point-in-time historical score. |
| SPY | 2022-12-30 | 3Y | market-window sensitivity only | 60.8 | Current fee held constant; not a point-in-time historical score. |
| SPY | 2024-12-31 | 1Y | market-window sensitivity only | 88.9 | Current fee held constant; not a point-in-time historical score. |
| SPY | 2024-12-31 | 3Y | market-window sensitivity only | 67.4 | Current fee held constant; not a point-in-time historical score. |
| SPTM | 2019-12-31 | 1Y | market-window sensitivity only | 93.5 | Current fee held constant; not a point-in-time historical score. |
| SPTM | 2019-12-31 | 3Y | market-window sensitivity only | 82.3 | Current fee held constant; not a point-in-time historical score. |
| SPTM | 2020-03-31 | 1Y | market-window sensitivity only | blocked | Known index/mandate transition on 2020-01-24 falls inside the 2019-03-29–2020-03-31 window. |
| SPTM | 2020-03-31 | 3Y | market-window sensitivity only | blocked | Known index/mandate transition on 2020-01-24 falls inside the 2017-03-31–2020-03-31 window. |
| SPTM | 2022-12-30 | 1Y | market-window sensitivity only | 43.1 | Current fee held constant; not a point-in-time historical score. |
| SPTM | 2022-12-30 | 3Y | market-window sensitivity only | blocked | Known index/mandate transition on 2020-01-24 falls inside the 2019-12-31–2022-12-30 window. |
| SPTM | 2024-12-31 | 1Y | market-window sensitivity only | 93.5 | Current fee held constant; not a point-in-time historical score. |
| SPTM | 2024-12-31 | 3Y | market-window sensitivity only | 72.0 | Current fee held constant; not a point-in-time historical score. |
| SCHX | 2019-12-31 | 1Y | market-window sensitivity only | 93.7 | Current fee held constant; not a point-in-time historical score. |
| SCHX | 2019-12-31 | 3Y | market-window sensitivity only | 83.2 | Current fee held constant; not a point-in-time historical score. |
| SCHX | 2020-03-31 | 1Y | market-window sensitivity only | 47.2 | Current fee held constant; not a point-in-time historical score. |
| SCHX | 2020-03-31 | 3Y | market-window sensitivity only | 62.4 | Current fee held constant; not a point-in-time historical score. |
| SCHX | 2022-12-30 | 1Y | market-window sensitivity only | 42.6 | Current fee held constant; not a point-in-time historical score. |
| SCHX | 2022-12-30 | 3Y | market-window sensitivity only | 64.9 | Current fee held constant; not a point-in-time historical score. |
| SCHX | 2024-12-31 | 1Y | market-window sensitivity only | 93.6 | Current fee held constant; not a point-in-time historical score. |
| SCHX | 2024-12-31 | 3Y | market-window sensitivity only | 71.3 | Current fee held constant; not a point-in-time historical score. |
| IEFA | 2019-12-31 | 1Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| IEFA | 2019-12-31 | 3Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| IEFA | 2020-03-31 | 1Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| IEFA | 2020-03-31 | 3Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| IEFA | 2022-12-30 | 1Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| IEFA | 2022-12-30 | 3Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| IEFA | 2024-12-31 | 1Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| IEFA | 2024-12-31 | 3Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| EFA | 2019-12-31 | 1Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| EFA | 2019-12-31 | 3Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| EFA | 2020-03-31 | 1Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| EFA | 2020-03-31 | 3Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| EFA | 2022-12-30 | 1Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| EFA | 2022-12-30 | 3Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| EFA | 2024-12-31 | 1Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| EFA | 2024-12-31 | 3Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| SCHF | 2019-12-31 | 1Y | market-window sensitivity only | 93.1 | Current fee held constant; not a point-in-time historical score. |
| SCHF | 2019-12-31 | 3Y | market-window sensitivity only | 76.4 | Current fee held constant; not a point-in-time historical score. |
| SCHF | 2020-03-31 | 1Y | market-window sensitivity only | 43.6 | Current fee held constant; not a point-in-time historical score. |
| SCHF | 2020-03-31 | 3Y | market-window sensitivity only | 52.6 | Current fee held constant; not a point-in-time historical score. |
| SCHF | 2022-12-30 | 1Y | market-window sensitivity only | 43.9 | Current fee held constant; not a point-in-time historical score. |
| SCHF | 2022-12-30 | 3Y | market-window sensitivity only | 56.3 | Current fee held constant; not a point-in-time historical score. |
| SCHF | 2024-12-31 | 1Y | market-window sensitivity only | 69.3 | Current fee held constant; not a point-in-time historical score. |
| SCHF | 2024-12-31 | 3Y | market-window sensitivity only | 58.6 | Current fee held constant; not a point-in-time historical score. |
| SPDW | 2019-12-31 | 1Y | market-window sensitivity only | 93.1 | Current fee held constant; not a point-in-time historical score. |
| SPDW | 2019-12-31 | 3Y | market-window sensitivity only | 76.4 | Current fee held constant; not a point-in-time historical score. |
| SPDW | 2020-03-31 | 1Y | market-window sensitivity only | 43.4 | Current fee held constant; not a point-in-time historical score. |
| SPDW | 2020-03-31 | 3Y | market-window sensitivity only | 52.3 | Current fee held constant; not a point-in-time historical score. |
| SPDW | 2022-12-30 | 1Y | market-window sensitivity only | 43.5 | Current fee held constant; not a point-in-time historical score. |
| SPDW | 2022-12-30 | 3Y | market-window sensitivity only | 55.8 | Current fee held constant; not a point-in-time historical score. |
| SPDW | 2024-12-31 | 1Y | market-window sensitivity only | 70.0 | Current fee held constant; not a point-in-time historical score. |
| SPDW | 2024-12-31 | 3Y | market-window sensitivity only | 57.6 | Current fee held constant; not a point-in-time historical score. |
| ACWX | 2019-12-31 | 1Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| ACWX | 2019-12-31 | 3Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| ACWX | 2020-03-31 | 1Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| ACWX | 2020-03-31 | 3Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| ACWX | 2022-12-30 | 1Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| ACWX | 2022-12-30 | 3Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| ACWX | 2024-12-31 | 1Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| ACWX | 2024-12-31 | 3Y | market-window sensitivity only | blocked | Independent return evidence differs from Yahoo adjusted-close return by more than 0.25 percentage points; scoring for this fund is blocked pending source/convention reconciliation. |
| CWI | 2019-12-31 | 1Y | market-window sensitivity only | 75.8 | Current fee held constant; not a point-in-time historical score. |
| CWI | 2019-12-31 | 3Y | market-window sensitivity only | 60.0 | Current fee held constant; not a point-in-time historical score. |
| CWI | 2020-03-31 | 1Y | market-window sensitivity only | 26.5 | Current fee held constant; not a point-in-time historical score. |
| CWI | 2020-03-31 | 3Y | market-window sensitivity only | 35.8 | Current fee held constant; not a point-in-time historical score. |
| CWI | 2022-12-30 | 1Y | market-window sensitivity only | 26.9 | Current fee held constant; not a point-in-time historical score. |
| CWI | 2022-12-30 | 3Y | market-window sensitivity only | 38.5 | Current fee held constant; not a point-in-time historical score. |
| CWI | 2024-12-31 | 1Y | market-window sensitivity only | 60.0 | Current fee held constant; not a point-in-time historical score. |
| CWI | 2024-12-31 | 3Y | market-window sensitivity only | 42.0 | Current fee held constant; not a point-in-time historical score. |
| VEU | 2019-12-31 | 1Y | market-window sensitivity only | 91.8 | Current fee held constant; not a point-in-time historical score. |
| VEU | 2019-12-31 | 3Y | market-window sensitivity only | 75.8 | Current fee held constant; not a point-in-time historical score. |
| VEU | 2020-03-31 | 1Y | market-window sensitivity only | 42.6 | Current fee held constant; not a point-in-time historical score. |
| VEU | 2020-03-31 | 3Y | market-window sensitivity only | 51.7 | Current fee held constant; not a point-in-time historical score. |
| VEU | 2022-12-30 | 1Y | market-window sensitivity only | 42.9 | Current fee held constant; not a point-in-time historical score. |
| VEU | 2022-12-30 | 3Y | market-window sensitivity only | 54.7 | Current fee held constant; not a point-in-time historical score. |
| VEU | 2024-12-31 | 1Y | market-window sensitivity only | 74.3 | Current fee held constant; not a point-in-time historical score. |
| VEU | 2024-12-31 | 3Y | market-window sensitivity only | 57.7 | Current fee held constant; not a point-in-time historical score. |
| VSGX | 2019-12-31 | 1Y | market-window sensitivity only | 88.1 | Current fee held constant; not a point-in-time historical score. |
| VSGX | 2019-12-31 | 3Y | market-window sensitivity only | blocked | Incomplete 3Y monthly/daily window at 2019-12-31: expected 36 monthly returns and complete session coverage. Complete adjusted-price history and valid historical outcome components are required. |
| VSGX | 2020-03-31 | 1Y | market-window sensitivity only | 38.8 | Current fee held constant; not a point-in-time historical score. |
| VSGX | 2020-03-31 | 3Y | market-window sensitivity only | blocked | Incomplete 3Y monthly/daily window at 2020-03-31: expected 36 monthly returns and complete session coverage. Complete adjusted-price history and valid historical outcome components are required. |
| VSGX | 2022-12-30 | 1Y | market-window sensitivity only | 37.5 | Current fee held constant; not a point-in-time historical score. |
| VSGX | 2022-12-30 | 3Y | market-window sensitivity only | 49.2 | Current fee held constant; not a point-in-time historical score. |
| VSGX | 2024-12-31 | 1Y | market-window sensitivity only | 70.3 | Current fee held constant; not a point-in-time historical score. |
| VSGX | 2024-12-31 | 3Y | market-window sensitivity only | 50.8 | Current fee held constant; not a point-in-time historical score. |

All four earlier market cutoffs hold the currently sourced fee constant and are **market-window sensitivity only**, even if a fee document date precedes that cutoff. No point-in-time applicability history was established. All 32 unresolved M1 historical fee rows remain blocked.

## Independent calculations and integrity

- Separate reference implementation independently rebuilt daily session coverage, month endpoints, 1Y/3Y returns, CAGR, drawdown, downside deviation, component points and final scores for 82 scored rows. Status: **pass**; maximum absolute delta 2.842170943040401e-14; tolerance 1e-10.
- All scored outputs within [0, 100]: **pass**.
- Integrity contract: equity-index-integrity-v2, canonical-json-key-order-v1, SHA-256. Raw retained JSON text was reparsed and replayed before report generation: **passed**; 120 horizon/cutoff rows; artifact hash b08d1cc98074e75b26e28c1cf44d89367cd0132117bbe0aa611c40a88cf837df.
- The artifact stores complete source profiles, Yahoo provenance and full adjusted-close histories; canonical hashing covers metadata, scoring parameters, every fund, every row input and every row result.

## Invalid-input fixtures

All targeted source and history rejection fixtures: **pass**.

| Fixture | Rejected | Expected blocker |
|---|---:|---|
| stale-fee | yes | Net expense evidence dated 2025-09-01 is future-dated or older than 365 days. |
| gross-only-fee | yes | A dated, official-source net expense ratio is required; gross-only, missing or invalid fees are blocked. |
| expired-waiver | yes | The fee waiver has expired or has an invalid expiry date. |
| unreviewed-domain | yes | Official issuer domain was not explicitly reviewed for this registered ticker. Identity evidence is not HTTPS on the reviewed issuer domain. Mandate evidence is not HTTPS on the reviewed issuer domain. Fee evidence is not HTTPS on the reviewed issuer domain. |
| missing-history | yes | Yahoo Finance history request failed: fixture: no response Yahoo Finance adjusted-price history is unavailable for SPYM. |
| wrong-currency | yes | Yahoo history currency is EUR; USD-denominated adjusted prices are required. Yahoo adjusted history is not ordered by session date. |
| duplicate-date | yes | Yahoo adjusted history contains duplicate session date 2026-10-06. |
| invalid-close | yes | Yahoo adjusted history contains an invalid date or nonpositive/missing adjusted close. |
| out-of-order-history | yes | Yahoo adjusted history is not ordered by session date. |
| future-date | yes | Yahoo adjusted history contains future session 2026-10-08. Latest Yahoo price observation 2026-10-08 is future-dated or older than 5 days. |
| short-history | yes | 3Y monthly and daily coverage is incomplete for a one-observation history. |
| missing-session | yes | The complete expected-session check identifies the omitted 2026-09-29 session. |

## Sensitivity and interpretation

Replayed the frozen M1 one-factor grid of 37 configurations without changing the method. Score bounds include all scored funds and all 37 scenarios. Pair-order checks use only preregistered same-index groups; all other funds remain unranked.

| Horizon | Scores in grid | Score bounds | Same-index pairs | Pair orders changed | Baseline pairs tied at 1 decimal | CAGR/downside correlation | Drawdown/downside correlation |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1Y | 333 | 66.2–93.3 | 1 | 0 | 0 | 0.959 | 0.988 |
| 3Y | 333 | 66.5–91.9 | 1 | 0 | 0 | -0.857 | -0.935 |

Risk components can overlap. These experimental points do not establish predictive value, future returns, a winner, universal rank, quality grade, or a score band. Distinct indexes share exposure strata for coverage, not benchmark identity.

## Independent return evidence and operational feasibility

Matched-window comparison: 2025-08-29–2026-08-31 for 1Y and 2023-08-31–2026-08-31 for 3Y. Yahoo adjusted-close returns are recomputed from retained endpoint values; comparison tolerance is 0.25 percentage points. Market-price/Market Value total return is compared without adding distributions a second time.

| Ticker | Provider/source | 1Y source / Yahoo / delta | 3Y source / Yahoo / delta | Check |
|---|---|---|---|---|
| SPYM | [State Street SPYM Fund Performance](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-portfolio-sp-500-etf-spym) (official-issuer) | 20.28% / 20.29% / 0.01 pp | 21.01% / 21.00% / -0.01 pp | matched where available |
| SPY | [State Street SPY Fund Performance](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-sp-500-etf-trust-spy) (official-issuer) | 20.17% / 20.23% / 0.06 pp | 20.90% / 20.92% / 0.02 pp | matched where available |
| SPTM | [State Street SPTM Fund Performance](https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-portfolio-sp-1500-composite-stock-market-etf-sptm) (official-issuer) | 20.14% / 20.12% / -0.02 pp | 20.44% / 20.42% / -0.02 pp | matched where available |
| SCHX | [Schwab SCHX performance](https://www.schwabassetmanagement.com/products/schx) (official-issuer) | 19.56% / 19.56% / 0.00 pp | 20.92% / 20.92% / -0.00 pp | matched where available |
| IEFA | [iShares IEFA performance](https://www.ishares.com/us/products/244049/ishares-core-msci-eafe-etf) (official-issuer) | 19.85% / 21.47% / 1.62 pp | 16.52% / 18.32% / 1.80 pp | discrepancy |
| IEFA | [Schwab/Morningstar IEFA performance](https://www.schwab.wallst.com/Prospect/Research/etfs/performance.asp?symbol=iefa) (independent-provider) | 21.50% / 21.47% / -0.03 pp | 18.30% / 18.32% / 0.02 pp | matched where available |
| EFA | [iShares EFA performance](https://www.ishares.com/us/products/239623/ishares-msci-eafe-etf) (official-issuer) | 20.19% / 21.48% / 1.29 pp | 16.34% / 18.18% / 1.84 pp | discrepancy |
| EFA | [Schwab/Morningstar EFA performance](https://www.schwab.wallst.com/Prospect/Research/etfs/performance.asp?symbol=efa) (independent-provider) | 21.50% / 21.48% / -0.02 pp | 18.20% / 18.18% / -0.02 pp | matched where available |
| SCHF | [Schwab SCHF performance](https://www.schwabassetmanagement.com/products/schf) (official-issuer) | 28.57% / 28.59% / 0.02 pp | 20.61% / 20.61% / -0.00 pp | matched where available |
| SPDW | [State Street SPDW Fund Performance](https://www.ssga.com/us/en/institutional/etfs/state-street-spdr-portfolio-developed-world-ex-us-etf-spdw) (official-issuer) | 27.90% / 27.85% / -0.05 pp | 20.61% / 20.64% / 0.03 pp | matched where available |
| ACWX | [iShares ACWX performance](https://www.ishares.com/us/products/239594/ishares-msci-acwi-ex-us-etf) (official-issuer) | 28.29% / 26.73% / -1.56 pp | 18.92% / 19.99% / 1.07 pp | discrepancy |
| ACWX | [Schwab/Morningstar ACWX performance](https://www.schwab.wallst.com/Prospect/Research/etfs/performance.asp?symbol=acwx) (independent-provider) | 26.70% / 26.73% / 0.03 pp | 20.00% / 19.99% / -0.01 pp | matched where available |
| CWI | [State Street CWI Fund Performance](https://www.ssga.com/us/en/institutional/etfs/state-street-spdr-msci-acwi-ex-us-etf-cwi) (official-issuer) | 26.39% / 26.56% / 0.17 pp | 20.44% / 20.47% / 0.03 pp | matched where available |
| VEU | [Schwab/Morningstar VEU performance](https://www.schwab.wallst.com/Prospect/Research/etfs/performance.asp?symbol=veu) (independent-provider) | 26.40% / 26.45% / 0.05 pp | 20.00% / 20.05% / 0.05 pp | matched where available |
| VSGX | [Vanguard VSGX performance](https://advisors.vanguard.com/investments/products/vsgx/vanguard-esg-international-stock-etf) (official-issuer) | 27.53% / 27.53% / -0.00 pp | 20.22% / 20.20% / -0.02 pp | matched where available |

- Reconciliation review: 12/12 funds compared; matched 9; discrepancies: IEFA, EFA, ACWX; unavailable: none.
- The iShares official market-price table differs from both the retained Yahoo endpoint calculation and a second provider's rounded market-price return for IEFA, EFA and ACWX. Their 1Y/3Y and historical-window score rows are blocked pending source/convention reconciliation. The second provider agrees with Yahoo to its displayed precision, but does not explain the issuer conflict.
- VEU's static Vanguard source capture did not expose matched 3Y market-price return; the dated independent-provider table supplies both horizons. This limitation is retained in the evidence record.
- The capture confirms technical Yahoo chart access for this sample only. It does not establish permission to use or retain provider data; M4 must resolve permitted use, durable retention and refresh limits.

## M3 gate status: passed for restricted validation; M4 may begin separately

- Sample minimums: 12/12 funds, 4/3 issuers, four per required stratum: pass.
- Independent scored rows: pass; score range: pass; invalid fixtures: pass; independent return reconciliation: complete.
- Return-source discrepancies block IEFA, EFA, ACWX; remaining coverage meets the minimum two funds per stratum/horizon.
- Two independently reproduced funds per stratum and horizon: U.S. broad equity 4/2 1Y, 4/2 3Y; Developed ex-U.S. 2/2 1Y, 2/2 3Y; Broad international ex-U.S. 3/2 1Y, 3/2 3Y.
- The M3 gate does not publish these experimental scores to Browse funds. M4 remains a separate milestone.

## Source links

- **SPYM** (S&P 500 Index): [issuer source](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-portfolio-sp-500-etf-spym) · [fee evidence](https://www.ssga.com/library-content/products/fund-docs/etfs/us/information-schedules/spdr-etf-listing.pdf)
- **SPY** (S&P 500 Index): [issuer source](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-sp-500-etf-trust-spy) · [fee evidence](https://www.ssga.com/library-content/products/fund-docs/etfs/us/information-schedules/spdr-etf-listing.pdf)
- **SPTM** (S&P Composite 1500 Index): [issuer source](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-portfolio-sp-1500-composite-stock-market-etf-sptm) · [fee evidence](https://www.ssga.com/library-content/products/fund-docs/etfs/us/information-schedules/spdr-etf-listing.pdf)
- **SCHX** (Dow Jones U.S. Large-Cap Total Stock Market Index): [issuer source](https://www.schwabassetmanagement.com/products/schx) · [fee evidence](https://www.schwabassetmanagement.com/product-finder?combine=schx)
- **IEFA** (MSCI EAFE IMI Index (Net)): [issuer source](https://www.ishares.com/us/products/244049/IEFA) · [fee evidence](https://www.ishares.com/us/products/etf-investments)
- **EFA** (MSCI EAFE Index (Net)): [issuer source](https://www.ishares.com/us/products/239623/ishares-msci-eafe-etf) · [fee evidence](https://www.ishares.com/us/products/etf-investments)
- **SCHF** (FTSE Developed ex US Index (Net)): [issuer source](https://www.schwabassetmanagement.com/products/schf) · [fee evidence](https://www.schwabassetmanagement.com/product-finder?combine=schf)
- **SPDW** (S&P Developed Ex-U.S. BMI Index): [issuer source](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-portfolio-developed-world-ex-us-etf-spdw) · [fee evidence](https://www.ssga.com/library-content/products/fund-docs/etfs/us/information-schedules/spdr-etf-listing.pdf)
- **ACWX** (MSCI ACWI ex-US Index (Net)): [issuer source](https://www.ishares.com/us/products/239594/ishares-msci-acwi-ex-us-etf) · [fee evidence](https://www.ishares.com/us/products/etf-investments)
- **CWI** (MSCI ACWI ex USA Index): [issuer source](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-msci-acwi-ex-us-etf-cwi) · [fee evidence](https://www.ssga.com/library-content/products/fund-docs/etfs/us/information-schedules/spdr-etf-listing.pdf)
- **VEU** (FTSE All-World ex US Index): [issuer source](https://advisors.vanguard.com/investments/products/veu/vanguard-ftse-all-world-ex-us-etf) · [fee evidence](https://advisors.vanguard.com/investments/products/veu/vanguard-ftse-all-world-ex-us-etf)
- **VSGX** (FTSE Global All Cap ex US Choice Index): [issuer source](https://advisors.vanguard.com/investments/products/vsgx/vanguard-esg-international-stock-etf) · [fee evidence](https://advisors.vanguard.com/investments/products/vsgx/vanguard-esg-international-stock-etf)

Full retained data: [M3 validation artifact](../data/etf-equity-index-m3-validation-2026-10-07.json). Return evidence inputs: [dated comparison sources](../data/etf-equity-index-m3-return-evidence-2026-10-07.json). Frozen sample: [manifest](../data/etf-equity-index-m3-sample-v1.json) · [SHA-256](../data/etf-equity-index-m3-sample-v1.sha256).
