# ETF ranking Phase 0: access and coverage · 2026-10-09

Part of the [blank-slate ranking plan](../../etf-blank-slate-ranking-plan.md), Phase 0. Per-fund detail: [phase0-coverage-2026-10-09.csv](phase0-coverage-2026-10-09.csv).

## Result

| Check | Result |
|---|---|
| Catalogue entries requested | 222 (BIL is one of them) |
| Entries with valid daily history | **222 of 222** |
| Duplicate dates | 0 |
| Rows with non-positive close or adjusted close | 0 |
| Latest session older than 2026-10-01 | 0 (latest observed session 2026-10-08) |
| Daily volume present | Yes, in every file |
| Funds with at least 3 years (36 months) of history at the 2026-09-30 cutoff | **201** |
| Funds with at least 5 years (60 months) | **188** |
| Funds with at least 10 years (120 months) | **159** |
| Funds below 3 years | 21 (listed below) |
| Gaps longer than 5 calendar days | 31 funds, all from one event (see Gaps) |

Horizon counts are calendar-based only. They ignore eligibility rules in the plan's Section 5 (legal form, identity, fee, AUM), which Phase 1 applies.

## Funds below 3 years of history

IBIT, TEM, FNGU, MSTY, QDTE, AIPO, MSTU, FEPI, NUKZ, BITU, AIPI, BTCO, YMAX, XDTE, USOI, YMAG, RDTE, GPTY, NVDW, MSTZ, QDTY.

These are mostly leveraged, income-option and crypto products launched since 2023. Under the plan they are "Too new", or in the separate leveraged list.

## Gaps

All 31 funds with a gap longer than 5 calendar days show the same gap: **2001-09-11 to 2001-09-17**, when U.S. exchanges were closed after 9/11. It's a real market closure, not a data error. The ranking code must treat known exchange closures as expected, not as missing data.

## Data source and method

- Endpoint: Tiingo daily EOD prices, `startDate=2000-01-01`, `endDate=2026-10-09`. Adjusted close is used for returns, per the plan.
- One request per symbol, paced at 90 seconds (40 per hour), the same limit the existing code uses.
- Raw JSON, 176 MB across 222 files, is kept **outside the repository** in the session scratchpad. It is not committed. Only this report and the CSV are committed.
- Coverage analysis script and raw files: session scratchpad, not committed.

## Problems found and fixed during the pull

- **22 fetches timed out** while the response body was downloading, at the 30-second request limit. The fetch code had already recorded the HTTP status (200) before the body finished, so the log showed success for symbols that had no file. The progress file records the timeouts. All 22 were retried. The last 6 were retried with a 2-minute limit and two attempts each, and all succeeded on the first attempt. Final count: 222 files, all valid JSON.
- **The first job was killed** with exit code 144 and restarted. The restart resumed from the saved files and did not re-fetch them. A later pass finished the list with the 22 timeouts above.

**Note for Phase 3:** the production fetch must check the saved file after the body has been read and must use a longer timeout for the body. It must not log success before the body is confirmed.

## Limits check (public pricing page, 2026-10-09)

Checked against [Tiingo's pricing page](https://www.tiingo.com/about/pricing):

- Starter (free): 500 unique symbols per month, 50 requests per hour, 1,000 per day, 1 GB bandwidth per month. These match the figures recorded on 2026-10-06.
- The pull used about 250 requests, under the daily limit and paced at 40 per hour. No throttling or rate-limit errors occurred. Raw data totals 176 MB, within the 1 GB monthly bandwidth.
- The page does not clearly list EOD data as included on Starter. The EOD endpoint did return data for all 222 symbols on this account, so it is available in practice.
- **License:** Starter is marked "Internal Use Only." Tiingo defines this as data for your own personal use, and says you may not display or share the data with another person or organization.

**Check on the account page:** the public page confirms the limits, but your account's own limits are not shown in the API responses. A quick look at the Tiingo dashboard would confirm them.

## Not verified

- **Volume consolidation.** Tiingo's volume is present, but whether it covers all venues is not confirmed. This affects the liquidity measure (plan Section 10, item 6).

## Phase 0 exit

- Coverage report written, with every symbol's first date and gap status: **done**.
- Limits checked against the public page and observed in practice: **done**. Confirming them on the account page is still recommended.
- Open decision: whether the app's output (scores, rankings) can be shown to anyone besides you. Under the Starter license, sharing is not permitted. See the plan, Section 10.

Phase 1 can start.
