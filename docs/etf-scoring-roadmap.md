# ETF scoring master roadmap

Last updated: 2026-10-07. **Start here for current status and delivery order.**

**Next milestone: M1 — audit the existing eight-fund equity-index batch.** Use the [audit handoff prompt](etf-equity-index-audit-handoff.md). The audit has been specified but has not been implemented. M2 follows its evidence and conclusions; subsequent milestones are planned work with acceptance gates, not completed features or authorization to execute everything in one session.

This document governs delivery order and progress tracking. The [independent Grand Score plan](etf-independent-grand-score-plan.md) retains the original Core/Full formulas, family routing and broader coverage objectives. The [quantitative comparison plan](etf-quantitative-comparison-plan.md) and [ETF page plan](etf-page-plan.md) retain applicable metric and product requirements. This roadmap does not replace those scorecards with the Yahoo equity-index experiment.

## Current evidence

| Work | Recorded status | Evidence / limitation |
|---|---|---|
| Original Tiingo Core acquisition | Sample validation recorded; broad publication unfinished | [Core coverage report](etf-core-coverage-2026-10-06.md), dated 2026-10-06; not a current whole-catalogue audit |
| VOO/VXUS Yahoo Free Core trial | Implemented and pushed in `a854538` | [Trial report](etf-free-core-trial-2026-10-07.md); experimental, separate from Core/Full |
| Eight-fund Yahoo equity-index batch | Implemented and pushed in `0f16372` | [Batch report](etf-equity-index-validation-batch-2026-10-07.md); captured 16/16 common-cutoff and 64/64 historical sensitivity results |
| Page integrity and independent calculation audit | Open; M1 is next | Standalone replay passed, but the attempted Next.js page replay had an undiagnosed history-hash mismatch. The current page trusts saved flags and hash presence. Repeating one function checks determinism, not independent correctness. |
| Historical fees | Current-fee sensitivity only in the recorded batch | Current dated fees were held constant at historical cutoffs; applicable historical issuer evidence has not yet been established. |

These are dated implementation records. A past capture does not establish current provider access, source freshness, whole-catalogue coverage or methodology acceptance.

## Milestone sequence and gates

### M1 — Reliability and methodology audit

Status: **next, ready to start**. Scope: the existing VOO, VTI, IVV, ITOT, SCHB, VXUS, VEA and IXUS batch, both horizons and all five recorded cutoffs. Follow the [audit handoff](etf-equity-index-audit-handoff.md).

Deliver the diagnosed hash mismatch and regression fix, verified integrity before score display, an independent real-data calculation check, weight/curve sensitivity results, precision conclusions, and a historical fee evidence matrix. Save an audit report and reproducible artifacts. Keep baseline observations distinguishable from refreshed data and experiments.

Gate to M2: the report identifies exactly which checks passed, failed or remain blocked. Page integrity and independent calculation failures must be resolved before publication work. Missing historical fee disclosures block the affected point-in-time branch; they do not alone prohibit properly labelled current-fee analysis. A completed audit may recommend revising the method rather than expanding it.

### M2 — Resolve audit findings and specify the candidate method

Status: planned, depends on M1.

Use the audit to select a documented candidate configuration, eligible mandates, required inputs, source-age rules, 1Y/3Y window rules, version/hash contract and comparison frame. Specify display precision or ties only where supported by the audit. Separate data validity, comparison eligibility and current freshness. Record the evidence behind each change from the baseline.

If findings require revisions, implement them in a new candidate version and rerun the affected M1 checks. If the evidence is insufficient, retain the experimental label and list the remaining work. Do not tune parameters to produce preferred winners.

Gate to M3: a candidate specification and audit disposition exist, blocking integrity/calculation findings are closed, and unresolved limitations have explicit restrictions. Candidate selection is not a methodology freeze or broad release.

### M3 — Expanded validation on previously unused equity-index funds

Status: planned, depends on M2.

Add a bounded, sourced sample of previously unused broad equity-index ETFs across issuers and verified U.S., developed-market and broad international exposures. Specify the sample and evaluation criteria before running it. Include a genuinely comparable developed-market peer for VEA where sources permit. Verify index/mandate differences rather than assuming all broad funds are interchangeable. Test short-history, missing-source and continuity rejection cases as well as successful windows.

Apply the selected candidate without retuning it to the new sample. Validate real 1Y/3Y data at a common cutoff and across additional available completed cutoffs. Check matched-period returns against independent official/provider evidence where accessible, and identify the extent of any unreconciled adjustment uncertainty. A later completed month can strengthen temporal validation when available; do not invent one or describe historical testing as prospective evidence.

Gate to M4: a dated expanded coverage/reproducibility report demonstrates that the eligible sample behaves as specified, with measured limitations and exact blockers. Failures return to M2 for revision and a new version. Sector/style exposures and other fund families require separate scope and evidence.

### M4 — Durable acquisition, storage and refresh

Status: planned, depends on M3; reuse suitable existing infrastructure.

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
