Add a new “Portfolio Allocation” visualization to the /performance page of this existing Next.js portfolio app.

Placement:
- Put it directly below the KPI summary cards and above the historical performance chart.
- Reuse or replace the existing bucket summary cards so there is only one clear allocation section.
- Do not put this inside the accounting activity panel; that panel is for managing transactions.

Purpose:
Show how the portfolio was originally allocated based on entry value/cost basis, rather than current market value.

Data rules:
- Use the current portfolio ledger and reduce it with the existing reducePortfolioLedger logic.
- Use each position’s costBasisUsd as its entry value.
- Do not use current marketValueUsd or valueUsd for the allocation percentages.
- Total entry value is the sum of all open positions’ costBasisUsd.
- Individual holding percentage = holding costBasisUsd / total entry value × 100.
- Bucket percentage = total costBasisUsd within the bucket / total entry value × 100.
- Exclude cash from the denominator and state this clearly in the UI.
- Sort individual holdings from largest to smallest entry value.
- Update automatically when the ledger changes.
- If there is no cost basis data, show a clear empty or incomplete-data state instead of silently using market value.

Visual design:
- Use the existing clean white surface-card style, spacing, typography, and CSS variables.
- Build a modern responsive allocation panel.
- Desktop layout:
  - Left side: a simple SVG or CSS donut chart for the four portfolio buckets.
  - Center of donut: total entry value and “Entry value”.
  - Right side: a ranked list of all holdings with horizontal proportional bars.
- Each holding row should show:
  - ticker
  - company name when available
  - bucket label
  - entry value
  - percentage of total entry value
- Color each holding bar according to its bucket.
- Add a compact legend for Long Term, Index, Swing, and Treasury.
- Include subtle hover states/tooltips with exact values.
- On mobile, stack the donut above the ranked holdings list.
- Keep the visual readable with all 21 holdings; use a two-column holding list on large screens if needed.
- Use accessible labels and do not rely on color alone.

Summary details:
- Show total entry value prominently.
- Show the number of positions.
- Add a small note: “Based on ledger cost basis · excludes cash.”
- Respect the existing USD/IDR display toggle for displayed dollar values, but keep percentages based on USD cost basis.

Implementation quality:
- Prefer a small reusable component such as PortfolioAllocationPanel.
- Keep the calculation logic in a pure helper so it can be unit-tested.
- Add focused tests for bucket percentages, individual holding percentages, sorting, missing cost basis, and zero-value edge cases.
- Do not change the Firestore schema.
- Do not add any write operations.
