# ETF scoring master roadmap

Last updated: 2026-10-07. **Start here for current status and delivery order.**

**Current milestone: M4 — durable acquisition, storage and refresh.** M3 passed its restricted validation gate on 2026-10-07; its dated report, retained artifact and return-source evidence are linked below. Three funds remain blocked because their official iShares return tables do not reconcile with Yahoo and a second provider. M2 passed its specification gate; see the [M2 candidate specification](etf-scoring-m2-handoff.md). The historical point-in-time fee branch remains blocked. M4 has started with an explicit provider-use and retention gate; see the [readiness record](etf-scoring-m4-readiness-2026-10-07.md). Passing M3 does not authorize score publication in Browse funds.

This document governs delivery order and progress tracking. The [independent Grand Score plan](etf-independent-grand-score-plan.md) retains the original Core/Full formulas, family routing and broader coverage objectives. The [quantitative comparison plan](etf-quantitative-comparison-plan.md) and [ETF page plan](etf-page-plan.md) retain applicable metric and product requirements. This roadmap does not replace those scorecards with the Yahoo equity-index experiment.

## Current evidence

| Work | Recorded status | Evidence / limitation |
|---|---|---|
| Original Tiingo Core acquisition | Sample validation recorded; broad publication unfinished | [Core coverage report](etf-core-coverage-2026-10-06.md), dated 2026-10-06; not a current whole-catalogue audit |
| VOO/VXUS Yahoo Free Core trial | Implemented and pushed in `a854538` | [Trial report](etf-free-core-trial-2026-10-07.md); experimental, separate from Core/Full |
| Eight-fund Yahoo equity-index batch | Implemented and pushed in `0f16372` | [Batch report](etf-equity-index-validation-batch-2026-10-07.md); captured 16/16 common-cutoff and 64/64 historical sensitivity results |
| Page integrity and independent calculation audit | M1 gate passed for restricted M2 specification | [Dated audit report](etf-equity-index-audit-2026-10-07.md) and [reproducible audit data](../data/etf-equity-index-audit-2026-10-07.json): VOO history bar 278 changed from `180.93528747558594` to `180.9352874755859` in Next.js 16.2.10/Turbopack's compiled JSON module. The page now parses raw JSON text with Node, then replays and checks the v2 manifest. Independent calculations agree within 1.43e-14 across 80 rows. |
| Restricted candidate specification | M2 gate passed 2026-10-07 for M3 validation only | [M2 specification](etf-scoring-m2-handoff.md) carries `equity-index-free-core-trial-v1` forward unchanged with exact formulas, source/freshness contracts, window rules, v2 integrity requirements, peer limits and experimental labels. No parameters changed; no historical fees were inferred. [M3 handoff](etf-scoring-m3-handoff.md) fixes sample registration and evaluation gates before collection. This does not approve `/etf` publication. |
| Previously unused sample validation | M3 gate passed 2026-10-07 for restricted validation; M4 may begin separately | [M3 report](etf-equity-index-m3-validation-2026-10-07.md), [retained 120-row artifact](../data/etf-equity-index-m3-validation-2026-10-07.json), [return evidence sources](../data/etf-equity-index-m3-return-evidence-2026-10-07.json), and [frozen sample](../data/etf-equity-index-m3-sample-v1.json). Twelve funds across four issuers met the sample minimums. All 12 histories were captured; 82 scored rows independently reproduced within 2.85e-14 and raw-text integrity replay passed. Current 1Y/3Y coverage is U.S. 4/4, developed ex-U.S. 2/4, broad international ex-U.S. 3/4. IEFA, EFA and ACWX are blocked after issuer/provider return discrepancies; historical fee rows remain blocked. |
| Historical fees | Blocked for point-in-time historical scoring | M1 found evidence leads but did not establish applicability and net/gross/waiver terms for all cutoff rows. All 32 historical fee rows stay blocked; eight current-fee rows at the common 2026-09-30 cutoff are eligible. |
| Sensitivity and peer framing | M1 complete; candidate remains experimental | [Audit report](etf-equity-index-audit-2026-10-07.md): 37 scenarios/2,960 rows remain bounded, but 15 of 50 peer comparison rows change order under scenarios and 23 tie at one decimal. Use one decimal at most; no universal rank. |

These are dated implementation records. A past capture does not establish current provider access, source freshness, whole-catalogue coverage or methodology acceptance.

## Milestone sequence and gates

### M1 — Reliability and methodology audit

Status: **complete for the captured-data integrity/calculation gate, with restrictions**. Scope: the existing VOO, VTI, IVV, ITOT, SCHB, VXUS, VEA and IXUS batch, both horizons and all five recorded cutoffs. See the [dated audit](etf-equity-index-audit-2026-10-07.md), [audit artifacts](../data/etf-equity-index-audit-2026-10-07.json), and [integrity manifest](../data/etf-equity-index-validation-integrity.json). The Next.js compiled JSON precision change was reproduced and fixed; the production page recomputes and verifies before display. The independent reference agrees within 1.43e-14. Historical point-in-time fees remain blocked for all 32 sensitivity rows; current-fee results at the common cutoff are separately eligible.

Deliver the diagnosed hash mismatch and regression fix, verified integrity before score display, an independent real-data calculation check, weight/curve sensitivity results, precision conclusions, and a historical fee evidence matrix. Save an audit report and reproducible artifacts. Keep baseline observations distinguishable from refreshed data and experiments.

Gate to M2: **passed for restricted candidate specification only.** The report identifies passed, failed and blocked checks; current page integrity and independent calculation checks pass. The reproduced numeric-precision mismatch is fixed and retained as a regression case. Missing fee evidence blocks the historical point-in-time branch. This gate does not authorize publication or ranking beyond the bounded current-fee analysis.

### M2 — Resolve audit findings and specify the candidate method

Status: **complete for candidate specification; passed to M3 validation only**. See the [M2 specification](etf-scoring-m2-handoff.md) and [M3 handoff](etf-scoring-m3-handoff.md).

The selected candidate is the existing `equity-index-free-core-trial-v1`, with no formula or parameter changes from M1. Its source eligibility, 365-day fee and five-day history age limits, separate capture/current validity, exact 1Y/3Y windows, integrity/hash contract, comparison groups, display precision and experimental-only interpretation are specified. M1 findings support retaining at most one decimal and disallowing rank claims; unresolved historical fees remain blocked.

No parameter changes were justified, so no new formula version or M1 replay was needed. Do not tune parameters to produce preferred winners. Any future evidence-backed change requires a new method version and affected M1 checks.

Gate to M3: **passed for restricted validation only**. The specification and audit disposition exist, M1 integrity/calculation findings are closed, and limitations have explicit restrictions. Candidate selection is not a methodology freeze or broad release.

### M3 — Expanded validation on previously unused equity-index funds

Status: **complete for restricted validation; passed to M4 with explicit source blockers**. See the [M3 handoff](etf-scoring-m3-handoff.md), [dated validation report](etf-equity-index-m3-validation-2026-10-07.md), [retained artifact](../data/etf-equity-index-m3-validation-2026-10-07.json), and [independent return evidence inputs](../data/etf-equity-index-m3-return-evidence-2026-10-07.json). The 12-fund/four-issuer sample remained frozen at SHA-256 `bbe0ad71f1477b214ae80d99df2cf11e875ef80ccbcf88fe77b226ba959b5853`. All 12 Yahoo captures passed acquisition checks. After independent return reconciliation, 82 of 120 rows scored and replayed independently within `2.842170943040401e-14`; the v2 raw-text integrity replay passed. Primary current coverage is four U.S. broad funds, two developed ex-U.S. funds, and three broad international funds per horizon.

The 2026-08-31 market-price comparison found issuer-source discrepancies for IEFA, EFA and ACWX above the 0.25 percentage-point reconciliation tolerance. A second provider agrees with Yahoo to its published precision but does not explain the issuer conflict, so those funds' 1Y/3Y and market-window score rows stay blocked. VSGX's early 3Y windows are also blocked by inception/history coverage; SPYM and SPTM windows crossing the 2020-01-24 benchmark transition are blocked. The M1 32 historical fee rows remain blocked. The full 12-fund sample still meets the minimum two independently reproduced current scores per stratum and horizon; no sample member was replaced after outcomes were seen.

Add a bounded, sourced sample of previously unused broad equity-index ETFs across issuers and verified U.S., developed-market and broad international exposures. Specify the sample and evaluation criteria before running it. Include a genuinely comparable developed-market peer for VEA where sources permit. Verify index/mandate differences rather than assuming all broad funds are interchangeable. Test short-history, missing-source and continuity rejection cases as well as successful windows.

Apply the selected candidate without retuning it to the new sample. Validate real 1Y/3Y data at a common cutoff and across additional available completed cutoffs. Check matched-period returns against independent official/provider evidence where accessible, and identify the extent of any unreconciled adjustment uncertainty. A later completed month can strengthen temporal validation when available; do not invent one or describe historical testing as prospective evidence.

Gate to M4: **passed for restricted validation only**. The sample met all preregistered minimums, the fixed method and 37-scenario grid were unchanged, valid rows independently reproduced, invalid fixtures blocked, source discrepancies were reported and their affected fund rows were blocked, and coverage remains at least two funds per stratum and horizon. Provider access is technically demonstrated for this capture only; permission to use or retain data is unresolved. No scores are published in Browse funds. Any source reconciliation must restore issuer evidence before those blocked funds become eligible.

### M4 — Durable acquisition, storage and refresh

Status: **in progress; acquisition and retention are gated pending review**. M3 passed the restricted-validation dependency. The [M4 handoff](etf-scoring-m4-handoff.md) and [readiness record](etf-scoring-m4-readiness-2026-10-07.md) document the infrastructure inspection and initial policy gate. No new M4 capture or run has been written. Reuse the existing Firebase/Firestore patterns where they fit, and keep the M3 source blockers in force.

Replace one-off acquisition with shared Yahoo history and dated issuer import/adapters for the validated scope. Integrate bounded history/provenance storage with the existing persistence design. Preserve immutable score inputs, methodology parameters and run IDs; detect provider adjustment revisions; keep credentials server-only. Add resumable progress, account-wide request budgeting, bounded retries and explicit source failures.

Separate the completed-month scoring cutoff from market and issuer freshness. Retain prior captures after refresh failures while accurately marking their present eligibility. Preserve important report limitations in generated output. Confirm actual provider access and permitted retention/use for the intended personal-use deployment before increasing collection.

Gate to M5: a real refresh is reproducible, resume/revision/failure paths are verified, storage costs and source coverage are measured, and page reads can use validated stored results without live provider calls.

### M5 — Limited integration into the ETF explorer

Status: planned, depends on M4 and acceptance of the restricted method.

Integrate the validated equity-index method into `/etf` for the supported universe under its own method/depth labels and version. Present component explanations, actual risk/return metrics, source dates, common cutoff, input validity, freshness and precise blockers. Use matched scorecard/horizon/cutoff/mandate frames for sorting and Compare. Verify mobile views, source details, shortlist behavior and CSV exports.

A released method version must have documented review evidence for its precise eligible scope. Existing Core/Full/cost-only/execution records retain their identities; any future replacement or default-selection change needs an explicit migration decision based on the evidence.

Gate to M6: production UI/API/export checks show valid stored scores, block invalid inputs, and disclose coverage and limitations. Freeze only the reviewed version and scope; unsupported variants remain candidates.

### M6 — Expand coverage within the validated equity-index scope

Status: planned, depends on M5.

Inventory the catalogue's verified eligible broad equity-index entries, backfill through the validated adapters, and report supported, unavailable, stale and blocked counts by horizon and mandate. Expand in bounded batches with measured source coverage. New strategy types return to a representative validation step before publication.

Gate to the next scope: publish an honest coverage report and remaining source/identity gaps. Report both the eligible-scope denominator and the full catalogue denominator. The original plan's 80% objectives remain broader ambitions, not proof that this eight-fund method covers most ETFs. Experimental, stale and cost-only outputs cannot be relabelled as validated broad Core/Full coverage.

### M7 — Other fund families, one validated method at a time

Status: planned after the equity-index route is reliable; order depends on coverage gaps and source feasibility.

Select a next family from the [original strategy plan](etf-independent-grand-score-plan.md), then repeat source feasibility, representative real-data validation, methodology audit, operations and restricted publication for that family. Bond, active-equity, dividend, options-income, commodity and other strategies need their own required inputs and interpretation. Leverage/inverse products and ETNs need their specified execution/continuity evidence.

Gate for each family: its own sourced specification and acceptance report pass. Do not inherit the Yahoo equity-index fee/outcome formula solely to populate empty rows. Keep incompatible scorecards out of universal rankings and leave unsupported families explicitly unavailable.

### M8 — Optional Full Grand Score enrichment

Status: future enrichment; can proceed independently once its sources and method are validated.

Return to the original Full equity-index specification when required official NAV, benchmark/total-return reference, tracking and implementation-quality inputs are demonstrably available. Its original quality/performance blend and mandatory input contract require their own validation; current-fee Yahoo scores are not equivalent evidence.

Gate: a dedicated Full-method source and acceptance report supports publication for a defined scope. Full enrichment need not delay a validated simpler method, and Full/Core scores remain distinguishable in storage, UI and comparisons.

### M9 — Ongoing maintenance

Status: recurring from M4 onward, not a final one-time task.

Monitor refresh failures, revisions, source dates, mandate/name changes, closures and index continuity. Reaudit meaningful methodology/input changes, track coverage regressions, preserve historical run reproduction and withdraw current availability when required inputs become invalid. Generate dated maintenance evidence rather than carrying old pass flags forward indefinitely.

## How each session should advance the roadmap

1. Read this file, `AGENTS.md`, the current milestone's handoff and evidence reports. Inspect git status and preserve unrelated edits, especially the existing quantitative-plan edit.
2. Implement the requested current milestone within its scope. Later rows describe sequencing, not instructions to execute every stage automatically.
3. Validate relevant real data, calculations, source contracts and user-visible behavior. Read installed Next.js guides before app changes. Retain precise blockers instead of assumptions.
4. Before marking a milestone complete, link its dated report/artifacts and validated commit, document the outcome of its gate, and identify the exact next milestone or revision loop. A report of blocked evidence is not a passed gate.
5. Create/update the next milestone's handoff with concrete scope and acceptance criteria, then update this roadmap and cross-links. Keep generated reports consistent with their renderers. Commit and push only related validated changes as required by `AGENTS.md`.

Historical fee evidence may remain a separate blocked research branch while current-fee validation advances. Integrity or independent-calculation failures block score publication. This distinction should remain visible in every status update.

## Reusable session prompt

```text
Continue the ETF scoring work in /Users/gregorykurnia/projects/stock-app.
Read AGENTS.md and docs/etf-scoring-roadmap.md first, inspect git status,
and preserve unrelated local edits. Implement only the current next
milestone using its linked handoff, source constraints and acceptance
gate. Validate the actual data and relevant application behavior; report
exact blockers. Before finishing, update the roadmap with the evidence,
gate outcome and next milestone, and prepare its handoff. Commit and
push only related validated changes. Do not automatically execute later
milestones or treat a blocked gate as passed.
```
