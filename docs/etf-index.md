# ETF docs index

Last updated: 2026-10-09. Start with the first row. Nothing has been deleted. The dated records and superseded plans now live in [etf-archive/](etf-archive/).

## Start here

| File | Status | What it is |
|---|---|---|
| [etf-blank-slate-ranking-plan.md](etf-blank-slate-ranking-plan.md) | **Current plan** (plan only, no code yet) | The ETF ranking plan to follow. Has a differentiation table and an inventory of every earlier artifact. |

## Reference (still in use)

| File | Status | What it is |
|---|---|---|
| [etf-page-plan.md](etf-page-plan.md) | Partly superseded | Structure of the `/etf` page, the category model and metric definitions. Its score language is superseded. |
| [etf-quantitative-comparison-plan.md](etf-quantitative-comparison-plan.md) | Partly superseded | Metric definitions still apply. Scoring text is superseded. Has an uncommitted edit by Greg that is not part of this index work. |
| [pluang-etf-research.md](pluang-etf-research.md) | Reference | Research on the Pluang ETF catalogue. |
| [research/pluang-etf-2026-10-06/](research/pluang-etf-2026-10-06/) | Reference, used by code | Catalogue data, 222 entries. `lib/etfCatalog.ts` reads it, so it must stay in place. |

## Dated records (evidence, not for reading in order)

| File | Status | What it is |
|---|---|---|
| [etf-core-coverage-2026-10-06.md](etf-archive/etf-core-coverage-2026-10-06.md) | Record | Tiingo Core coverage. Confirmed history for VOO, VTI and VXUS. |
| [etf-quantitative-coverage-2026-10-06.md](etf-archive/etf-quantitative-coverage-2026-10-06.md) | Record | Source-readiness table: which inputs were available and which were blocked, as of 2026-10-06. |
| [etf-quantitative-readiness.json](etf-archive/etf-quantitative-readiness.json) | Record | Machine-readable version of the readiness table above. |
| [etf-free-core-trial-2026-10-07.md](etf-archive/etf-free-core-trial-2026-10-07.md) | Record | Yahoo-based VOO/VXUS trial, shown at `/etf/free-core-trial`. Yahoo data is evidence only. |
| [etf-equity-index-validation-batch-2026-10-07.md](etf-archive/etf-equity-index-validation-batch-2026-10-07.md) | Record | Yahoo-based eight-fund equity-index batch. |
| [etf-equity-index-audit-2026-10-07.md](etf-archive/etf-equity-index-audit-2026-10-07.md) | Record | M1 audit. Found the precision bug in Next.js's compiled JSON, which changed VOO's history hash. |
| [etf-equity-index-m3-validation-2026-10-07.md](etf-archive/etf-equity-index-m3-validation-2026-10-07.md) | Record | M3 validation report on the 12-fund frozen sample. Yahoo-based. |

## Superseded plans and handoffs

These describe the M1–M4 equity-index gate process, which is replaced by the blank-slate plan. Read them only for history.

| File | Status | What it is |
|---|---|---|
| [etf-scoring-roadmap.md](etf-archive/etf-scoring-roadmap.md) | Superseded | The M1–M9 master roadmap. Last record of M4 progress. |
| [etf-independent-grand-score-plan.md](etf-archive/etf-independent-grand-score-plan.md) | Superseded for scoring | Original Core, Full and execution formulas. Its access and coverage findings remain valid evidence. |
| [etf-ranking-plan.md](etf-archive/etf-ranking-plan.md) | Superseded | First ranking draft, before the blank-slate plan. |
| [etf-equity-index-audit-handoff.md](etf-archive/etf-equity-index-audit-handoff.md) | Superseded | Handoff into the M1 audit. |
| [etf-scoring-m2-handoff.md](etf-archive/etf-scoring-m2-handoff.md) | Superseded | M2 candidate specification for the Yahoo equity-index method. |
| [etf-scoring-m3-handoff.md](etf-archive/etf-scoring-m3-handoff.md) | Superseded | M3 sample and gate definitions. |
| [etf-scoring-m4-handoff.md](etf-archive/etf-scoring-m4-handoff.md) | Superseded | M4 durable-storage handoff. M4 is not being continued. |
| [etf-scoring-m4-readiness-2026-10-07.md](etf-archive/etf-scoring-m4-readiness-2026-10-07.md) | Superseded | M4 readiness record and the data-use policy it relied on. |

## Notes

- **Yahoo data** in the records above is evidence only. The blank-slate plan does not use it for ranking.
- **Step 2 done (2026-10-09):** the 15 dated-record and superseded files were moved into `etf-archive/` with `git mv`, and links were updated to match.
- **Known broken links:** `etf-quantitative-comparison-plan.md` still points to three files that moved. Its uncommitted edit was not touched. Its links need updating once that edit is committed.
- **Code and data** are outside this index. The blank-slate plan's Section 9 lists them with their status.
