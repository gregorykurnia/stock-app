# Performance Returns feature prompt

Status: product and implementation draft  
Requested: 2026-09-27

## Recommended location

The app already has a top navigation link called **Performance** that opens `/performance`. Add **Performance Returns** as an inner view or subtab on that page, alongside the existing portfolio value and accounting views.

The phrase “top2 tab” needs confirmation. The current code has no tab with that exact name. If “top2” means the Master Table segmented tabs, place the feature there only after confirming that location. The existing `/performance` page is the better fit because it already loads portfolio snapshots, the transaction ledger, dividends, and return calculations.

## Copy/paste implementation prompt

```text
Build a new “Performance Returns” view inside the existing /performance page of this Next.js stock portfolio app.

Before changing code, inspect the existing Performance page, portfolio ledger, portfolio snapshots, portfolio bucket model, Yahoo Finance data helpers, and tests. Reuse the current architecture and styles. Keep the existing portfolio value, TWR, XIRR, accounting, and allocation views working.

Purpose
-------
Show the historical annual performance of each active portfolio stock and a clearly labelled portfolio summary for 2016 through the current year. The current year must be shown as YTD through the latest available market close.

The view must separate these measures:

1. Price return: change in the stock’s market price.
2. Dividend yield: cash dividends per share received during the period divided by the period’s beginning share price.
3. Total return: price change plus cash dividends, using the same beginning-price denominator.
4. Annualized return: compounded annual growth rate (CAGR) across the selected period.

Avoid double-counting dividends. Use raw close data for the price-return calculation when dividends are shown separately. If adjusted close is used for a reinvested-dividend total-return series, show that as a separate reinvested total-return measure and do not add the dividend yield to it again.

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
- Maximum drawdown from the annual or higher-frequency total-return series when enough history exists.
- Dividend growth by year when the dividend history supports it.

Use null or an explicit “Insufficient history” state for missing observations. Never turn missing data into 0%. A confirmed non-dividend payer may show 0%; an unavailable dividend history must show an unavailable state.

Portfolio calculations
----------------------

Show two clearly labelled portfolio concepts when the data supports them:

1. Actual portfolio performance: use the existing ledger and snapshot methodology. Show calendar-year TWR when complete snapshots and flow data exist. Show personal XIRR where the current Performance page already supports it.
2. Historical basket estimate: calculate a historical return for the stocks currently selected in the portfolio. Display the weighting method and the data coverage because current holdings applied to earlier years are a model of the basket, not a reconstruction of past ownership.

Use a pure calculation helper for the basket estimate. Support these weighting methods through a visible selector or a clearly documented default:

- Equal weight: every selected ticker has the same weight.
- Entry-value weight: weight by current ledger cost basis.
- Current-value weight: weight by current market value.

Use equal weight as the default when the user has not supplied a weighting choice. Show the selected method in the UI. Keep actual ledger-backed TWR separate from the model basket estimate.

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

Add an inner tab or segmented control named “Performance Returns” on `/performance`.

At the top of the view, add:

- Portfolio scope: All active holdings, Long Term, Index, or Treasury.
- Start year, defaulting to 2016.
- End period, defaulting to the current YTD.
- Weighting method for the historical basket estimate.
- Return basis: Price, Dividends, Cash Total Return, and optionally Reinvested Total Return.
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

Add an annual table with one row per year and columns for year, price return, dividend yield, cash total return, holdings with usable data, weight coverage, and status. Highlight the current YTD row and mark partial years clearly.

Add a per-stock table with ticker, company name, portfolio bucket, weight, average annual price return, average annual dividend yield, average annual cash total return, cumulative total return, CAGR, best year, worst year, positive-year count, usable-year count, and data status. Allow the user to expand a stock row or switch to a year-by-year ticker matrix when practical.

Add a compact chart showing annual price return, dividend yield, and cash total return. Keep negative years visually distinct and make the exact values available to keyboard and screen-reader users through the table and accessible labels.

Data quality and edge cases
---------------------------

- Show “—” or a specific status for missing data; never silently use zero.
- Mark 2026 as YTD and include the as-of date.
- Require a prior-year close for every annual price-return calculation.
- Handle a stock added after 2016 by showing only the years with sufficient history and a coverage count.
- Handle ticker changes, splits, delistings, and missing dividend events through a visible status.
- Treat fees and taxes separately from stock total return. If actual ledger-backed portfolio TWR includes them, show that methodology in the existing Performance accounting area.
- Keep monetary dividend amounts in the source currency unless the user selects an existing app currency display option. Percent returns remain currency-neutral.
- Do not call a model basket result “personal return”. Reserve that label for ledger-backed measures such as TWR or XIRR.

Implementation and validation
----------------------------

- Reuse the existing `PortfolioPerformanceDashboard`, portfolio ledger, snapshot data, bucket definitions, and current design tokens where appropriate.
- Fetch historical prices and dividend events through the existing server-side Yahoo Finance integration or a new server route that follows the project’s established provider pattern. Avoid direct browser calls to the data provider.
- Keep calculations in pure helpers so they can be tested independently from the UI.
- Add focused tests for full-year returns, current YTD, dividends, no-dividend stocks, missing years, split-adjusted history, negative returns, cumulative return, CAGR, weighting, partial portfolio coverage, and the distinction between arithmetic average and CAGR.
- Preserve existing routes and Firestore schemas unless a schema change becomes necessary and is explicitly documented.
- Validate the implementation with the project’s relevant type checks, lint checks, and focused tests. Commit and push only the validated feature.
```

## Questions to settle before implementation

1. When you say “top2 tab,” do you mean the existing top navigation’s **Performance** page, or a tab inside the Master Table? My recommendation is an inner **Performance Returns** view on `/performance`.

2. For each stock’s return, should the primary number be price appreciation, total return including dividends, or both? My recommendation is to show both price return and cash total return, with dividends as a separate column.

3. Should dividends be treated as cash received or reinvested? My recommendation is cash dividends for the main calculation, with reinvested total return as an optional second series if the data is reliable.

4. What denominator should define annual dividend yield: the first trading close of each year, the average price during the year, or the last close of the year? My recommendation is the first trading close, because it makes price return plus dividend yield reconcile cleanly to the cash total-return formula.

5. How should the portfolio summary be weighted: equal weight, current market value, entry cost basis, or actual historical transaction weights? My recommendation is equal weight for the historical basket estimate until you choose a weighting rule, plus actual ledger-backed TWR where historical snapshots exist.

6. Should the summary include all active buckets—Long Term, Index, and Treasury—or only the stock portfolio? My recommendation is an **All active holdings** default with bucket filters.

7. Do you want the 2016–current view to show eleven rows—2016 through 2025 plus current-year YTD—or only ten rows by excluding 2016 or the current YTD year? My recommendation is to show all eleven labelled periods and describe the span as 2016 through current YTD.

8. If a ticker was added to the portfolio recently, should its earlier market history still appear as a stock-history row? My recommendation is yes for the per-stock history, while the basket table shows a clear “historical basket estimate” label and coverage percentage.

9. Should a confirmed non-dividend payer display 0% dividend yield while a provider data gap displays “Unavailable”? My recommendation is yes.

10. Do you also want dividend growth, volatility, Sharpe/Sortino, maximum drawdown, and benchmark comparison against VOO or the S&P 500? My recommendation is to include dividend growth, volatility, maximum drawdown, and a VOO comparison as secondary metrics after the core annual table is working.

## Recommended product defaults

Until the questions above are answered, use these defaults:

- Location: inner **Performance Returns** view on `/performance`.
- Period: 2016 through the current YTD year.
- Primary stock series: raw-close price return, cash dividend yield, and cash total return.
- Dividend denominator: first trading close of each year.
- Portfolio basket weighting: equal weight, with the weighting method shown in the UI.
- Actual portfolio result: existing ledger-backed TWR/XIRR when sufficient history exists.
- Long-term summary: arithmetic average annual return, cumulative compounded return, and CAGR shown as separate metrics.
- Missing data: explicit status and coverage percentage; missing observations never become 0%.
