# ETF scoring M3 handoff: out-of-sample equity-index validation

Prepared 2026-10-07 after M2 specified the restricted candidate. Read the [roadmap](etf-scoring-roadmap.md), [candidate specification](etf-scoring-m2-handoff.md), [M1 audit](etf-equity-index-audit-2026-10-07.md), and [baseline report](etf-equity-index-validation-batch-2026-10-07.md) before beginning M3.

## Entry status

M2 passed the candidate-specification gate. This handoff fixes the M3 sample and evaluation protocol, but **M3 has not started**: no new ticker list has been frozen, no new market history has been acquired, and no M3 scores have been calculated. Do not treat this document as evidence that the candidate is released or that new funds are eligible.

Use method ID `equity-index-free-core-trial-v1` with the parameters and source rules in the M2 specification. Do not tune settings against the M3 sample. A justified method change returns to M2, increments the method version, and requires an affected M1 replay before M3 restarts with a fresh predeclared sample.

## Sample registration, before history acquisition or scoring

Create a dated, versioned sample manifest and freeze its SHA-256 before requesting price histories or calculating any score. Use at least 12 previously unused U.S.-listed passive broad equity-index ETFs, with at least four in each exposure stratum:

| Stratum | Minimum | Inclusion rule |
|---|---:|---|
| U.S. broad equity | 4 | Official issuer documents establish a passive broad U.S. equity-index mandate. |
| Developed markets outside the U.S. | 4 | Official documents establish a passive developed-market equity-index mandate; include at least one sourced mandate/index peer comparable to VEA if one can be established. |
| Broad international ex-U.S. | 4 | Official documents establish a passive broad international ex-U.S. equity-index mandate. |

The three strata are mutually exclusive by each fund's principal issuer-documented mandate. The sample must span at least three issuers. It must exclude all eight M1 tickers (VOO, VTI, IVV, ITOT, SCHB, VXUS, VEA and IXUS). Do not pick entries based on observed returns or candidate scores. If the minimum sample or an exposure stratum cannot be sourced, report the exact gap and stop before price acquisition; return the sample proposal for review rather than silently widening the method.

For every selected ticker, the frozen manifest records ticker, issuer, exposure stratum, official identity and mandate URLs, exact index name, issuer domain reviewed, inclusion rationale, known inception/mandate-change dates, selection date, and the fixed comparison group or `unranked-pending-peer`. Register peer groups from issuer evidence before computing outcomes. Distinct indexes can share an exposure stratum for coverage analysis but must not be described as identical benchmarks or put into a precise rank without a justified comparison group.

## Fixed evaluation protocol

1. **Cutoffs and windows:** Use one common latest completed month-end U.S. equity trading-session cutoff for the primary cross-section and record capture time separately. Evaluate the separately labeled 1Y and 3Y variants: exactly 12 or 36 monthly returns from 13 or 37 month-end endpoints, plus complete expected daily U.S. trading-session coverage from the first endpoint through cutoff. Do not replace a missing 3Y with 1Y or shorten a window. Additional completed cutoffs are sensitivity checks; they are point-in-time full scores only when the fee evidence was available and applicable by each cutoff.
2. **Source and freshness checks:** Require verified official issuer identity/mandate and current net-fee evidence under M2's 365-day capture-age and waiver rules. Require Yahoo adjusted-close history in USD, retrieval and latest-session ages within five calendar days at capture, valid ordered unique dates and positive closes. Report capture validity separately from current freshness. A stale or invalid current input blocks current availability but does not rewrite the historical capture result.
3. **Calculation and integrity:** Preserve the exact M2 method ID and parameters, M1 v2 raw-text JSON parsing and canonical SHA-256 integrity contract. Recompute each output from full retained sources. Every displayed/scored row must independently reproduce fee points, CAGR, daily maximum drawdown, downside deviation, historical points and final score within `1e-10` absolute error against a separate reference implementation. Every score must be finite and within `[0, 100]`. Any changed, missing, incomplete or mismatched input blocks the score with a precise reason.
4. **Missing and invalid cases:** Attempt and report every preregistered ticker and both horizons. Invalid identity/mandate, stale source, absent or gross-only fee, incomplete sessions, duplicate/future/invalid history, short history or discontinuous mandate must produce a blocked result and no number for the affected horizon. A valid 1Y may be reported when 3Y is blocked, with the horizon explicit. Add targeted rejection fixtures for the invalid cases if a live sample does not naturally contain them.
5. **Independent return evidence:** Where official issuer or another suitable provider supplies matched total-return evidence, compare identical dates and conventions to Yahoo adjusted closes. Record sources, endpoint values, cumulative/annualized return differences, and any adjustment or distribution mismatch. Do not add distributions twice. If an unexplained mismatch makes an affected source unreliable, block that fund and report it; do not alter the M2 formula to make sources agree.
6. **Sensitivity and interpretation:** Re-run the same 37 one-factor scenarios used by M1 without selecting a preferred configuration. Report score bounds, pair-order changes, one-decimal ties, component overlap, source blockers, and coverage by stratum and horizon. Keep scores labeled experimental and to one decimal at most. Do not publish score bands, winner claims, universal ranks, or future-return interpretations. Unverified peers remain unranked.
7. **Fees in historical windows:** Keep the 32 unresolved M1 point-in-time historical fee rows blocked. A current fee held constant across an earlier market window is sensitivity analysis only. Do not backfill fees; historical use requires a source published by that cutoff plus verified applicability, net/gross designation, and waiver/supplement terms.

## Gate from M3 to M4

M3 passes only when its dated report and frozen manifest demonstrate all of the following:

- The registered sample meets the 12-fund, three-stratum, three-issuer minimum, with all entries and comparison groups sourced before scoring.
- At least two funds per stratum have independently reproduced current 1Y scores and at least two per stratum have independently reproduced current 3Y scores. Any fund not meeting an input contract remains blocked and appears in coverage counts; it cannot be replaced after outcomes are seen.
- Every score has a matching, replayed integrity record; all scored values are within `[0, 100]`; all independent calculation deltas meet `1e-10`; and all intentionally invalid/incomplete fixtures block publication.
- Matched independent return evidence is reported wherever available, unresolved discrepancies block affected rows, and unavailable comparison evidence is identified rather than treated as a pass.
- The fixed sensitivity grid, one-decimal display limit, non-ranking restrictions, and historical-fee blockers are reflected in the report. No parameter was retuned to the new funds.
- A source coverage and operational feasibility report identifies current provider access, source gaps and retention constraints for M4. No use or retention permission is inferred from a successful request.

If a calculation, source validity, or sample-integrity check fails, return to M2 or replace the sample only under a new preregistered version before calculating replacement scores. If all checks pass, M4 may begin as a separate milestone; passing M3 does not by itself authorize publication in Browse funds.
