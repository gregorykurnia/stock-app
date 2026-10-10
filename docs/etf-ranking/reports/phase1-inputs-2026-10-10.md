# ETF ranking Phase 1: inputs and eligibility · 2026-10-10

Part of the [blank-slate ranking plan](../../etf-blank-slate-ranking-plan.md), Phase 1. Files: [data/etf-ranking-inputs.csv](../../../data/etf-ranking-inputs.csv) (222 rows, one per catalogue entry) and [phase1-evidence-2026-10-10.csv](phase1-evidence-2026-10-10.csv) (the quoted source text behind each fee, AUM and legal-form value, with the agent's notes).

## Exit check

All 222 catalogue entries have exactly one eligibility state and a reason. Each state was applied in the order the spec gives: Excluded, Separate list, Too new, Legal form unverified, Input missing, Ranked.

| State | Count | Notes |
|---|---|---|
| **Ranked** | **6** | QTEC, REMX, QCLN, VNM, JPIN, ESPO |
| Separate list | 24 | 21 leveraged/inverse, 3 ETNs (FNGU, SLVO, USOI) |
| Too new | 15 | Under 36 months at 2026-09-30 (Phase 0 `horizon_3y = false`) |
| Legal form unverified | 8 | GLD, SGOL, PPLT (physical-metal trusts); DBC, GSG, WEAT, CORN, SOYB (commodity pools) |
| Input missing | 166 | See the breakdown below |
| Excluded | 3 | FCNCA, TEM (operating-company stocks), ACP (closed-end fund). Fee and AUM not collected. |
| **Total** | **222** | |

**Only 6 of 222 entries are Ranked.** That is the result of the strict input rules below, not of the scoring. Most of the gap is unverified fees, not missing funds.

### Input missing breakdown

- Net fee missing, AUM present: 119
- AUM missing, net fee present: 3
- Both missing: 44

### Reconciliation with the expected counts

- 21 below 3 years (Phase 0): 15 are Too new. The other 6 are in the Separate list (MSTU, BITU, MSTZ, FNGU, USOI) or Excluded (TEM).
- 15 "commodity-pool/trust" catalogue entries: 4 are leveraged (AGQ, UGL, BOIL, KOLD), so they are in the Separate list. The other 11 are in Legal form unverified (5), or Input missing (6, because USO, CPER, BNO, UNG, DBA and DBO have a legal form confirmed but no dated fee).
- 21 leveraged/inverse, 3 ETNs, 3 excluded: as expected.

## What was collected

- Source: issuer domains only (fund pages, fact sheets, prospectuses, issuer 10-Q copies). No Yahoo or aggregators. Each batch was run by a subagent, and each value was recorded with its quoted source text in the evidence file.
- Automatic checks on every value: the net fee and the AUM figure must appear in the quoted source text (with unit and rounding handled); the source URL must be on the issuer's domain; dates must be ISO. Every check passed after unit normalisation.
- Net fee: 9 usable values (JEPI, JEPQ, JPST, QTEC, REMX, QCLN, VNM, JPIN, ESPO), each with a dated, labelled net figure. A further 13 net labels had no date and were left blank (AOR, SPMO, SPHD, SPLV, PDBC, DBC, DBA, DBO, TQQQ, QLD, UPRO, USD, SQQQ).
- AUM: 133 usable values, each with an as-of date no older than six months before the cutoff.
- Legal form: 95 "yes", 127 "no" (the 3 excluded entries are "no" by default). Only commodity-pool and trust entries are gated on it (see decision 4).
- Inception date: recorded where the issuer page showed it.

## Decisions taken, and open for you

These are the decisions I made to apply the spec. Each one changes the Ranked count, so please confirm or reverse each.

1. **"Total Annual Fund Operating Expenses" with no waiver line counts as net? (open; largest effect).** Vanguard's fact sheets defer to the prospectus, which shows only a total. The spec accepts net only when labelled net. Under the strict reading, Vanguard's 22 entries and Global X's 15 are unknown. If accepted, 34 entries would have a dated AUM and a legal-form yes, and would move to Ranked: VOO, VTI, VXUS, VEA, VT, VWO, VUG, VOOG, MGK, VTV, VIG, VYM, VYMI, VGT, VNQ, VNQI, BND, BNDX, VCIT, VCSH, VTIP, VUSB, plus Global X's ARGT, ASEA, BOTZ, BUG, CLOU, COPX, CTEC, DTCR, LIT, QYLD, SHLD, URA. The Global X fee values were not stored in the notes, so they would need re-extraction. Global X's value is also from the prospectus "/dev/" path on assets.globalxetfs.com, not the production path.

2. **Undated issuer values (open).** The spec says to record the source document's own date. Many issuer pages show a fee or AUM with no date. Those are blank, not recorded against the fetch date. Options: keep blank (current), or record the fetch date (2026-10-10) and mark the source undated. The second would make 13 net-labelled fees usable and unlock most of the AUM-only gaps. It changes what "source date" means, so it needs your decision.

3. **Six-month staleness (my threshold, not in the spec).** A fee or AUM dated before 2026-03-30 is treated as missing. This withdrew GRID (fee dated 2026-02-02, capped through 2027-01-31), AVUV and AVDV (2026-01-01), ARKX (2025-09-30, waiver ended 2025-11-30), and DBA and DBO's AUM (2022). GRID's cap runs past the cutoff, so it is the most arguable of these. Revisit if you want a longer window.

4. **Legal-form gate applied to commodity-pool and trust entries only.** The ladder in the spec gates "commodity-pool/trust entries until checked", so plain ETFs are not gated. But plan Section 5 says Ranked needs a verified legal form for every ETF. Under that reading, 5 of the 6 Ranked entries drop: QTEC, REMX, VNM, JPIN and ESPO have no legal-form confirmation. This is a real conflict between the spec and the plan text; I followed the spec.

5. **Dates from a fact sheet or prospectus.** Fee dates use the document's date (fact sheet or prospectus). AUM dates use the printed as-of date. For ARK and some Roundhill/VanEck block-level labels, the date applies to the whole block; these are noted in the evidence file.

## Source gaps (not fixable from here)

- **Direxion** (8 entries): every direxion.com page and fact-sheet PDF returned 403 or unreadable binary. All 8 are unknown.
- **iShares** (52 entries): the product pages show only "Fees as stated in the prospectus", with no net label and no date. Prospectus and SAI PDFs are not text-readable through WebFetch. Legal form could not be confirmed for any of the 40-Act ETFs.
- **Vanguard** (22): fact sheets say "As reported in the most recent prospectus". The prospectus gives only a total (decision 1).
- **ProShares** (11): net labels are undated; prospectus.proshares.com refused connections.
- **USCF** (USO, CPER, BNO, UNG): fee and AUM are JavaScript-rendered and absent.
- **JETS**: issuer page 403.
- **Schwab** (SCHD, SCHG): 403. **Sprott** (URNM): 403. **VanEck** overview pages: redirect loops; VanEck fact-sheet PDFs were read with curl instead.
- **SSGA**: prospectus links were unreadable. Legal form is confirmed only for DIA and SPY ("unit investment trust").
- **Invesco**: net labels are undated; several fact-sheet PDFs were unreadable.

## Data flags for review

- **FNGU** (ETN): the only source is a 2021 fact sheet. Search results suggest BMO redeemed it in 2025. Check it is still live.
- **HACK**: the page shows two inception dates (2014-11-10 and 2014-11-11). The earlier one is recorded.
- **CTEC**: the batch name said "CleanTech". The issuer page says "ClimateTech". Recorded under the ticker.
- **ARK fact sheets** are dated 2025-09-30. ARK AUM is at display precision, and all ARK funds are Input missing.
- **QDTE**: the issuer page gives a gross fee of 0.96% in one place and 0.97% in another. Both are gross, so not used.
- **TQQQ**: the page shows a net fee of 0.82% with a waiver ending 2026-09-30. The fee is undated, so it is blank.
- **Global X** prospectuses were read from the "/dev/" path on assets.globalxetfs.com, which is not the production path (see decision 1).
- **Quotes** are WebFetch model summaries of pages, not raw page bytes. For any value you act on, check the page directly.

## Not done

- Phase 2 (scoring module) has not started. Per the plan, it waits for this report.
- Raw Tiingo history is not in this repository and was not needed for Phase 1.
- Not checked: the Phase 0 volume-consolidation question (plan Section 10, item 6).
