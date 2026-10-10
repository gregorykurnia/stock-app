# ETF ranking Phase 3: storage gap, volume check and Global X fee re-check · 2026-10-10

Part of the [blank-slate ranking plan](../../etf-blank-slate-ranking-plan.md), Phase 3, and the [open items](../phase3-open-items-2026-10-10.md). Internal Use Only: built on Tiingo Starter data, personal use, do not share. No raw Tiingo prices are in this report. Only derived percentages and public figures.

## Step A: storage path (stop)

**Result: volume is not stored. Phase 3 storage is blocked.**

- `lib/etfTiingo.ts` `TiingoDailyBar` holds `date`, `close`, `adjustedClose`, `dividendCash` and `splitFactor`. There is no `volume`. The parser reads `adjClose`, `divCash` and `splitFactor` from the Tiingo response and drops `volume` and `adjVolume`.
- `lib/etfMetricStore.ts` `saveETFCoreHistory` writes `rows` as given. It stores whatever `TiingoDailyBar` carries, so it stores no volume.
- The live caller is `app/api/etf-metrics/route.ts` (`refreshTiingoCoreTicker`). It fetches through `fetchTiingoDailyHistory`, merges, and saves. The history hash (`stableHistoryHash`) also covers only date, close, adjusted close, dividend and split.
- The raw pull in `~/.stock-app-local/etf-ranking/tiingo-raw/` does contain `volume` and `adjVolume` for all 222 files. So the Phase 2 scoring had volume, and the stored path would not.

**Consequence.** Liquidity (plan Section 4.4, dollar volume = close × volume) cannot be reproduced from the stored history. Phase 3 "reproduce from stored inputs" fails for the Liquidity component until volume is kept. This is a stop, as the owner instructed. Nothing was changed in the parser, the writer or the route.

**Options for the owner (not actioned):**
1. Keep `volume` and `adjVolume` in the parser and the chunk writer. The change is additive. The existing history hash does not include volume, so current hashes stay the same. Existing stored history has no volume and needs a backfill within the Starter quota (50 requests/hour, 1,000/day, per the plan's 2026-10-06 note).
2. Store volume in a separate Phase 3 input snapshot, leaving the Core history alone. This keeps Core untouched but duplicates history storage.

## Step B: Tiingo volume against a public consolidated figure

**Method.** Tiingo volume for VOO and SPY on six recent sessions (2026-10-01, 10-02, 10-05, 10-06, 10-07, 10-08), from the local raw pull. Public volume read by WebFetch from stockanalysis.com `/etf/voo/history/` and `/etf/spy/history/`. Differences are Tiingo ÷ public − 1.

| Session | VOO diff | SPY diff |
|---|---|---|
| 2026-10-01 | +3.3% | +3.2% |
| 2026-10-02 | +0.4% | +1.9% |
| 2026-10-05 | +0.4% | +5.3% |
| 2026-10-06 | +0.9% | +2.4% |
| 2026-10-07 | +0.8% | +3.9% |
| 2026-10-08 | +1.2% | +5.2% |

**Reading.**
- Tiingo is at or above the public figure on all 12 sessions. It is never a fraction of it. The owner's subset branch (Tiingo consistently a fraction of consolidated) is ruled out.
- The owner's "consolidated" branch needs every session within about 2–3%. That is not met cleanly. 8 of 12 sessions are within about 3%. SPY on 10-05, 10-07 and 10-08 is 3.9% to 5.3% above.
- The public source is not authoritative (plan Section 4 and the open items say so). A gap of a few percent can come from the source's snapshot timing or late prints, so this cannot settle consolidation either way.

**Position.** The subset question is closed: no evidence that Tiingo is a subset, so the bands stay (decision 2). The "within 2–3% on every session" test is not met, so the consolidation question is not closed. Recommendation: keep the bands and label each stored run "volume not verified as consolidated". This is an owner call, because the label rule in the open items was written for the subset case.

## Step C: Global X fee re-check

**Check date:** 2026-10-10. Pages read: `globalxetfs.com/funds/...` product pages (the URLs in the CSV `aum_source_url` column). Each page's Key Information section shows "Total Expense Ratio … As of Oct 09 2026".

| Ticker | CSV `net_expense_ratio_pct` (fee_as_of) | Product page | Match |
|---|---|---|---|
| QYLD | 0.60 (2025-03-01) | 0.60% | Yes |
| COPX | 0.65 (2025-03-01) | 0.65% | Yes |
| ARGT | 0.59 (2025-03-01) | 0.59% | Yes |
| URA | 0.69 (2025-03-01) | 0.69% | Yes |
| BOTZ | 0.68 (2025-04-01) | 0.68% | Yes |
| LIT | 0.75 (2025-03-01) | 0.75% | Yes |
| ASEA | 0.65 (2025-03-01) | 0.65% | Yes |
| CTEC | 0.50 (2025-04-01) | 0.50% | Yes |

**Result: all eight match. No CSV change, so no rerun is needed.**

**Caveat.** The pages show a single "Total Expense Ratio" and do not say whether it is net of fee waivers. The CSV value is labelled `net` from the 2025 prospectus. The values agree, but the net-of-waiver basis is not confirmed from the page. The prospectus or fact sheet would confirm it.

**Flag interaction.** The re-check is dated after the 2026-09-30 cutoff. It does not change `fee_as_of`, so the "fee older than 12 months" flag still applies at the cutoff. The re-check is recorded as a check, not a fee-date update.

## Flag count (from the CSV, for the flag rule)

- Ranked funds with `fee_as_of` before 2025-09-30: **9**. These are QYLD, COPX, URA, BOTZ, LIT, ARGT, ASEA, CTEC and **SDIV**.
- Decision 4 names eight Global X funds. The rule as written also catches **SDIV**, which is not Global X. Owner decision needed: keep the rule as written (nine flags), or limit it to the eight named funds. This is a flag-rule choice, not a score change. Scores do not depend on flags.
- Ranked funds with `legal_form_verified = no`: 9 (AIQ, QTEC, AOR, REMX, SDIV, VNM, JPIN, DRIV, ESPO). SDIV therefore carries both flags.

## Status against the open items

| Item | Status |
|---|---|
| 4. Storage path read | Done. Volume is missing: stop. |
| 1. Volume check | Subset ruled out. Consolidation not verified (2–3% test not met). Owner call on label. |
| 2. Global X re-check | Done, all eight match. Net-basis caveat recorded. |
| 3. Labels and tests | Not built. Count of fee flags is 9 (SDIV question open). |
| Phase 3 build and first stored run | Not started. Blocked on volume storage. |

## Other contradictions noticed

- Plan Section 4.4 says "median 30-session dollar volume" in the table and "averaged" in the text (line 136). Phase 2 decision 2 took the table. This is not in the owner's decision list. Confirm before the liquidity code is treated as final.
