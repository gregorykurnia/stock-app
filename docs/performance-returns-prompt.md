# Performance Returns feature prompt

Status: requirements clarified; product and implementation draft
Requested: 2026-09-27

## Recommended location

The app already has top navigation links for **Master Table**, **Portfolio**, and **Performance**. Add **Performance Returns** as a new top-level tab immediately to the right of **Performance**.

Suggested order: **Master Table → Portfolio → Performance → Performance Returns → Personal Finance**. Use a dedicated route such as `/performance-returns`. Reuse the existing Performance data helpers and design system, while keeping the current `/performance` dashboard for portfolio value, TWR, XIRR, accounting, and allocation.

## Copy/paste implementation prompt

```text
Build a new top-level “Performance Returns” page at `/performance-returns` and add its navigation link immediately to the right of the existing “Performance” link in this Next.js stock portfolio app.

Before changing code, inspect the existing Performance page, portfolio ledger, portfolio snapshots, portfolio bucket model, Yahoo Finance data helpers, top navigation, and tests. Reuse the current architecture and styles. Keep the existing portfolio value, TWR, XIRR, accounting, and allocation views working.

Initial ticker universe and selection
-------------------------------------

- Start with the thirteen stocks currently intended for the user’s portfolio, plus SGOV, VXUS, and VOO.
- Treat the initial universe as an editable selection list. The user must be able to add or remove tickers one by one later.
- Read the thirteen initial stock symbols from the current portfolio source at implementation time unless an explicit symbol list is supplied. Seed SGOV, VXUS, and VOO explicitly even when they are not currently held in the ledger.
- Keep the selected return basket separate from the actual transaction ledger. A ticker can be included for historical comparison without pretending that the user owned it during every prior year.

Purpose
-------
Show a numeric annual percentage table for every selected ticker and an equal-weight historical basket summary for 2016 through the current year. The current year must be shown as YTD through the latest available market close.

The view must separate these measures:

1. Price return: change in the stock’s market price.
2. Cash dividend yield: cash dividends per share received during the period divided by the period’s beginning share price.
3. Cash total return: price change plus cash dividends, using the same beginning-price denominator.
4. Annualized return: compounded annual growth rate (CAGR) across the selected period.

The main result is the cash-received version. Use raw close data for the price-return calculation when dividends are shown separately. If adjusted close is used for an optional reinvested-dividend series, show it separately and do not add the cash dividend yield to it again.

Period rules
------------

- Default start year: 2016.
- Default end period: the current calendar year through the latest available close, labelled “YTD”.
- Show one row for each year: 2016, 2017, …, the last completed year, and the current YTD year. This produces eleven year labels when the current year is 2026.
- Calculate each full-year return from the last available trading close before the calendar year to the last available trading close inside that calendar year.
- Calculate current YTD from the last available close of the prior calendar year to the latest available close in the current year.
- Fetch the prior-year closing observation required to calculate 2016. Handle weekends, holidays, missing observations, and delisted tickers with an explicit data-quality status.
- Use the provider’s split-adjusted price history and historical dividend events. Keep the source and as-of date visible in a tooltip or metadata area.

Per-stock calculations
----------------------

For each ticker and year, calculate:

    priceReturn = (endClose / startClose) - 1
    dividendYield = dividendsPerSharePaidDuringYear / startClose
    cashTotalReturn = (endClose + dividendsPerSharePaidDuringYear - startClose) / startClose

Show annual dividend dollars per share as a separate field so the user can distinguish a payout amount from a percentage yield.

For each ticker across the selected period, calculate:

- Arithmetic average annual price return.
- Arithmetic average annual dividend yield.
- Arithmetic average annual cash total return.
- Cumulative compounded cash total return.
- Annualized cash total return (CAGR).
- Best year and worst year.
- Number of positive years and number of years with usable data.
- Annualized volatility from the annual or higher-frequency return series when enough history exists.
- Maximum drawdown from the annual or higher-frequency total-return series when enough history exists.
- Dividend growth by year when the dividend history supports it.
- Annual comparison against VOO as the primary S&P 500 benchmark, including excess return and cumulative/CAGR comparison when enough history exists.

Use null or an explicit “Insufficient history” state for missing observations. Never turn missing data into 0%. A confirmed non-dividend payer may show 0%; an unavailable dividend history must show an unavailable state.

Portfolio calculations
----------------------

Show two clearly labelled portfolio concepts when the data supports them:

1. Actual portfolio performance: use the existing ledger and snapshot methodology. Show calendar-year TWR when complete snapshots and flow data exist. Show personal XIRR where the current Performance page already supports it.
2. Historical basket estimate: calculate a historical return for the selected ticker list. Label it as an equal-weight historical basket because the current selection is applied to earlier years as a percentage comparison, rather than as a reconstruction of past ownership.

Use a pure calculation helper for the basket estimate. The initial method is equal weight:

- Equal weight: every selected ticker has the same weight.

For the first implementation, do not require cost-basis or market-value weights for the basket percentage. Show “Equal-weight historical basket” in the UI and keep actual ledger-backed TWR separate from the model basket estimate.

For each annual basket value, calculate the arithmetic mean of the usable selected-ticker percentages for that year. Normalize across usable tickers when a constituent lacks data, show the number of contributing tickers and coverage percentage, and mark the result partial.

For each year in the basket estimate, show:

- Portfolio price return.
- Portfolio dividend yield.
- Portfolio cash total return.
- Number of holdings contributing usable data.
- Weight coverage percentage.
- A partial-data indicator when one or more holdings lack history.

For the selected period, show these summary values:

- Average annual price return.
- Average annual dividend yield.
- Average annual cash total return.
- Cumulative compounded cash total return.
- Cash total-return CAGR.
- Best and worst year.
- Positive-year count.
- Maximum drawdown when the selected series supports it.

Keep “average annual return” and “CAGR” as separate labels. The arithmetic average of annual returns and the compounded annualized return answer different questions.

Suggested UI
------------

Add a top-level navigation link named “Performance Returns” immediately after “Performance”. Use `/performance-returns` for the page route.

At the top of the view, add:

- Ticker selection: the initial thirteen portfolio stocks plus SGOV, VXUS, and VOO, with one-by-one add/remove controls for future changes.
- Portfolio scope: All active holdings, Long Term, Index, or Treasury, with bucket filters.
- Start year, defaulting to 2016.
- End period, defaulting to the current YTD.
- Return basis: show Price Return, Cash Dividend Yield, and Cash Total Return together in the annual table. An optional Reinvested Total Return series may be added later.
- A small data-source and coverage note.

Add KPI cards for the selected portfolio or basket:

- Average Annual Price Return.
- Average Annual Dividend Yield.
- Average Annual Cash Total Return.
- Cash Total Return CAGR.
- Cumulative Cash Total Return.
- Best Year.
- Worst Year.
- Positive Years.

Add an annual table with one row per year and columns for year, price return percentage, cash dividend yield percentage, cash total return percentage, dividends per share, holdings with usable data, coverage, and status. Highlight the current YTD row and mark partial years clearly.

Add a per-stock table with ticker, company name, portfolio bucket, equal weight, every year’s price return percentage, every year’s cash dividend yield percentage, every year’s cash total return percentage, average annual price return, average annual dividend yield, average annual cash total return, cumulative total return, CAGR, volatility, maximum drawdown, best year, worst year, positive-year count, usable-year count, dividend growth, VOO excess return, and data status. Allow the user to expand a stock row or switch to a year-by-year ticker matrix when practical.

Add a compact chart showing annual price return, cash dividend yield, and cash total return for the equal-weight basket, with VOO/S&P 500 comparison. Keep negative years visually distinct and make the exact values available to keyboard and screen-reader users through the table and accessible labels.

Data quality and edge cases
---------------------------

- Show “—” or a specific status for missing data; never silently use zero.
- Mark the current year as YTD and include the as-of date. In the current 2016–2026 request, the row is 2026 YTD.
- Require a prior-year close for every annual price-return calculation.
- Show market history for a stock added after 2016 in the per-stock table when available, while clearly labelling the equal-weight basket as a current selection applied historically. Show only usable years for that stock and a coverage count.
- Handle ticker changes, splits, delistings, and missing dividend events through a visible status.
- Treat fees and taxes separately from stock total return. If actual ledger-backed portfolio TWR includes them, show that methodology in the existing Performance accounting area.
- Keep monetary dividend amounts in the source currency unless the user selects an existing app currency display option. Percent returns remain currency-neutral.
- Do not call an equal-weight basket result “personal return”. Reserve that label for ledger-backed measures such as TWR or XIRR.

Implementation and validation
----------------------------

- Reuse the existing `PortfolioPerformanceDashboard`, portfolio ledger, snapshot data, bucket definitions, and current design tokens where appropriate.
- Fetch historical prices and dividend events through the existing server-side Yahoo Finance integration or a new server route that follows the project’s established provider pattern. Avoid direct browser calls to the data provider.
- Keep calculations in pure helpers so they can be tested independently from the UI.
- Add focused tests for full-year returns, current YTD, dividends, no-dividend stocks, missing years, split-adjusted history, negative returns, cumulative return, CAGR, weighting, partial portfolio coverage, and the distinction between arithmetic average and CAGR.
- Preserve existing routes and Firestore schemas unless a schema change becomes necessary and is explicitly documented.
- Validate the implementation with the project’s relevant type checks, lint checks, and focused tests. Commit and push only the validated feature.
```

## Resolved requirements

1. **Location:** new top-level **Performance Returns** tab immediately to the right of **Performance**.
2. **Return values:** show both annual price return and annual cash total return, with the annual cash dividend percentage shown separately.
3. **Dividends:** treat dividends as cash received; reinvestment is optional future work.
4. **Dividend denominator:** use the first trading close of each year.
5. **Historical basket:** use equal weight. The first version is percentage-focused and does not need cost-basis or market-value weighting.
6. **Scope:** include all active holdings with Long Term, Index, and Treasury bucket filters.
7. **Period:** show 2016 through the current YTD year.
8. **Later additions:** allow one-by-one ticker selection. Show a recently added ticker’s available market history, while labelling the basket as a historical estimate based on the current selection.
9. **Non-dividend payers:** show 0% when the provider confirms no dividend; show “Unavailable” for a data gap.
10. **Secondary metrics:** include dividend growth, volatility, maximum drawdown, and S&P 500 comparison. Use VOO as the primary benchmark because it is part of the initial universe.

## Remaining clarification

The only concrete input still missing is the exact thirteen stock symbols if they differ from the stocks currently stored in the portfolio. The implementation can derive them from the current portfolio at build time, then seed SGOV, VXUS, and VOO explicitly. If you want a fixed list, provide the symbols before implementation.

## Recommended product defaults

Until the questions above are answered, use these defaults:

- Location: top-level **Performance Returns** tab immediately to the right of **Performance**, using `/performance-returns`.
- Initial selection: the thirteen current portfolio stocks plus SGOV, VXUS, and VOO.
- Period: 2016 through the current YTD year.
- Primary stock series: raw-close price return, cash dividend yield, and cash total return.
- Dividend denominator: first trading close of each year.
- Portfolio basket weighting: equal weight; show that label in the UI.
- Actual portfolio result: existing ledger-backed TWR/XIRR when sufficient history exists.
- Long-term summary: arithmetic average annual return, cumulative compounded return, and CAGR shown as separate metrics.
- Secondary metrics: dividend growth, volatility, maximum drawdown, and VOO/S&P 500 comparison.
- Missing data: explicit status and coverage percentage; missing observations never become 0%.

## Model recommendation for implementation

For one careful end-to-end implementation, use **GPT-6 Sol** with high or xhigh reasoning. OpenAI describes Sol as built for complex coding and agentic workflows, while GPT-6 Luna is positioned for efficient, focused, high-volume work. GPT-6 Astra is the strongest option for the hardest architecture or audit pass when cost is less important. See the [official OpenAI model guidance](https://developers.openai.com/api/docs/models).

Recommended workflow:

1. Use GPT-6 Sol to inspect the repo, settle the data model, implement the pure calculations, and build the page.
2. Use GPT-6 Astra for an independent review of the return formulas, dividend handling, missing-data behavior, and regression risk if it is available.
3. Use GPT-6 Luna for focused follow-up work such as test expansion, UI cleanup, formatting, and repetitive fixes.

If GPT-6 Luna is the only available option, use it with high or xhigh reasoning and require the same staged workflow: calculation helpers first, synthetic tests second, UI third, and a final audit against the acceptance criteria. Luna can handle this feature, but the data-methodology review and explicit tests carry more weight than the model name.
