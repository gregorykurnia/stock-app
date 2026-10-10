# ETF ranking: blank-slate plan

Date: 2026-10-09. Status: **plan only; no code written yet.** Start the build at Phase 0 once you say go.

This is the only ETF scoring plan to follow. It replaces the scoring direction in the [master roadmap](etf-archive/etf-scoring-roadmap.md), the Core/Full scoring sections of the [independent Grand Score plan](etf-archive/etf-independent-grand-score-plan.md), and the [first ranking draft](etf-archive/etf-ranking-plan.md). Nothing was deleted. Every earlier file is kept, and Section 9 says what happens to each one.

---

## 1. What is different from before

| Area | What we tried before | This plan |
|---|---|---|
| Question | Is each fund "validated" for publication, mostly against 8–12 index peers? | Rank every eligible ETF best to worst, across all categories, and within each category. |
| Score mechanism | Core/Full formulas with hand-set curves (8% growth anchor, 25% drawdown scale, 0.50% fee half-life). | Percentile ranks for return-based measures. Fixed absolute bands only for cost, liquidity and size. |
| Score components | Fee, growth, drawdown and downside. Drawdown and downside correlate at 0.82, so one risk factor counted twice. | Outcome (return, Sortino, pain) plus Vehicle (cost, liquidity, size). Trend shown separately. |
| Comparison frame | Only verified peer groups. No cross-mandate ranks. | Percentiles across the whole eligible universe. Category rank is the same score filtered to a group. |
| Horizons | Fixed 1Y and 3Y. | 3Y, 5Y and 10Y, blended by how much history each fund has. |
| Data source | Yahoo adjusted closes for experiments (blocked by terms of use for automated use); Tiingo for Core. | Tiingo Starter EOD only, plus a manually maintained fee and AUM file. Yahoo is not used for ranking. |
| Storage | M4 run store: leases, retry budgets, compare-and-set writes, TTL, Firebase Admin. | One document per monthly ranking run, plus the existing history chunks. |
| Process | Nine gated milestones, dated reports, frozen SHA-256 samples, a 37-scenario grid. | Six build phases, each with one exit check. Two stability checks, not a 37-scenario grid. |
| Display | Score column with "candidate / experimental" labels and a one-decimal rule. | Whole-number Rank, Tier, Grand and Trend, with a "historical, not a forecast" label. |
| Missing or thin data | "Methodology pending" and many blocked rows. | Each fund gets one explicit state and reason. Funds are listed, never silently dropped, and never imputed. |

### What the earlier work was worth

Kept, because it was useful:
- The integrity lessons. The audit caught a precision change in Next.js's compiled JSON that altered VOO's history and result hashes. The rule is to parse retained data as raw text and recompute before display.
- The 222-entry Pluang catalogue research and its classification.
- Evidence that Tiingo serves history for VOO, VTI and VXUS.
- The documented data-use constraint on Yahoo.
- The rules against imputing fees and showing explicit blocked states.

Not carried forward, because it did not serve the decision:
- The gated milestone process and its dated reports.
- The hand-set curves and the Core/Full formulas.
- The M4 run store, which was built for multi-user scale and has 12 funds.
- The 37-scenario sensitivity grid. The method was never going to be published from it.
- Yahoo as an input for anything other than retained evidence.

---

## 2. Decisions recorded

1. **Default sort: Quality rank** (Grand Score). Tactical rank (Grand plus Trend) is a toggle. *Confirmed by you.*
2. **No points for diversification.** Correlation to VOO is shown as context only. *Confirmed by you.*
3. **Weights: 70% Outcome, 30% Vehicle.** *Recommended and taken as the default. You did not answer this one explicitly. Override it if you disagree.*
4. **Leveraged/inverse funds and ETNs** appear in a separate list, not in the main ranking. *Recommended and taken as the default. Same caveat.*
5. **Currency: USD only** in v1. An IDR view comes later, using matched USD/IDR rates. *Recommended and taken as the default. Same caveat.*

---

## 3. The question the score answers

"Over the past 3 to 10 years, which ETFs delivered the best risk-adjusted outcome, and are they sound vehicles to own?"

It does **not** answer:
- What will do best next. Historical rankings persist only weakly, especially across categories.
- What belongs in a portfolio. A low-ranked bond fund can still be a useful diversifier. Correlation is shown next to the score for this reason.
- Which fund is best in another market regime. The ranking reflects the measured period. The horizon blend reduces this effect; it does not remove it.

---

## 4. Score design

### 4.1 Universe, cutoff and prices

- **Universe:** the 222 entries in `docs/research/pluang-etf-2026-10-06/research-universe.json` (snapshot 2026-10-06).
- **Cutoff:** the last completed U.S. month-end session. Every fund uses identical dates. The cutoff is stored with each run.
- **Prices:** Tiingo daily dividend- and split-adjusted closes, and daily volume. Do not add distributions again to an adjusted series.
- **Monthly returns** come from month-end adjusted closes.
- **Daily measures** (drawdown, underwater share) come from daily adjusted closes over the same window as the horizon.

### 4.2 Horizon windows

| Horizon | Monthly returns | Month-end endpoints |
|---|---|---|
| 3Y | 36 | 37 |
| 5Y | 60 | 61 |
| 10Y | 120 | 121 |

A horizon is available only when the fund has complete history for it. Never shorten a window to fill a gap.

### 4.3 Outcome layer (70% of Grand Score)

For each available horizon *h*, three measures:

- **Return:** `CAGR = (P_end / P_start)^(12 / n) − 1`, where *n* is the number of monthly returns.
- **Efficiency:** Sortino ratio against BIL, the cash proxy.
  - Excess monthly return: `e_t = r_fund,t − r_BIL,t`.
  - Annualized mean excess: `12 × mean(e_t)`.
  - Downside deviation: `sqrt(12 × mean(min(e_t, 0)²))`.
  - Sortino = annualized mean excess ÷ downside deviation.
  - If a window has no negative excess months, Sortino is undefined. Mark the measure "no downside", and do not assign a value.
- **Pain:** the average of two percentiles, both lower-is-better.
  - Maximum drawdown depth within the window.
  - Underwater share: the fraction of daily observations below the running peak.

**Percentiles.** Each measure is ranked within the funds that have that horizon:

```text
pct = (other funds with a worse value + 0.5 × other funds tied) ÷ (N − 1) × 100
```

*N* is the number of eligible funds with that measure at that horizon. The best fund scores 100 and the worst scores 0. Tied funds share a value. For lower-is-better measures, invert the comparison.

```text
Outcome_h = 0.35 × pct(CAGR) + 0.35 × pct(Sortino) + 0.30 × [0.5 × pct(depth) + 0.5 × pct(underwater)]
```

**Horizon blend.** The blend follows the weighting pattern of Morningstar's star ratings. Check the published methodology before Phase 2 (see Section 11).

| History at cutoff | Outcome |
|---|---|
| Under 36 months | Not ranked. Shown with a reason. |
| 36–59 months | 100% 3Y |
| 60–119 months | 40% 3Y + 60% 5Y |
| 120 months or more | 20% 3Y + 30% 5Y + 50% 10Y |

**Known limit.** Each horizon's percentiles come from a different universe: 10Y percentiles are ranked only among funds with 10 years of history. A blended score is therefore comparable in direction, but not in exact universe. This is accepted and labelled in the UI.

### 4.4 Vehicle layer (30% of Grand Score)

These measure what the past return stream cannot tell you. They use absolute bands, not percentiles, so a fund's score doesn't depend on who else is in the universe.

| Component | Weight | 0 points | 100 points | Formula |
|---|---|---|---|---|
| Cost | 50% | Net expense ratio ≥ 1.00% | 0.00% | `100 × max(0, 1 − ER ÷ 1.00)`, with ER in percent |
| Liquidity | 25% | Median 30-session dollar volume ≤ $1M | ≥ $50M | Linear in log₁₀ between the bounds |
| Size | 25% | AUM ≤ $50M | ≥ $1B | Linear in log₁₀ between the bounds |

```text
Vehicle = 0.50 × Cost + 0.25 × Liquidity + 0.25 × Size
Grand   = 0.70 × Outcome + 0.30 × Vehicle
```

Dollar volume is close × volume, averaged over the last 30 sessions through the cutoff. All three Vehicle inputs are required. If any is missing, the fund is not ranked and the reason is shown. Nothing is imputed.

### 4.5 Trend (shown separately, never blended into Grand)

- **Momentum** (per fund, percentile within all eligible funds with 12 months of history):
  - 3-month return: `P(t) / P(t−3) − 1`
  - 6-month return: `P(t) / P(t−6) − 1`
  - 12-month return excluding the latest month: `P(t−1) / P(t−12) − 1`
  - Momentum = the average of the three percentiles.
- **Trend state:** month-end close compared with its 10-month simple moving average of month-end closes. Uptrend if the close is at or above the average.
- **Trend score** = `0.5 × Momentum + 0.5 × (100 if Uptrend, else 0)`.
- **Tactical rank** = `0.5 × Grand + 0.5 × Trend score`.

The two sorts answer different questions. Quality rank asks what to own. Tactical rank asks what to own right now.

### 4.6 Tiers and ties

- **Tiers** cut the eligible, ranked universe by Grand Score: Tier 1 is the top 20% and Tier 5 the bottom 20%. Funds at the same score share a tier.
- **Ties:** funds whose Grand Scores differ by less than the tie threshold are labelled "tied" in the rank display. Start the threshold at 3 points. Set the final value in Phase 5 and record it.
- **Display:** whole numbers only. Rank appears as "Rank 14 of 187 (tied)".

### 4.7 Category rank

Category rank uses the same Grand Score, filtered to one peer group. Each fund belongs to exactly one peer group, assigned from the catalogue's research group and refined by subgroup. Peer groups are defined in the inputs file, not inferred from ticker names.

- Within a group, show rank and tier from the same Grand Score.
- Groups with fewer than 5 eligible funds show rank only, with no tier.

Peer groups to start from: the 15 research groups in the catalogue, split where the exposure differs materially. For example, Treasury short, intermediate and long; developed ex-U.S. and emerging markets; US total market, large cap and small/mid cap; and one group per sector.

### 4.8 Stability checks (replace the 37-scenario grid)

Run these once in Phase 5 and write the results to a report. Fix the thresholds before running them.

1. **Weight perturbation.** Move the 70/30 split and each component weight by ±10 points, one at a time. Report the share of funds that change tier. **Trigger:** if more than 20% of funds change tier under any single change, review the weights before release.
2. **Cutoff stability.** Compare each fund's tier at the current cutoff and three months earlier. Report the share that changed tier. This is informational only.

---

## 5. Eligibility and states

Every catalogue entry gets exactly one state, with a reason. Counts come from Phase 1.

| State | Who | Shown where |
|---|---|---|
| **Ranked** | ETFs and commodity, physical-metal and spot-bitcoin trusts with verified legal form, identity, ≥36 months of history, a dated net fee, and complete Vehicle inputs. | Main ranking, with Quality and Tactical sorts. |
| **Separate list** | Leveraged and inverse (21 entries) and ETNs (3 entries). Daily-reset decay and issuer credit risk make multi-year outcomes misleading as a single ranking. | Its own list, showing Vehicle and Trend only. |
| **Too new** | Under 36 months of history. | Listed with Vehicle and Trend if available. Not ranked. |
| **Input missing** | Missing net fee, AUM, or price history. | Listed with the missing field named. Not ranked. |
| **Legal form unverified** | The 15 "commodity-pool/trust; verify legal form" entries until checked. | Listed as unverified. Not ranked. |
| **Excluded** | Operating-company stocks (2) and the closed-end fund (1). | Not shown in ETF rankings. |

**Rule:** a fund is removed from a ranking only by an eligibility rule, never because its score is low.

---

## 6. Data

| Input | Source | Refresh | Status |
|---|---|---|---|
| Daily adjusted close and volume, all 222 catalogue entries (BIL is one of them) | Tiingo Starter EOD, through the existing adapter `lib/etfTiingo.ts` | Monthly, plus incremental daily | Starter limits recorded 2026-10-06 as 500 symbols per month, 50 requests per hour and 1,000 per day. **Verify before backfill.** |
| BIL (cash proxy) | Tiingo, same adapter (already in the 222) | Monthly | Confirmed in Phase 0: first date 2007-05-30. |
| Net expense ratio, AUM, inception date, legal form | Issuer fund pages, entered into `data/etf-ranking-inputs.csv` with source URL and as-of date | Quarterly, and when a fee changes | Manual, one-time for the catalogue, then maintained. |
| Catalogue identity and research group | `docs/research/pluang-etf-2026-10-06/research-universe.json` | Static snapshot | Reused. |

**Not used for ranking:** Yahoo in any form, FRED TB3MS (a yield, not a holding return), full holdings, NAV histories, official benchmark total returns, and bid/ask spread feeds. None has a permitted free source in this setup.

**Retained Yahoo captures** in `data/etf-equity-index-*.json` are kept as evidence only. They are not inputs to this ranking.

### Storage

- **Daily history:** the existing year-partitioned chunks written by `saveETFCoreHistory` in `lib/etfMetricStore.ts`. The size is roughly 222 funds × about 2,500 bars for 10 years. Measure this in Phase 0.
- **Ranking run:** one Firestore document per monthly cutoff, for example `etf_rankings/{cutoff}`. It holds per-fund Grand, Outcome, Vehicle, Trend, components, tier, state, reason and an input hash. Measure its size against the 1 MiB limit in Phase 3.
- **Input hash:** a SHA-256 over the canonical inputs used for the run. Re-running with the same inputs must reproduce the stored scores exactly.
- **Page reads** use stored runs only. No live provider calls.

---

## 7. Build phases

Each phase ends with a commit and push, per `AGENTS.md`. Do not start a phase until the previous exit check is recorded.

| Phase | Work | Exit check |
|---|---|---|
| **0. Access and coverage** | Confirm the Tiingo token works. Pull history for all 222 entries (BIL is one of them). Record each symbol's first date, gaps and duplicates. Confirm the account's Starter limits. | Coverage report in `docs/etf-ranking/reports/`. Every symbol has a first date and a gap status. Limits confirmed. |
| **1. Inputs and eligibility** | Build `data/etf-ranking-inputs.csv` with fee, AUM, inception, legal form and source for each entry. Assign each entry one eligibility state. | Every entry has exactly one state and reason. Counts for each state are reported. |
| **2. Scoring module** | Write `lib/etfRanking.ts` as pure functions: percentiles, horizon blend, Sortino, pain, Vehicle, Trend, Grand, tiers, eligibility. Reuse CAGR, drawdown, underwater and recovery from `lib/etfMetricCalculations.ts`. Add unit tests. | Tests pass for: percentile ties, monotonicity, order independence, Sortino with no downside, horizon blend, eligibility gates, tiers. Five funds hand-checked in a spreadsheet to 1e-6. |
| **3. Monthly run and storage** | Fetch, compute and store `etf_rankings/{cutoff}` with an input hash. Add a read-only API that returns stored runs. | One run reproduces exactly from stored inputs (hash matches). Page reads make no provider calls. Document size measured. |
| **4. UI** | In `components/ETFExplorer.tsx`, replace the legacy Score column with Rank, Tier, Grand and Trend. Add the Quality/Tactical toggle, the breakdown panel, category rank, the historical label and CSV export. | Sort order is correct. Mobile layout checked. CSV matches the stored run. |
| **5. Scheduling and checks** | Add a new workflow, `.github/workflows/refresh-etf-ranking.yml`, with its own gate variable. Run the two stability checks from Section 4.8. Record the tie threshold. | Stability report written. Tie threshold recorded. Weights reviewed if the 20% trigger fires. |

---

## 8. Governance rules

- **Weights and thresholds are fixed before the Phase 5 checks run.** A change made after seeing results creates a new method version (`rank-v2`), and the checks are rerun.
- **Eligibility rules remove funds. Score does not.**
- **Missing data is never imputed.** A fund is listed with its reason.
- **Every stored run records** its method version, cutoff, capture date and input hash.
- **Every display is labelled** "historical, not a forecast." It is not individual investment advice.
- **Nothing is deleted in this effort.** Retirement means a status label, a banner and an entry in Section 9. Removing a file or function needs an explicit request from Greg in a later session.

---

## 9. Inventory: what happens to each earlier artifact

Status key:
- **Superseded:** kept. Its scoring direction is replaced. A banner at the top points here.
- **Record:** dated evidence. Kept unchanged.
- **Reused:** this plan builds on it.
- **Legacy code:** kept, not extended, and not called by the ranking path.
- **Gated off:** operational workflows. Left unchanged and left gated.

### Documents

| File | Status | Note |
|---|---|---|
| `docs/etf-archive/etf-scoring-roadmap.md` | Superseded | Banner added. Record of M1–M4. |
| `docs/etf-archive/etf-independent-grand-score-plan.md` | Superseded for scoring | Banner added. Its access and coverage findings remain evidence. |
| `docs/etf-archive/etf-ranking-plan.md` | Superseded | First draft. Banner added. |
| `docs/etf-archive/etf-scoring-m2-handoff.md`, `etf-archive/etf-scoring-m3-handoff.md`, `etf-archive/etf-scoring-m4-handoff.md`, `etf-archive/etf-scoring-m4-readiness-2026-10-07.md` | Superseded | Equity-index gates. Record only. |
| `docs/etf-archive/etf-equity-index-audit-2026-10-07.md`, `etf-archive/etf-equity-index-audit-handoff.md`, `etf-archive/etf-equity-index-m3-validation-2026-10-07.md`, `etf-archive/etf-equity-index-validation-batch-2026-10-07.md`, `etf-archive/etf-free-core-trial-2026-10-07.md` | Record | Yahoo-based experiment. Evidence only. |
| `docs/etf-archive/etf-core-coverage-2026-10-06.md` | Record | Tiingo coverage for VOO, VTI and VXUS. |
| `docs/etf-archive/etf-quantitative-coverage-2026-10-06.md`, `docs/etf-archive/etf-quantitative-readiness.json` | Record | Source-readiness table as of 2026-10-06. |
| `docs/etf-quantitative-comparison-plan.md` | Partly superseded | Its metric definitions still apply. Its scoring text is superseded. **Greg has an uncommitted edit to this file. It was not modified here.** |
| `docs/etf-page-plan.md` | Partly superseded | Keep the page structure, category model and metric definitions. Any score language is superseded. |
| `docs/pluang-etf-research.md`, `docs/research/pluang-etf-2026-10-06/*` | Reused | The catalogue. |
| `docs/etf-blank-slate-ranking-plan.md` (this file) | Current | The plan to follow. |

### Data

| File | Status |
|---|---|
| `data/etf-equity-index-*.json`, `data/etf-equity-index-m3-sample-v1.*` | Record. Yahoo-based. Evidence only. |
| `data/etf-equity-index-validation-*.json` | Record. |
| `data/etf-scoring-data-use-policy.json` | Record. The Yahoo block it states still applies. |
| `data/etf-core-issuer-inputs.json` | Candidate source for the Phase 1 fee and AUM file. Verify its contents before use. |

### Code

| File | Status | Note |
|---|---|---|
| `lib/etfMetricCalculations.ts` | Reused | CAGR, drawdown, underwater, recovery and volatility. Its Sortino and Sharpe stay unavailable. The ranking computes Sortino against BIL in `lib/etfRanking.ts`. |
| `lib/etfTiingo.ts` | Reused | Tiingo adapter. |
| `lib/etfMetricStore.ts` | Reused | History chunks and the request budget (`reserveTiingoRequest`). The legacy Core assessment writers are not used. |
| `lib/etfCatalog.ts` | Reused | The catalogue types. The legacy `scoreAssessments` fields are not used by the ranking. |
| `components/ETFExplorer.tsx` | Reused | Table, Compare, Shortlist and CSV shell. The Score column is replaced in Phase 4. |
| `lib/etfScoring.ts`, `lib/etfScorecard.ts` | Legacy code | Core, Full, cost-only and execution formulas, plus routing and comparison-group IDs. Not extended. |
| `lib/etfCorePipeline.ts`, `lib/etfFreeCoreTrial.ts`, `lib/etfFreeCoreTrialStore.ts`, `lib/etfEquityIndexValidationBatch.ts`, `lib/etfEquityIndexM3Validation.ts`, `lib/etfEquityIndexM4Policy.ts`, `lib/etfEquityIndexM4Storage.ts`, `lib/etfEquityIndexM4FirestoreStore.ts`, `lib/etfReturnDisplay.ts` | Legacy code | Experiment and M4 code. Kept with their tests. |
| `lib/firebaseAdminServer.ts` | Legacy code | Built for M4. Not needed by the ranking plan. |
| `app/etf/equity-index-validation/page.tsx`, `app/etf/free-core-trial/page.tsx` | Legacy pages | Kept reachable and labelled experimental. Not linked from the ranking. |
| `app/api/etf-metrics/route.ts` | Legacy route | Serves the Yahoo and legacy Core paths. The ranking uses its own endpoint. |
| `scripts/*etf*.mjs` | Legacy scripts | Validation and refresh scripts for the experiment. |
| `tests/etf*.test.ts`, the `test:etf-*` scripts in `package.json` | Kept | They still test legacy code. Keep them passing. |
| `.github/workflows/refresh-etf-metrics.yml` | Gated off | Yahoo path. Its gate variable must stay unset. Left unchanged. |
| `.github/workflows/refresh-etf-core.yml` | Gated off | Legacy Tiingo Core path. Left unchanged. |
| `.github/workflows/refresh-etf-ranking.yml` | New (Phase 5) | Its own workflow and gate variable. |

---

## 10. Open items to verify before the plan is trusted

1. **Tiingo Starter limits and personal-use terms.** The figures above were recorded on 2026-10-06. Confirm them against the live account in Phase 0.
2. **BIL history start.** Confirmed in Phase 0: first date 2007-05-30.
3. **Horizon blend weights.** The 40/60 and 20/30/50 blends follow the pattern of Morningstar's published star-rating weights. Check the published methodology in Phase 2, or state the blend as a deliberate choice of this plan.
4. **Net expense ratios and AUM** for all eligible funds, from issuer sources, with dates. Phase 1.
5. **Legal form** of the 15 commodity-pool and trust entries. Phase 1.
7. **Tiingo license scope (Starter is "Internal Use Only").** The license allows personal use only, and forbids displaying or sharing the data with another person or organization. **Resolved 2026-10-09:** Greg confirmed the app is private and he is the only user. Keep it that way: any sharing of the app or its output needs a new decision first, because it would breach the license.
6. **Tiingo volume.** Confirm whether Tiingo's volume is consolidated across venues. If it isn't, the liquidity measure will understate volume for every fund. The comparison stays consistent across funds, but the bands need checking.

---

## 11. Change log

- 2026-10-09: The 15 dated-record and superseded files were moved into `docs/etf-archive/`, with links updated. Index: `docs/etf-index.md`. Nothing was deleted.
- 2026-10-10: Phase 2 scoring module (`lib/etfRanking.ts`, method `rank-v1`) built and tested. Exit check and open items in `docs/etf-ranking/reports/phase2-scoring-2026-10-10.md`. Horizon blend weights checked against Morningstar's published methodology and confirmed. Tiingo volume consolidation is still open.
- 2026-10-09: Blank-slate plan written. Supersedes the ranking draft and the scoring direction of the M1–M9 roadmap. Decisions 1 and 2 confirmed by Greg; decisions 3–5 taken from the draft's recommendations.
