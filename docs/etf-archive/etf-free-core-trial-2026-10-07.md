# Free Core trial — VOO and VXUS

Requested and run on 2026-10-07 Asia/Jakarta (2026-10-06 UTC). This trial implements the user's simplified free-data proposal for exactly VOO and VXUS. It is available at `/etf/free-core-trial`, linked from `/etf`. It has its own snapshots and immutable history chunks; these experimental numbers do not enter the existing Core/Full rankings or release-coverage counts.

## Method

```text
Free Core trial = (0.30 × FeePoints + 0.40 × HistoricalOutcomes) / 0.70
FeePoints = 100 × exp(-annualNetFeePct / 0.50)
HistoricalOutcomes = 100 × (GrowthPoints / 100)^0.40
                           × (DrawdownPoints / 100)^0.35
                           × (DownsidePoints / 100)^0.25
GrowthPoints = 100 / (1 + exp(-(annualizedReturnPct - 8) / 4))
DrawdownPoints = 100 / (1 + (maxDrawdownMagnitudePct / 25)^2)
DownsidePoints = 100 / (1 + (annualizedDownsideDeviationPct / 15)^2)
```

The fixed final weights are 3/7 annual-fee efficiency and 4/7 historical outcomes. The current Core's spread contribution is removed for both funds rather than adjusted individually when an input is missing. No bid/ask quote, assumed median spread, benchmark tracking score or reputation value enters the formula. This trial measures fees and past outcomes, not Full Fund Quality or expected returns.

Shared historical calculations are reused from `lib/etfScoring.ts`. CAGR annualizes the compounded monthly returns by actual endpoint days divided by 365.2425; it does not assume that the interval between trading endpoints is exactly three calendar years. Drawdown uses adjusted daily levels over those same endpoints. Downside uses every monthly return and a zero monthly minimum acceptable return. Dividends are already in adjusted prices and are not added a second time.

The fee inputs remain [Vanguard's VOO disclosure](https://advisors.vanguard.com/investments/products/voo/vanguard-sp-500-etf) (0.03%, dated 2026-04-28) and [Vanguard's VXUS disclosure](https://advisors.vanguard.com/investments/products/vxus/vanguard-total-international-stock-etf) (0.05%, dated 2026-02-27), checked against official issuer search results on 2026-10-07. Fund identity and investment roles use the existing sourced issuer bundle. VOO and VXUS have distinct US-large-cap and international-ex-US roles, so this page does not present them as a common ranked peer group.

## Live results

Both histories came from **Yahoo Finance**, without using the Tiingo fallback. Yahoo returned 776 daily rows per fund from 2023-09-01 through 2026-10-06, 13 dividend events per fund, and no split events. The common cutoff is **2026-09-30**. Both funds have 37 month-end levels / 36 returns / 753 daily sessions for 3Y, and 13 levels / 12 returns / 252 sessions for 1Y, with no missing sessions. The saved reproduction run was captured at 2026-10-06 23:17:39 UTC; the corresponding SHA-256 history hashes are VOO `0d77d97bb541e11e61a1498cdc115cf86c5ce7ad40e3ecf1f26200784e1391e1` and VXUS `9ce837a26a47c5c73bae40126ab242dd62c843bfdaf79934f548f77b88b59e9f`.

| Fund | Horizon | Trial score / 100 | Fee points | Historical points | CAGR | Max drawdown magnitude | Downside deviation |
|---|---|---:|---:|---:|---:|---:|---:|
| VOO | 3Y | 87.3512 | 94.1765 | 82.2323 | 22.8172% | 18.6894% | 5.4040% |
| VOO | 1Y | 90.8730 | 94.1765 | 88.3954 | 15.7782% | 8.9005% | 5.1738% |
| VXUS | 3Y | 87.9605 | 90.4837 | 86.0681 | 20.1202% | 13.5800% | 6.3039% |
| VXUS | 1Y | 87.5035 | 90.4837 | 85.2683 | 18.6594% | 11.2738% | 8.3624% |

The original spread-dependent Core remains candidate. These scores are explicitly experimental results for a separately versioned method (`equity-index-free-core-trial-v1-3y` / `-1y`), not a freeze of every scorecard family.

## Provider comparison

Using the retained Tiingo histories and the same trial formula/endpoints, Yahoo minus Tiingo differences were:

| Fund | Horizon | Score difference | CAGR difference (percentage points) | Drawdown difference (percentage points) |
|---|---|---:|---:|---:|
| VOO | 3Y | -0.001888 | -0.004686 | +0.000780 |
| VOO | 1Y | -0.010329 | -0.008318 | +0.005023 |
| VXUS | 3Y | -0.001014 | +0.000733 | +0.001121 |
| VXUS | 1Y | +0.001753 | +0.014627 | +0.002308 |

The maximum observed score difference is approximately 0.0104 points. Provider agreement is a cross-check, not proof of issuer-return convention equivalence or validation for other fund families. Minor revisions could change the last displayed decimal; the page rounds scores to one decimal and retains full precision in storage.

## Run and storage

With Node 22 or newer and the existing Firebase configuration:

```sh
npm run trial:etf
```

The runner fetches both Yahoo histories, validates fees/currency/rows/windows, calculates both horizons, and saves complete snapshots in `etf_free_core_trials`. Provider bars stay in Firestore under immutable per-run year chunks in `etf_free_core_trial_history`; raw provider histories and secrets are not committed. A SHA-256 history hash, source URLs, retrieval and fee dates, retained inputs, and method IDs make each run inspectable. The runner reads the stored history back, checks its hash, and reproduces every result before reporting success.

If Yahoo fails or returns invalid data, the runner can use the previously retained Tiingo window only if it passes the same freshness and completeness checks. It records the actual provider and does not mix series. Incomplete refreshes preserve the previous complete trial snapshot. Page reads use saved results and make no Yahoo/Tiingo or AI calls. This is a manually rerunnable trial; no new recurring job or paid feed is introduced.

## Acceptance scope

Validate independent arithmetic from retained adjusted-price endpoints; growth/fee directions and score bounds; missing sessions, duplicate dates, malformed prices, wrong currency and stale/future retrieval; 1Y/3Y labels; source-specific reproduction; the saved desktop/mobile page; relevant type/lint checks and production build. Broader launch still requires reviewing the new weights across market cutoffs, stress regimes and each intended fund family, then expanding sourced fees and mandates beyond these two samples. Two successful samples do not establish catalogue-wide coverage.
