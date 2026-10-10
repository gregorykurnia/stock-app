# ETF ranking: open items before Phase 3 stored runs · 2026-10-10

Part of the [blank-slate ranking plan](../etf-blank-slate-ranking-plan.md), between Phase 2 and Phase 3. Phase 2 is pushed as `f76026a`. These items must close before the first stored run `etf_rankings/{cutoff}`. A stored run fixes its scores, so a change after it means `rank-v2`.

Phase 3 build work can start now. None of these items changes the design of the fetch, hash, storage or read API.

## Decisions already made

| # | Topic | Decision |
|---|---|---|
| 1 | CAGR formula | Keep the plan's `(P_end/P_start)^(12/n) − 1`. No change to code. The helper's calendar-day version differs by at most 0.048 percentage points and is not used. |
| 2 | Tiingo volume consolidation | Keep the current liquidity bands. Verify before the first stored run (see item 2). Change only as `rank-v2` if Tiingo is a subset. |
| 3 | Legal-form gate | Keep the nine plain ETFs Ranked. Label each "legal form not recorded" in the stored run. |
| 4 | Global X fee dates from 2025 | Re-check the eight product pages before the first run. Add a flag for any fee dated more than 12 months before the cutoff. |

## Open items

### 1. Volume check: build the flag label, do not send an email

**Status:** Not started. The Tiingo support email was dropped as too much effort.

**Why it matters:** if Tiingo `volume` covers only some venues, every fund's liquidity score is understated, and the bands would need recalibrating as `rank-v2`.

**How to do it instead (no email):**
1. Take the Tiingo `volume` field for VOO and SPY on 2–3 recent full sessions. The raw pull in `~/.stock-app-local/etf-ranking/tiingo-raw/` already has these, so no API call is needed.
2. Look up consolidated volume for the same sessions on a public historical-quote page, read through WebFetch.
3. Decision rule:
   - Within about 2–3% on every session: consolidated. Close the item and keep the bands.
   - Consistently a fraction of the consolidated figure: a subset. Either move to `rank-v2` before any store, or keep the bands and label every run "volume not verified as consolidated".
4. Limit: public quote sites are not an authoritative source. This is a sanity check, not proof.

**Owner action:** approve running this check. It is read-only and changes nothing in the repo.

### 2. Global X re-check (decision 4)

**Status:** Approved by owner. Not yet run.

**Funds:** QYLD, COPX, ARGT, URA, BOTZ, LIT, ASEA, CTEC.

**How:**
1. Fetch each product page and read its net expense ratio.
2. Compare with `net_expense_ratio_pct` in `data/etf-ranking-inputs.csv`.
3. If all match, record the check date in the Phase 3 notes and close the item.
4. If any value changed, update the CSV as an input change and rerun `scripts/etf-ranking-check.ts`. Report the effect on rank.

### 3. Labels (decisions 3 and 4)

**Status:** Not built.

**Rule:** labels live in the stored-run builder, not in the scoring function, so scores do not change.

- **"Legal form not recorded":** set on the nine Ranked ETFs with `legal_form_verified = no`. These are AIQ, QTEC, AOR, REMX, SDIV, VNM, JPIN, DRIV and ESPO.
- **"Fee older than 12 months":** set when `fee_as_of` is earlier than 2025-09-30 at the 2026-09-30 cutoff. Count the affected funds from the CSV before writing the rule, rather than assuming which ones.

**Tests:** one test per flag, plus a check that the scores are identical with and without the flags.

**Dependency:** build after item 4.

### 4. Read the history storage path

**Status:** Not read yet.

**Action:** read `lib/etfTiingo.ts` and the history chunk writer in `lib/etfMetricStore.ts`. Confirm they keep `close`, `adjustedClose` and `volume` for every fund.

**Why it matters:** "reproduce from stored inputs" cannot be designed until this is known. If `volume` is not stored, that is a gap to fix before any run.

**Design consequence:** full daily history for 222 funds will not fit in one 1 MiB document. The input snapshot lives in the history chunks. The run document holds the input hash, the method version, the cutoff and the outputs.

**Order:** do this first, since it shapes storage.

### 5. Tie threshold (Phase 5)

**Status:** Provisional at 3 points. At this threshold, 42 of 45 Ranked funds are labelled "tied".

**Action:** none before Phase 3. Set the final value in Phase 5 and record it.

## Suggested order

1. Item 4: read the storage path.
2. Items 1 and 2: run the volume check and the Global X re-check. Both need only your yes.
3. Item 3: build the labels, with tests.
4. Start the Phase 3 build: fetch, hash, storage, read API.
5. First stored run only after items 1 to 3 are closed.
