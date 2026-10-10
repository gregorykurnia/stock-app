# ETF ranking Phase 1: inputs and eligibility · 2026-10-10

Part of the [blank-slate ranking plan](../../etf-blank-slate-ranking-plan.md), Phase 1. Files: [data/etf-ranking-inputs.csv](../../../data/etf-ranking-inputs.csv) (222 rows, one per catalogue entry) and [phase1-evidence-2026-10-10.csv](phase1-evidence-2026-10-10.csv) (the quoted source text behind each value, with agent notes and the rule flags applied).

This version applies the owner's decisions of 2026-10-10. The first version of this report (commit d90b54d) had 6 ranked entries; this one has 45.

## Exit check

All 222 catalogue entries have exactly one eligibility state and a reason. States were applied in the order the spec gives: Excluded, Separate list, Too new, Legal form unverified, Input missing, Ranked.

| State | Count | Notes |
|---|---|---|
| **Ranked** | **45** | See the list below |
| Separate list | 24 | 21 leveraged/inverse, 3 ETNs (FNGU, SLVO, USOI) |
| Too new | 15 | Under 36 months at 2026-09-30 (Phase 0 `horizon_3y = false`) |
| Legal form unverified | 8 | GLD, SGOL, PPLT (physical-metal trusts); DBC, GSG, WEAT, CORN, SOYB (commodity pools) |
| Input missing | 127 | See the breakdown below |
| Excluded | 3 | FCNCA, TEM (operating-company stocks), ACP (closed-end fund). Fee and AUM not collected. |
| **Total** | **222** | |

### Ranked (45)

- **Vanguard (22):** VOO, VXUS, BND, VUG, VEA, VTV, VGT, VIG, BNDX, VT, VYM, VTIP, VCIT, VNQ, VCSH, MGK, VOOG, VYMI, VUSB, VNQI, VTI, VWO
- **Global X (15):** QYLD, COPX, SHLD, URA, BOTZ, BUG, DTCR, LIT, SDIV, ARGT, CLOU, DRIV, ASEA, CTEC, AIQ
- **Other (8):** GRID, QTEC, QCLN, AOR, REMX, VNM, ESPO, JPIN

### Input missing breakdown (127)

- Net fee missing, AUM present: 94
- AUM missing, net fee present: 10
- Both missing: 23

### Reconciliation with the expected counts

- 21 below 3 years (Phase 0): 15 are Too new. The other 6 are in the Separate list (MSTU, BITU, MSTZ, FNGU, USOI) or Excluded (TEM).
- 15 "commodity-pool/trust" catalogue entries: 4 are leveraged (AGQ, UGL, BOIL, KOLD), so they are in the Separate list. Of the remaining 11, 5 are Legal form unverified. The other 6 (USO, CPER, BNO, UNG, DBA, DBO) have a legal form confirmed but no usable fee and AUM, so they are Input missing.
- 21 leveraged/inverse, 3 ETNs, 3 excluded: as expected.

## What was collected

- **Source:** issuer domains only (fund pages, fact sheets, prospectuses, issuer 10-Q copies). No Yahoo or aggregators. Each batch was run by a subagent, and each value was recorded with its quoted source text in the evidence file.
- **Checks on every value:** the fee and AUM figures must appear in the quoted source text, with units and rounding handled. Every one of the 60 net fees and 164 AUM values passes. Source URLs are on the issuer's domain. Dates are ISO.
- **Net fee:** 60 entries. 37 are from the summary-prospectus total (decision 1). 12 are a labelled, dated net fee from an issuer source. 11 are a labelled "Net Expense Ratio" with an undated source, recorded at the fetch date (decision 2). Gross-only figures are never used.
- **AUM:** 164 entries. 24 are undated and recorded at the fetch date. Every dated value is no older than 12 months at the cutoff.
- **Legal form:** 95 "yes", 127 "no" (the 3 excluded entries are "no" by default).
- **Inception date:** recorded where the issuer page showed it.

## Decisions

1. **Summary-prospectus total counts as net (approved).** Vanguard and Global X prospectuses show "Total Annual Fund Operating Expenses" with no waiver line. That total is the net expense ratio. This unlocked 37 entries: the 34 with a legal-form yes, plus AIQ, SDIV and DRIV (Global X ETFs with a legal-form no, which are ungated under decision 4).
   - Vanguard's fee date is the fact-sheet date (2026-06-30). The prospectus value is in the notes column of the evidence file.
   - Eight Global X prospectus fee dates are from 2025 (QYLD, COPX, URA, LIT, ARGT, ASEA, BOTZ, CTEC). Global X's product pages show the same totals as of October 2026, and the agent confirmed the figures match. This is the main staleness exposure in the table.
   - Global X values were read from summary prospectuses on the "/dev/" path of assets.globalxetfs.com, not the production path.

2. **Undated values take the fetch date, 2026-10-10 (approved).** This applies to 11 net fees and 24 AUM figures, each flagged in its reason. The source documents do not show a date, so the date recorded is when the page was read, not when the figure was published. Undated labelled figures include ProShares net fees (QLD, UPRO, USD, SQQQ, DBC, DBO, DBA, SPMO, SPLV, SPHD, AOR), ProShares and YieldMax net assets, and Invesco fees.

3. **Staleness and waiver rules (my recommendation, approved).**
   - **Fees:** no age limit. A summary-prospectus fee table stays valid until replaced. A fee is withdrawn only if a waiver or cap ended before the run date. This withdrew TQQQ (waiver ended 2026-09-30), PDBC (ended 2026-08-31) and ARKX (ended 2025-11-30). GRID, QTEC, REMX, VNM, ESPO and the other capped funds stay, since their caps run past the run date.
   - **AUM:** must be dated within 12 months of the cutoff. This withdrew DBA and DBO's 2022 AUM. ARK's 2025-09-30 AUM is kept because it sits exactly on the boundary.

4. **Legal-form gate applies to commodity-pool and trust entries only (as the spec ladder says).** Plain ETFs are not gated, so 9 Ranked entries have a legal form recorded as "no": AIQ, QTEC, AOR, REMX, SDIV, VNM, JPIN, DRIV, ESPO. The plan's Section 5 text asks for a verified legal form on every ETF. If you apply that text instead, those 9 drop out of Ranked. This is still a real conflict between the spec and the plan, and it is the one most likely to be queried later.

**Rounded AUM accepted (not in the original decisions).** SGOL, PPLT and FLKR show dated fund-level figures rounded to two or three significant figures. They are accepted at display precision, as the ARK figures already were. These are flagged in their reasons.

## Source gaps (not fixable from here)

- **Direxion** (8 entries): every direxion.com page and fact-sheet PDF returned 403 or unreadable binary. All 8 are unknown.
- **iShares** (52): product pages show only "Fees as stated in the prospectus", with no net label and no date. Prospectus and SAI PDFs are not text-readable through WebFetch. Only AOR has a net label, and it is undated, so it is recorded at the fetch date (decision 2). Legal form could not be confirmed for any 40-Act iShares ETF.
- **Vanguard (22):** the fact-sheet fee note says "As reported in the most recent prospectus", so Vanguard's fee relies on the summary prospectus (decision 1).
- **ProShares** (11): net labels are undated and their prospectus site refused connections. Fees are recorded at the fetch date.
- **USCF** (USO, CPER, BNO, UNG): fee and AUM are JavaScript-rendered and absent.
- **JETS**: issuer page 403.
- **Schwab** (SCHD, SCHG): 403. **Sprott** (URNM): 403. **VanEck** overview pages: redirect loops; VanEck fact-sheet PDFs were read with curl instead.
- **SSGA**: prospectus links were unreadable. Legal form is confirmed only for DIA and SPY ("unit investment trust").
- **Invesco**: net labels are undated, and several fact-sheet PDFs were unreadable. SPMO, SPLV and SPHD now carry a fetch-dated fee but no usable AUM, so they are Input missing. PDBC's waiver ended before the run date, so its fee is withdrawn.

## Data flags for review

- **FNGU** (ETN): the only source is a 2021 fact sheet. Search results suggest BMO redeemed it in 2025. Check whether it is still live.
- **HACK**: the page shows two inception dates (2014-11-10 and 2014-11-11). The earlier one is recorded. HACK is Input missing, so this does not change the ranking.
- **CTEC**: the batch name said "CleanTech". The issuer page says "ClimateTech". Recorded under the ticker. CTEC is now Ranked.
- **ARK fact sheets** are dated 2025-09-30. ARK AUM is at display precision. ARK funds are Input missing because their fees are not labelled net.
- **QDTE**: the issuer page gives a gross fee of 0.96% in one place and 0.97% in another. Both are gross, so not used.
- **Quotes** are WebFetch model summaries of pages, not raw page bytes. Check the page directly before acting on any value.
- **Global X** prospectus dates and the "/dev/" path (decision 1) are the largest source-quality caveat in the Ranked set.

## Not done

- Phase 2 (scoring module) has not started. Per the plan, it waits for this report.
- Raw Tiingo history is not in this repository and was not needed for Phase 1.
- Not checked: the Phase 0 volume-consolidation question (plan Section 10, item 6).
