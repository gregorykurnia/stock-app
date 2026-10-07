# ETF scoring M2 handoff: resolve audit findings and specify the candidate

Prepared 2026-10-07 after the M1 reliability and methodology audit. Read the [roadmap](etf-scoring-roadmap.md), [audit report](etf-equity-index-audit-2026-10-07.md), [baseline batch report](etf-equity-index-validation-batch-2026-10-07.md), and [original Grand Score plan](etf-independent-grand-score-plan.md) before changing the method.

## M1 evidence to carry forward

- The captured eight-fund artifact replays under supported Node 26.10.0. The prior hash mismatch was reproduced: Next.js 16.2.10/Turbopack's compiled JSON module changed VOO history bar 278 from `180.93528747558594` to `180.9352874755859`. The page now reads raw JSON text and parses it on the Node server before checking the v2 canonical manifest and recalculating scores. This preserves the exact input without loosening comparison.
- An independent reference agreed across all 80 fund/cutoff/horizon rows within `1.4210854715202004e-14`, under a `1e-10` absolute tolerance. This validates arithmetic on the retained artifact, not Yahoo's historical adjustment quality or the scoring method's predictive value.
- The 37 declared one-factor scenarios cover normalized fee/history weights, individual history-component weights, fee scale, growth anchor/scale, and drawdown/downside scales. Across 2,960 scenario rows scores remain bounded; 15 of 50 mandate-matched comparison rows change order under at least one scenario, and 23 of 50 baseline comparisons tie when rounded to one decimal. Keep the method experimental and display at most one decimal, with no rank claims.
- Growth correlates with downside deviation at -0.900 in the 80 retained rows; drawdown magnitude correlates with downside deviation at 0.823. Treat those risk components as overlapping evidence, not independent signals.
- Eight common-cutoff fee rows are eligible using their recorded current disclosures. All 32 historical-cutoff fee rows remain blocked for point-in-time use. Found prospectuses are evidence leads only until availability, applicability, net/gross designation, supplements and waiver/expiry terms are resolved. Current fees held constant in 2019–2024 windows remain sensitivity analysis.
- The sample supports only the listed peer groups: VOO/IVV, VTI/ITOT/SCHB, and VXUS/IXUS. Index construction differs within the latter two groups. VEA has no peer in this sample. Do not pool mandates or create a universal rank.

## M2 objective

Specify a bounded candidate configuration and its eligibility, inputs, freshness, windows, integrity contract, comparison frame, precision, and restrictions. Do not expand the catalogue or implement a broad release during this specification step. Do not tune parameters toward a preferred fund. If the evidence does not justify a change, retain the captured formula as a versioned experimental candidate and list the missing validation work.

## Candidate for review

Carry forward the existing formula unchanged for the next bounded validation: `(0.30 × fee points + 0.40 × historical outcome points) ÷ 0.70`, with fee scale 0.50%, growth anchor/scale 8%/4%, drawdown scale 25%, downside scale 15%, and historical component weights 0.40/0.35/0.25. This is a test candidate, not a frozen or released methodology. M2 must record any evidence-backed change as a new version and rerun affected M1 checks.

Limit eligibility to verified passive broad equity-index mandates with official identity/mandate evidence, a dated official net expense ratio, and complete Yahoo adjusted-close history in USD. Preserve the existing history checks and explicitly separate capture-time validity (fee source age no more than 365 days; latest history no more than five days old at capture) from present freshness. A stale current source blocks current availability; it does not rewrite whether the saved capture was valid.

Use completed U.S. trading-session cutoffs and exact 1Y/3Y monthly-return windows with complete daily sessions. Keep the `2026-09-30` common cutoff and four historical cutoffs as the baseline validation set. Do not score the historical-fee branch until each fund/cutoff has point-in-time fee evidence. Never carry current fees backward or infer a missing fee.

Require integrity version `equity-index-integrity-v2`, canonical key-order JSON serialization, SHA-256 over the retained artifact and metadata, full fund histories/provenance, row inputs/results and current scoring parameters. The page must recompute the artifact before showing scores, block altered or incomplete inputs, and expose precise reasons. A hash is an integrity mechanism, not a signature.

For comparisons, keep the three mandate-matched sets and their index differences explicit. Keep VEA unranked within this sample and exclude cross-mandate ordering. Show scores to one decimal at most; a rounded tie is not evidence of identical returns or mandates. Preserve components, dates, windows, source links, capture status and any current-freshness status alongside the score.

## M2 acceptance criteria

1. A reviewed candidate specification records version, formula, parameters, eligible mandates, mandatory source contracts, fee applicability policy, date/freshness rules, windows, integrity/hash schema, peer sets, precision, and excluded interpretations.
2. Every proposed difference from the captured baseline cites an M1 finding and is versioned; no parameter is changed to improve a selected fund's rank.
3. Historical point-in-time scoring remains unavailable for all 32 unresolved rows. Current-fee sensitivity remains visibly distinct from historical-fee scoring.
4. The exact Next.js numeric-precision regression and raw-text parsing fix are documented. New mutation tests and production rendering continue to demonstrate that changed artifacts cannot display scores.
5. The specification names whether the candidate is ready for M3's previously unused sample. No M3 data collection begins until that specification and its evaluation criteria are fixed.

## M3 handoff boundary

If M2 acceptance passes, prepare a predeclared, previously unused sample spanning issuers and verified U.S., developed-market, and broad international exposure. Include a sourced developed-market peer for VEA if one can be established. Freeze the sample and evaluation criteria before calculating scores; apply the M2 candidate without retuning. M3 is a separate validation milestone and is not authorized by this handoff alone.
