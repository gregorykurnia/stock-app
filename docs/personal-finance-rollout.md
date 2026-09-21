# Personal Finance Rollout Plan

Status: planned

Created: 2026-09-18

## Goal

Add a small Personal Finance area to the stock app for recording monthly income and planned deductions, then showing the amount available for recommended VOO, VXUS, and SGOV DCA.

The first release should be easy to maintain and cheap to run. It should use the app's existing App Router, Firestore helpers, and styling patterns. It should not add external financial data, bank integrations, brokerage actions, or a new charting dependency.

## Repository findings

- The app uses the Next.js App Router. The installed package is Next.js 16.2.10; this is newer than the Next.js 14 reference in CLAUDE.md. The installed package and the local documentation under node_modules/next/dist/docs/ are the source of truth for implementation.
- The shared top navigation is in app/layout.tsx.
- Existing client pages call Firestore functions from lib/firestore.ts directly.
- Existing visual styles include surface-card, input-field, field-label, btn, and segmented controls in app/globals.css.
- The test command compiles an explicit list of test and library files, so a new calculator test and source file must be added to that command.
- The existing chart dependency is lightweight-charts, but a chart is not needed for the first release.

## v1 scope

### Included

- A top-level Personal Finance link alongside Markets and Performance.
- A /personal-finance route.
- One record per month.
- Inputs for income, Credit Card Payment, Future Planning Installments, and Actual Monthly Spending.
- An automatic fixed Monthly Petty Cash Spendings deduction of Rp2,500,000.
- Automatic deficit carryover into the next recorded month.
- Automatic 60% VOO, 25% VXUS, and 15% SGOV recommendations when the remainder is positive.
- Add, edit, and delete monthly records.
- A selected-month summary and a chronological history table.
- IDR formatting and responsive layout using existing styles.
- Pure calculation tests for normal, zero, deficit, carryover, rounding, and display-only spending cases.

### Deferred

- Charts and trend visualizations.
- Custom allocation percentages.
- A settings screen for the petty cash amount.
- Bank or credit-card syncing.
- Brokerage integrations or automatic trade placement.
- Multi-currency support.
- Authentication or a change to the app's existing Firestore access model.

The deferred items keep the first rollout small. A compact history chart can be added later if several months of data make it useful.

## Calculation contract

Calculations must be implemented in a pure TypeScript module so the UI and tests use the same logic.

Process records in ascending month order. For each record:

1. Apply the previous record's outstanding deficit as carryover. For consecutive records, this is the previous calendar month. If a month is skipped, preserve the outstanding deficit until the next recorded month; do not create synthetic empty records.
2. Calculate planned deductions as Credit Card Payment + Future Planning Installments + Rp2,500,000 fixed petty cash.
3. Calculate the remainder as Income - Carryover Applied - Planned Deductions.
4. If the remainder is positive, calculate DCA from that remainder.
5. If the remainder is zero or negative, set all DCA recommendations to zero.
6. If the remainder is negative, carry its absolute value into the next recorded month.

Use these formulas:

- carryoverApplied = previous deficit carryover
- plannedDeductions = creditCardPayment + futurePlanningInstallments + 2,500,000
- remainder = income - carryoverApplied - plannedDeductions
- dcaBase = max(remainder, 0)
- vooRecommendation = round(dcaBase × 0.60)
- vxusRecommendation = round(dcaBase × 0.25)
- sgovRecommendation = dcaBase - vooRecommendation - vxusRecommendation
- deficitCarryover = max(-remainder, 0)

Derive SGOV as the remainder after the rounded VOO and VXUS amounts so the three recommendations always sum exactly to the positive DCA base in whole rupiah.

Actual Monthly Spending must be retained and displayed, but it must never be used in any formula.

### Required examples

Positive month:

- Income: Rp20,000,000
- Credit Card Payment: Rp5,000,000
- Future Planning Installments: Rp4,000,000
- Fixed petty cash: Rp2,500,000
- Remainder: Rp8,500,000
- VOO: Rp5,100,000
- VXUS: Rp2,125,000
- SGOV: Rp1,275,000
- Deficit carryover: Rp0

Deficit followed by recovery:

- Month one with Income Rp8,000,000, Credit Card Payment Rp4,000,000, and Future Planning Installments Rp3,000,000 produces a Rp1,500,000 deficit after petty cash.
- The next recorded month first applies the Rp1,500,000 carryover, then applies that month's three planned deductions.
- DCA remains zero until that month's final remainder is positive.

## Data model

Use one Firestore collection with deterministic month document IDs:

personal_finance_months/{YYYY-MM}

Store raw inputs and timestamps only:

- month: string in YYYY-MM format
- income: non-negative integer rupiah
- credit_card_payment: non-negative integer rupiah
- future_planning_installments: non-negative integer rupiah
- actual_monthly_spending: non-negative integer rupiah or null
- created_at: ISO timestamp
- updated_at: ISO timestamp

Do not persist carryover, remainder, or DCA values in v1. They are derived from the ordered raw records each time. This prevents stale derived values after editing an earlier month and avoids extra write fields.

Use constants in lib/personalFinance.ts for:

- fixed petty cash: 2,500,000
- VOO allocation: 60%
- VXUS allocation: 25%
- SGOV allocation: 15%

Do not create a settings document or a settings read in v1.

## Proposed implementation slices

### Slice 1: calculation core

Create lib/personalFinance.ts with:

- input and computed row types;
- the three allocation constants;
- validation for whole non-negative rupiah values;
- a single pure function that converts ordered monthly inputs into computed rows;
- IDR formatting helpers only if an existing shared formatter is not suitable.

Create tests/personalFinance.test.ts and cover:

- positive remainder and 60/25/15 allocation;
- exact zero remainder;
- negative remainder and zero DCA;
- carryover applied before current deductions;
- multiple consecutive deficits;
- skipped-month carryover behavior;
- VOO rounding with VXUS balancing the total;
- changing Actual Monthly Spending without changing any calculation.

Add the new source and test file to the existing npm test script.

### Slice 2: Firestore persistence

Add narrowly scoped helpers to lib/firestore.ts:

- getPersonalFinanceMonths;
- savePersonalFinanceMonth;
- removePersonalFinanceMonth.

Use getDocs once when the page loads. Use setDoc with the deterministic YYYY-MM document ID for create and edit. Update local React state after a successful write instead of immediately re-reading the collection. Remove the deleted row from local state after a successful delete.

This keeps normal usage to one collection read on page load and one write per save or delete. Do not use a realtime listener or polling.

### Slice 3: route and navigation

Create app/personal-finance/page.tsx as a small route wrapper and keep interactive state in components/PersonalFinanceDashboard.tsx with the client directive.

Add the Personal Finance Link in app/layout.tsx using the same class names and placement style as the existing top-level links.

The dashboard should provide:

- loading, empty, saving, and error states;
- a month input and numeric fields;
- a clear fixed petty cash line showing Rp2,500,000;
- save, edit, and delete controls;
- a selected-month summary;
- a newest-first history table;
- status labels for DCA available, balanced, and deficit carried forward.

Use an integer rupiah input model. Format values for display with Indonesian locale and zero decimal places. Do not introduce a new component library or formatting dependency.

When an existing month is selected for editing, load its raw inputs into the form. Recalculate all rows locally after every successful save or delete so downstream carryover immediately reflects the change.

### Slice 4: validation and release

Run the smallest relevant checks first:

1. npm run lint
2. npm run typecheck
3. npm test
4. npm run build

Use a local browser check for the route at desktop and mobile widths. Verify persistence by saving a row, reloading the page, editing an earlier row, and confirming downstream carryover changes.

Do not add a chart in this slice. Reassess after real monthly data exists.

## UI behavior and copy

Use plain labels:

- Income
- Credit Card Payment
- Future Planning Installments
- Monthly Petty Cash Spendings
- Carryover Applied
- Remaining Balance
- Recommended DCA
- VOO
- VXUS
- SGOV
- Actual Monthly Spending

The summary should make the order of operations visible: income, prior deficit, three planned deductions, remaining balance, then DCA recommendation. Negative remainder should use clear warning styling and state that the deficit will be deducted from the next recorded month.

Recommended DCA amounts are guidance values only. Do not describe them as executed investments.

## Cost and token controls

- Reuse existing Firestore, Tailwind, and CSS utilities.
- Add no npm packages.
- Add no API route and no external data request.
- Keep all business rules in one pure module instead of duplicating formulas in the component.
- Store only raw monthly inputs; compute derived values locally.
- Use deterministic document IDs to avoid duplicate detection queries.
- Read the collection once per page load and avoid listeners or polling.
- Update local state after mutations instead of re-fetching.
- Keep v1 to one dashboard component unless a file becomes difficult to review.
- Skip charts, settings, and integrations until the core workflow is validated.
- Run targeted tests during iteration, then the repository's required validation commands once before commit.

## Acceptance criteria

The rollout is complete when all of the following are true:

- Personal Finance appears at the same top navigation level as Markets and Performance.
- The route loads without changing existing pages.
- A user can save one monthly record and see it after a full reload.
- A month cannot be duplicated because its YYYY-MM document ID is deterministic.
- Rp2,500,000 is deducted automatically for every recorded month.
- A previous deficit is applied before the current month's three planned deductions.
- A deficit month shows zero VOO, VXUS, and SGOV recommendations and carries the deficit forward.
- A positive remainder produces exactly 60% VOO, 25% VXUS, and 15% SGOV after whole-rupiah rounding, with the rounded recommendations summing to the DCA base.
- Actual Monthly Spending is visible and changing it does not change remainder, carryover, or DCA.
- Editing or deleting an earlier month recalculates all later rows.
- Empty, loading, save-error, and delete-error states are understandable.
- The page works at desktop and narrow mobile widths.
- Lint, typecheck, tests, build, and the manual browser check pass.
- Only the related files are committed, and the current branch is pushed to origin.

## Risks and decisions to preserve

- Firestore rules may need to allow the new collection. Check the existing rules and surface a clear error if access is denied; do not silently fall back to local-only storage.
- The fixed petty cash amount is a v1 constant. Changing it later should be a deliberate migration or settings feature so historical calculations do not change unexpectedly.
- Carryover is based on the next recorded row when a month is skipped. If personal usage shows that strict calendar-month behavior is preferable, make that a separate decision before changing the calculator.
- The older Next.js version described in CLAUDE.md must not override the installed package or current local Next.js documentation.

## Handoff prompt for implementation

Implement this rollout from top to bottom in small validated slices. Read AGENTS.md, inspect the current files listed in this document, and read the relevant installed Next.js documentation before writing code. Start with the pure calculation module and tests, then add Firestore helpers, then add the route, navigation, and dashboard. Preserve existing stock behavior, use existing styles, add no dependencies, and keep derived finance values in memory. Run lint, typecheck, tests, build, and the required browser checks. Commit and push only after the related change passes validation.
