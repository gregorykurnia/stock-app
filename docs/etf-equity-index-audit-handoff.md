# ETF equity-index reliability and methodology audit handoff

Prepared 2026-10-07. The eight-fund validation batch was pushed in commit `0f16372`, following the VOO/VXUS trial in `a854538`.

Read the [trial report](etf-free-core-trial-2026-10-07.md), [batch report](etf-equity-index-validation-batch-2026-10-07.md), and [independent Grand Score plan](etf-independent-grand-score-plan.md) for context. The prompt below authorizes the next audit, not a methodology freeze or a catalogue rollout.

## Copyable prompt

```text
Continue the ETF scoring work in /Users/gregorykurnia/projects/stock-app.
Implement the next milestone: a reliability and methodology audit of the
existing eight-fund equity-index batch: VOO, VTI, IVV, ITOT, SCHB, VXUS,
VEA and IXUS. The batch was implemented in commit 0f16372 after the
VOO/VXUS Yahoo Finance Free Core trial in a854538.

First inspect git status, read AGENTS.md and all applicable nested
instructions, and preserve unrelated local edits. In particular, do not
overwrite or include unrelated changes to
docs/etf-quantitative-comparison-plan.md in your commit.

Read these documents and implementations before editing:
- docs/etf-free-core-trial-2026-10-07.md
- docs/etf-equity-index-validation-batch-2026-10-07.md
- docs/etf-equity-index-audit-handoff.md
- docs/etf-independent-grand-score-plan.md
- lib/etfEquityIndexValidationBatch.ts
- lib/etfCorePipeline.ts and the relevant equity-index scoring functions
- scripts/refresh-etf-equity-index-validation-batch.mjs
- tests/etfEquityIndexValidationBatch.test.ts
- app/etf/equity-index-validation/page.tsx
- data/etf-equity-index-validation-sources.json
- data/etf-equity-index-validation-batch.json
Read the relevant guide in node_modules/next/dist/docs/ before app edits.

Keep the original captured artifact and formula as the audit baseline.
It has a 2026-09-30 common cutoff and sensitivity cutoffs 2019-12-31,
2020-03-31, 2022-12-30 and 2024-12-31, with both 1Y and 3Y windows.
Its score is (0.30 * FeePoints + 0.40 * HistoricalOutcomes) / 0.70.
Write audit experiments and any refreshed observations to separate,
dated artifacts so the baseline and scenarios remain distinguishable.

1. Resolve saved-data and page reproducibility first.
During the batch implementation, standalone Node replay passed, while
an attempted replay in the Next.js production page produced different
history hashes and hid scores. The cause remains undiagnosed; do not
assume Next.js changes the data. The current page instead trusts saved
batch flags, validated row status, score bounds and a nonempty inputHash.
That is a display workaround, not page-level integrity verification.

Reproduce and diagnose the difference using the same retained artifact
and supported Node runtime in the batch runner, tests and Next.js build.
Compare the exact hashed payloads, values, property ordering, imported
source profiles and methodology parameters. Report the first concrete
difference and a regression case that explains it.

Implement versioned, deterministic serialization and integrity checks
where warranted by the diagnosis. Hashes must cover the required data,
dated fee provenance, windows and scoring parameters. Do not round away
input differences or weaken comparisons merely to make tests pass.
Recompute required validation and compare saved scores before display;
saved pass flags or the mere presence of a hash are insufficient.
An invalid or altered artifact must hide the affected scores and provide
a precise reason. Distinguish validity at capture from present freshness.

Check calculations with an independently implemented reference for the
retained real-data windows: monthly returns, CAGR, daily drawdown,
downside deviation, component points and final scores. Document any
floating-point tolerance. Repeating the production function establishes
determinism, not an independent check of the formula.

2. Audit sensitivity and meaningful score differences.
Use the same eight funds, both horizons and all five baseline cutoffs.
Preserve the baseline formula and label every experimental scenario.
Test normalized fee versus historical weights around the baseline
(at least +/-10 percentage points in fee weight), historical component
weights, fee scale and the relevant growth/risk curve parameters
(at least +/-10% and +/-20% where mathematically valid).
State the scenario grid before interpreting the results. Assess
monotonicity, bounds, saturation, score ranges, pairwise gaps and order
changes, and whether historical components count similar effects twice.
Use the real retained prices for the empirical analysis. Synthetic
boundary cases may supplement tests but cannot replace real-data evidence.

Compare only sourced, sufficiently similar mandates: VOO/IVV,
VTI/ITOT/SCHB, and VXUS/IXUS are candidate comparison sets whose index
differences must be disclosed. VEA has no matching developed-market peer
in this sample; do not invent one or pool it into a universal ranking.
Assess whether observed score gaps survive reasonable parameter changes.
Recommend display precision, ties or bands only if the evidence supports
them, and explain the criteria. Do not tune the method to a desired winner
or treat historically high scores as proof of future performance.

3. Validate historical fee evidence as a separate branch of the audit.
Find archived official issuer net expense-ratio disclosures for each
historical cutoff where accessible. Record the URL/document, fund
identity, publication or availability date, effective date, net/gross
designation and applicable waiver/expiry terms. A disclosure published
after a cutoff is insufficient evidence of information available then.
Use only fees supported as applicable and available at that cutoff.
Keep current-fee sensitivity results labelled as such. For missing
historical evidence, mark the point-in-time result blocked and report
the exact missing source/date/term. Do not silently carry today's fee
backward, substitute zero, infer a net fee from a gross fee, or manufacture
an archived value. Compare historical-fee and current-fee results only
where the required evidence exists.

Keep this audit separate from the existing Core/Full scorecards and the
broader Grand Score plan. Use Yahoo adjusted price history, dated official
issuer net fees and the verified equity-index mandate restriction.
Do not require spread data, add dividends to adjusted closes again, fill
missing inputs with zero, extend this method to other fund families,
expand the catalogue, or freeze the method during this audit.

Deliver a dated report and reproducible audit artifacts/scripts showing:
- the diagnosed replay issue, fix, independent calculation agreement,
  input integrity checks and production-page verification;
- each ETF/horizon/cutoff's validation and source coverage;
- sensitivity scenarios, ranges, order changes and precision conclusions;
- historical fee evidence, eligible point-in-time results and blockers;
- a recommendation to expand, revise or keep the method experimental,
  supported by the evidence and unresolved limitations.
Update the batch report's reliability caveat after the issue is actually
resolved. Keep generated reports consistent with their renderer so
refreshing data does not erase important validation limitations.

Run meaningful tests for altered prices, fees, sources, parameters,
saved scores and missing sessions, plus independent real-data agreement.
Run relevant regression tests for any shared utility changes, targeted
lint, and a production build using the supported Node runtime. Inspect
the actual production page: valid scores must render and invalid inputs
must be blocked. If a source or credential prevents a branch of real-data
validation, report its exact blocker and complete the independent work
that remains possible. Do not claim blocked checks passed.

After validation, commit only the related validated changes and push the
current branch to origin. Report the commit, checks, artifact/report
paths, conclusions and precise outstanding blockers.
```
