# ETF ranking Phase 2: scoring module and exit check · 2026-10-10

Part of the [blank-slate ranking plan](../../etf-blank-slate-ranking-plan.md), Phase 2. Method `rank-v1`, cutoff 2026-09-30. Code: [lib/etfRanking.ts](../../../lib/etfRanking.ts). Tests: [tests/etfRanking.test.ts](../../../tests/etfRanking.test.ts). Check script: [scripts/etf-ranking-check.ts](../../../scripts/etf-ranking-check.ts). Internal Use Only: built on Tiingo Starter data, personal use, do not share this report's per-fund figures.

No weights, bands or thresholds were changed. Every figure below is the method as written in Section 4 and Section 5 of the plan.

## Exit check

| Requirement | Result |
|---|---|
| Tests for percentile ties, monotonicity, order independence | Pass. Ties take the midpoint, ends are 0 and 100, a lower-is-better measure reverses, and insertion order does not matter. |
| Sortino with no downside | Pass. Undefined when no month has negative excess against BIL. Never zero or infinite. |
| Horizon blend | Pass. Bands at 35, 36, 59, 60, 119 and 120 months. |
| Eligibility gates | Pass. Every gate is tested. Re-deriving all 222 states from the inputs matches the Phase 1 CSV exactly (0 mismatches). |
| Tiers | Pass. Top 20% is tier 1. Equal scores share a tier. |
| Five funds hand-checked in a spreadsheet to 1e-6 | Pass. See below. |
| Full repo suite | 149 of 149 pass (`npm run test`). New suite `npm run test:etf-ranking`: 29 of 29 pass. |
| Typecheck and lint | `tsc --noEmit` clean. ESLint clean on the new and changed files. |

## What was built

- `lib/etfRanking.ts`: pure functions with no I/O. Percentiles with ties, horizon measures (CAGR, Sortino vs BIL, depth, underwater share), horizon blend, Vehicle, Trend and momentum, eligibility, Grand, Tactical, ranks, tiers and tie flags. Entry point `rankFunds`.
- `lib/etfMetricCalculations.ts`: one change. `dailyDrawdownForWindow` is now exported (keyword only, no behaviour change). The drawdown, underwater and recovery logic is reused, as the plan asks. The Yahoo code paths are untouched.
- `tests/etfRanking.test.ts`: 29 tests. Includes a hand-built fund whose Sortino (6), depth (1%) and underwater share (12/37) are computed by hand.
- `scripts/etf-ranking-check.ts`: runs the module on the 222 Phase 1 entries and the local Tiingo pull. Derives product class from Phase 1's reason text, re-derives each eligibility state, and writes the output outside the repo.
- `package.json`: adds `test:etf-ranking`.

## Data

- **Raw Tiingo pull reused, not re-pulled.** The earlier session's scratchpad still held all 222 files (200 MB, all valid JSON, BIL included). They are copied to `~/.stock-app-local/etf-ranking/tiingo-raw/`, outside the repo and uncommitted. No API call was made and the token was not used.
- Per-fund outputs, the hand-check workbook and the independent Python run are in the same local folder, also uncommitted, because the workbook contains raw daily prices.

## Results at cutoff 2026-09-30

**Eligibility** (re-derived from inputs; matches Phase 1 on 222 of 222):

| State | Count |
|---|---|
| Ranked | 45 |
| Separate list | 24 |
| Too new | 15 |
| Legal form unverified | 8 |
| Input missing | 127 |
| Excluded | 3 |

**Ranked funds.** All 45 are scored, with no missing Sortino at any horizon. Tiers hold 9 funds each. History bands: 1 fund in the 3Y-only band (SHLD), 8 in 60–119 months (3Y and 5Y blend), 36 with 120 months or more (3Y, 5Y and 10Y blend).

**Ties.** At the plan's provisional 3-point threshold, 42 of 45 scored funds are labelled "tied". Grand scores are dense (range 10 to 91 across 45 funds). This is a finding for Phase 5, where the threshold is set. It is not changed here.

**Cross-check against an independent implementation.** A plain-Python re-implementation (`independent_rank.py`, written without reading the TypeScript) agrees with `rankFunds` on every per-fund measure for all 45 funds. The largest absolute difference is 2.8e-14. Ranks and tiers are identical for all 45.

## Five funds hand-checked in a spreadsheet

Workbook: `handcheck-rank-v1-2026-09-30.xlsx` (local). Formula-driven from pasted daily prices and the Phase 1 fee and AUM. Percentiles are formulas against the 45-fund universe. The spreadsheet's recalculated values match the TypeScript run on 174 of 174 checked cells. On 169 of the 170 cells the largest difference is 5.7e-14. The 170th is a dollar-volume figure near 5.6e9, where the largest difference is 9.5e-7 absolute, which is float rounding at about 2e-16 relative. The 1e-6 check passes on every cell.

| Fund | Why picked | History | Outcome | Vehicle | Grand | Rank | Tier | Tactical |
|---|---|---|---|---|---|---|---|---|
| VOO | Lowest cost, 10Y blend | 192 mo | 81.532921 | 98.500 | 86.623044 | 2 | 1 | 85.167583 |
| SHLD | 3Y-only band | 36 mo | 80.000000 | 74.917 | 78.474955 | 7 | 1 | 45.298083 |
| VUSB | 3Y and 5Y blend, 5Y Sortino negative | 65 mo | 48.550740 | 95.000 | 62.485518 | 21 | 3 | 66.280638 |
| QYLD | 10Y blend, Global X fee dated 2025 | 153 mo | 64.981728 | 70.000 | 66.487209 | 17 | 2 | 76.425423 |
| CTEC | Bottom of the ranking, 3Y and 5Y blend, name flagged in Phase 1 | 71 mo | 4.198732 | 25.000 | 10.439112 | 45 | 5 | 10.522586 |

## Decisions taken where the plan is silent or conflicts

1. **CAGR formula.** The plan defines CAGR as `(P_end/P_start)^(12/n) − 1` over n monthly returns. The existing helper in `etfMetricCalculations.ts` uses calendar days ÷ 365.2425. I followed the plan, since Section 4 is the method of record. The difference is small but not zero: the largest gap across the 45 funds is 0.048 percentage points (SHLD, 3Y, CAGR 35.9%). **Flagging because it departs from the reuse instruction.** If you want the helper's convention, it is a one-line change, and it would be a method change, so it needs `rank-v2` or an explicit approval now, before any results are stored.
2. **Liquidity uses the median, not the average.** Plan Section 4.4's table says "median 30-session dollar volume", and its text says "averaged". I took the table. Dollar volume is raw close × raw volume.
3. **Trend percentile universe is the Ranked funds only.** Leveraged and ETN names would otherwise move the momentum percentiles. The text says "all eligible funds", which I read as the ranked universe. **Flagging.**
4. **Trend uses adjusted closes, and the 10-month SMA includes the cutoff month.** The plan says "month-end close". I used adjusted closes for consistency with the returns.
5. **Sortino undefined at a horizon means the fund is not scored.** It is shown with a note, not imputed and not dropped. The plan's no-downside rule does not say what happens to the blend. The case does not occur in the current 45, so this is a rule for future runs. **Flagging.**
6. **A missing horizon month means that horizon is unavailable,** not shortened. This is the plan's rule. No Ranked fund hits it.
7. **Percentile with only one other fund** returns 50, a neutral value. Not reachable with 45 funds.
8. **Tier formula.** `tier = min(5, floor(5 × funds scoring strictly higher ÷ scored count) + 1)`. Equal scores share a tier.
9. **Tie flag.** A fund is "tied" if any other scored Ranked fund is within the threshold (3 points, provisional).
10. **Vehicle AUM and fee come from the Phase 1 CSV, unchanged.** The 12-month AUM rule is applied at the cutoff, boundary included. The check reproduces Phase 1's withdrawals (DBA, DBO) and the boundary case (ARK at 2025-09-30).
11. **Eligibility classes.** Phase 1 records leveraged and ETN status only as reason text. The check script reads it back from the reason text. The module itself takes the product class as an explicit input.

## Open items for the owner (not resolved here)

1. **Legal-form gate scope (from Phase 1).** Nine Ranked ETFs have legal form "no": AIQ (13), QTEC (14), JPIN (32), ESPO (31), AOR (20), REMX (41), SDIV (43), VNM (44), DRIV (40). Their ranks are shown. The gate applies to commodity-pool, trust and metal/bitcoin trust structures only. If Section 5's "verified legal form on every ETF" text applies instead, these nine drop to "Legal form unverified". **Still undecided.**
2. **Global X fee dates from 2025.** Eight Ranked funds rely on a prospectus fee dated 2025: QYLD (17), COPX (19), ARGT (23), URA (27), BOTZ (37), LIT (38), ASEA (35), CTEC (45). Their Vehicle scores depend on it. **Still undecided.**
3. **Horizon blend weights: checked, confirmed.** The plan's 40/60 and 20/30/50 bands match Morningstar's published U.S. weights: 100% 3Y for 36–59 months, 60% 5Y and 40% 3Y for 60–119 months, and 50% 10Y, 30% 5Y and 20% 3Y for 120 months or more (Morningstar's own factsheet and its partner-published copies agree). Sources: [Morningstar Rating for Funds factsheet](https://advisor.morningstar.com/enterprise/MorningstarRatingForFunds_FactSheet.pdf) and the regional summaries cited in the search. Morningstar's underlying measure (Risk-Adjusted Return, within category) differs from this plan's universe-wide percentiles. The blend weights are the only part that transfers.
4. **Tiingo volume consolidation: still open.** Tiingo's [end-of-day documentation](https://www.tiingo.com/documentation/end-of-day) says only "the number of shares traded for the asset". It does not say whether that is consolidated across venues. It affects the liquidity band for every fund. Next step: ask Tiingo support, or compare one liquid ETF on a recent day against a consolidated source.
5. **Tie threshold.** 42 of 45 are tied at 3 points. Phase 5 sets the final value. Not changed here.
6. **Output of the no-downside rule.** Decision 5 above.

## Not in Phase 2

- Storage, input hash and the monthly run (Phase 3).
- Category rank. Peer-group splits are not in the inputs file yet. Plan Section 4.7 requires them, and they belong with Phase 4.
- Stability checks and tie threshold (Phase 5).
- No API calls. The Tiingo token was not used and is not committed.

## Reproduce

```
npm run test:etf-ranking
# With the local pull present at ~/.stock-app-local/etf-ranking/tiingo-raw:
npx tsc scripts/etf-ranking-check.ts lib/etfRanking.ts lib/etfMetricCalculations.ts lib/etfCatalog.ts --outDir <scratch> --rootDir . --module commonjs --target es2022 --esModuleInterop --resolveJsonModule --skipLibCheck --strict
ETF_RANKING_OUT_DIR=<scratch>/out node <scratch>/scripts/etf-ranking-check.js
```
