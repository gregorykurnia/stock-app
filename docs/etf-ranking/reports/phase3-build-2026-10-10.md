# ETF ranking Phase 3: build, flags and read API · 2026-10-10

Part of the [blank-slate ranking plan](../../etf-blank-slate-ranking-plan.md), Phase 3, and the [open items](../phase3-open-items-2026-10-10.md). Internal Use Only: Tiingo Starter data, personal use, do not share. No raw prices in this report.

**Status: code built and tested. The first stored run is not written.** It is blocked by the history gap in section 3.

## 1. What was built

| File | Purpose |
|---|---|
| `lib/etfTiingoParse.ts` (new) | Pure Tiingo EOD parser. Now keeps `volume`. Rejects a bar with missing or negative volume. |
| `lib/etfTiingo.ts` | Uses the shared parser. Same errors and request path. |
| `lib/etfRunFlags.ts` (new) | The three labels, in the builder only, never in scoring. |
| `lib/etfRankingInputs.ts` (new) | CSV parsing and product-class logic, moved out of the check script so the builder and script share them. |
| `lib/etfRankingRun.ts` (new) | Snapshot, input hash, stored-run build, reproduction from stored inputs. Scores come only from `rankFunds`. |
| `lib/etfRankingStore.ts` (new) | `etf_rankings/{cutoff}` read and write. The write refuses to replace a run with a different hash. |
| `app/api/etf-rankings/route.ts` (new) | Read-only GET `?cutoff=YYYY-MM-DD`. Imports only the store. No provider code. |
| `scripts/etf-ranking-check.ts` | Now also builds the stored run in memory, measures it, and reproduces it. Writes nothing to Firestore. |
| `tests/etfRankingRun.test.ts`, `tests/etfTiingoParse.test.ts` (new) | 16 new tests. |
| `tests/etfCorePipeline.test.ts` | One fixture gets a `volume` field, because the type now requires it. |
| `package.json` | `test:etf-ranking` covers the new files. |

## 2. Results

| Check | Result |
|---|---|
| `npm run test:etf-ranking` | 45 of 45 pass (29 existing, 16 new). |
| `npm run test` (full repo suite) | 149 of 149 pass. |
| `test:etf-validation`, `test:etf-m3`, `test:etf-m4-policy` | Pass (12, 5, 6). |
| `test:etf-m4-storage` | **Fails, and failed before this change.** Checked on unmodified HEAD in a temporary worktree: same error, "M3 integrity replay blocked M4 storage". Not touched here. |
| `tsc --noEmit` | Clean. |
| ESLint on changed files | Clean. |
| Real-data check (local pull, 222 entries) | Eligibility matches Phase 1 on 222 of 222. 45 Ranked, 42 tied at the provisional 3-point threshold. |
| Phase 2 reference output | **Byte-identical** (same SHA-256 before and after the refactor). Scores have not moved. |

## 3. History gap (found while building)

The Core refresh in `app/api/etf-metrics/route.ts` keeps only the window that `requiredCoreHistoryStart` allows: 37 month-ends, about three years. `mergeBars` and the `.filter` drop older rows on every save.

Consequences:
- A run needs 120 months of history for the 10-year horizon. 36 of the 45 Ranked funds have 120 or more months. The Core store cannot feed them.
- Adding `volume` to the Core store (option 1 from the last note) fixes liquidity for three years only. It does not give the run its history.
- The Core writer also leaves stale year documents in place when a window shrinks. It is not a safe source for a long history.

**Needed before any stored run:** a separate full-history store for the ranking, not the Core store. It would hold roughly 2,500 daily bars per fund, with volume, untrimmed, one chunk per fund per year. Its backfill is one full-history Tiingo request per fund, 222 in total. That is within the Starter limits recorded in the plan (50 per hour, 1,000 per day), at about five hours at 50 per hour. This is a new collection and a new fetch path, so it needs your go-ahead.

The builder is storage-agnostic. It takes bars by ticker, so it works unchanged once that store exists.

Until then, `buildStoredRun` throws on the real store, because the Core rows have no volume and cover only three years. This is intended: the builder fails closed.

## 4. Flags and label rules

| Flag | Rule | Count (cutoff 2026-09-30) |
|---|---|---|
| Legal form not recorded | State Ranked and `legal_form_verified = no` | 9 (AIQ, QTEC, AOR, REMX, SDIV, VNM, JPIN, DRIV, ESPO) |
| Fee older than 12 months | `fee_as_of` strictly before 2025-09-30 | 9 (QYLD, COPX, URA, BOTZ, LIT, ARGT, ASEA, CTEC, SDIV) |
| Volume not verified as consolidated | Every run, while `VOLUME_CONSOLIDATION_VERIFIED = false` | 222 |

SDIV carries both the legal-form and the fee flag. The fee rule was kept as written, as you approved. Scores are unchanged with or without the flags: a test changes the fee date and the legal-form status and checks that every score matches.

## 5. Stored-run document and reproduction

- **Size:** 232,518 bytes of JSON for the full 222-fund run, which is 22.2% of the 1 MiB Firestore limit. JSON bytes are a proxy for the stored size, which will differ slightly.
- **Content:** method version, cutoff, capture time, input hash, volume flag, input metadata for all 222 entries, and the full per-fund result with its flags.
- **Input hash:** SHA-256 over the method version, cutoff, tie threshold, and each fund's metadata and daily close, adjusted close and volume, sorted by ticker. Fund order does not change the hash.
- **Reproduction on the local pull:** rebuilding from the stored form (JSON round trip) gives the same hash and the same scores. Changing one volume changes the hash.
- **Fail-closed rules:** a bar with missing or negative volume stops the build and names the ticker. Non-ascending dates stop it. A missing cash proxy (BIL) stops it. Nothing is imputed.

## 6. Plan exit check (Phase 3 row)

| Requirement | Status |
|---|---|
| One run reproduces exactly from stored inputs (hash matches) | Met on the local pull and in tests. Not yet on Firestore data, which is blocked by section 3. |
| Page reads make no provider calls | Met by construction: the GET route imports only `lib/etfRankingStore.ts`. Not yet exercised against Firestore. |
| Document size measured | Met: 232,518 bytes, 22.2% of 1 MiB. |
| First stored run written | **Not done.** Blocked by section 3 and by your go-ahead. |

## 7. Decisions for you

1. Approve a separate full-history ranking store, as in section 3. This is the blocker.
2. Confirm the Tiingo refresh gate. The Core refresh route returns 503 unless `ETF_TIINGO_AUTOMATION_AUTHORIZED=true`, which is not set. I did not set it. The new backfill would need its own go-ahead.
3. The volume label stays on every run until consolidation is verified (see the earlier check report).
