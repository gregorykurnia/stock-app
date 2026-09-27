# Performance Returns and 10-Year Simulation feature prompt

Status: historical returns implemented; simulation requirements added
Requested: 2026-09-27

## Simulation placement recommendation

Keep **Performance Returns** as the top-level tab. Add the simulation as a segmented subtab inside that page:

**Historical Returns | 10-Year Simulation**

The current app already has the top-level route and historical-return dashboard. The simulation should reuse that page’s data and selection controls instead of creating another top-level navigation item.

## Recommended location

Keep **Performance Returns** as the top-level tab immediately to the right of **Performance**. It already exists at /performance-returns. Add the simulation as a segmented subtab inside that page:

**Historical Returns | 10-Year Simulation**

Suggested order: **Master Table → Portfolio → Performance → Performance Returns → Personal Finance**. Reuse the existing Performance Returns data helpers and design system, while keeping the current /performance dashboard for portfolio value, TWR, XIRR, accounting, and allocation.

## Copy/paste implementation prompt

```text
Extend the existing “Performance Returns” page at /performance-returns with a “10-Year Simulation” subtab. The top-level navigation link already exists; do not create a duplicate route or navigation item.

Before changing code, inspect the existing Performance Returns page, Performance page, portfolio ledger, portfolio snapshots, portfolio bucket model, Yahoo Finance data helpers, top navigation, and tests. Reuse the current architecture and styles. Keep the existing historical returns, portfolio value, TWR, XIRR, accounting, and allocation views working.

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

Keep the existing top-level “Performance Returns” link immediately after “Performance” and use the existing /performance-returns route. Add the historical and simulation views as subtabs inside that page.

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

1. **Location:** existing top-level **Performance Returns** tab immediately to the right of **Performance**, with the simulation as a subtab.
2. **Return values:** show both annual price return and annual cash total return, with the annual cash dividend percentage shown separately.
3. **Dividends:** treat dividends as cash received; reinvestment is optional future work.
4. **Dividend denominator:** use the first trading close of each year.
5. **Historical basket:** use equal weight. The first version is percentage-focused and does not need cost-basis or market-value weighting.
6. **Scope:** include all active holdings with Long Term, Index, and Treasury bucket filters.
7. **Period:** show 2016 through the current YTD year.
8. **Later additions:** allow one-by-one ticker selection. Show a recently added ticker’s available market history, while labelling the basket as a historical estimate based on the current selection.
9. **Non-dividend payers:** show 0% when the provider confirms no dividend; show “Unavailable” for a data gap.
10. **Secondary metrics:** include dividend growth, volatility, maximum drawdown, and S&P 500 comparison. Use VOO as the primary benchmark because it is part of the initial universe.

## Remaining historical-return clarification

For the historical view, the implementation can derive the thirteen stock symbols from the current portfolio at build time, then seed SGOV, VXUS, and VOO explicitly. If you want a fixed list, provide the symbols before implementation. Simulation-specific choices are listed at the end of this document.

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

## Implementation workflow

Implement the calculation helpers first, then synthetic validation, then the UI. Finish with an audit against the formulas, assumptions, data-quality states, and reconciliation requirements in the simulation prompt. Keep the methodology review focused on preventing dividend double-counting, contribution-versus-return confusion, and accidental extrapolation of a single boom year.

## Copy/paste simulation add-on prompt

Use this prompt to extend the existing Performance Returns page:

~~~text
Extend the existing Performance Returns page with a 10-Year Simulation subtab. The top-level Performance Returns route and historical-return view already exist. Do not create a duplicate route or navigation item.

The simulation is a rough planning model for the current portfolio. It must be transparent about assumptions, distinguish actual values from forecasts, and keep external contributions separate from investment growth.

Placement and scope
-------------------

- Add a segmented subtab inside Performance Returns: Historical Returns | 10-Year Simulation.
- Keep the current historical-return table, equal-weight basket, actual portfolio TWR, XIRR, accounting, and allocation views working.
- Start with the thirteen stock positions currently intended for the portfolio, plus VOO, VXUS, and SGOV. Derive the stock list from the current portfolio source at implementation time and show the exact resolved list in the UI. If the current data contains a different number, use the actual list and label the count.
- The selected comparison basket may contain tickers that are not currently owned. The simulation starting positions must come only from the actual portfolio ledger.
- Add or remove tickers one at a time. Keep this selection separate from the transaction ledger.

Simulation dates and starting point
-----------------------------------

- Use the latest available market close as the simulation as-of date.
- Use the actual current market value and share quantity for every ledger position, priced with the latest available quote. The current unrealized gain or loss is already included in this value.
- Include current uninvested cash as a separate Unallocated cash row or explicitly map it into the SGOV sleeve. Do not silently drop cash.
- Show an as-of row for the current portfolio and then one estimated 2026 year-end row followed by 2027 through 2036 year-end rows.
- Treat 2026 as a partial-year estimate: actual value through the as-of date plus forecasted performance for the remaining days or months.
- Show each ticker’s actual 2026 YTD price return as context where history is available. Do not apply that YTD return again to the current market-value starting point.
- Keep the historical equal-weight basket separate from the simulation’s actual starting weights.

Forecast inputs
---------------

Use one visible base-case expected annual price return and one visible base-case dividend yield for every ticker. These are planning assumptions, not predictions. Show the historical observations, window lengths, benchmark anchor, shrinkage, and any cap used to produce each input.

Use complete historical years only and exclude the current partial year:

1. Calculate annual price returns and cash dividend yields using the existing historical-return rules.
2. Calculate a long-window price CAGR using up to the most recent ten complete years.
3. Calculate a recent price CAGR using up to the most recent five complete years.
4. Calculate a trimmed arithmetic mean of annual price returns. When enough observations exist, remove the single highest and single lowest annual return before averaging.
5. Blend those three values:

~~~text
robustPriceEstimate =
  50% × longWindowPriceCagr
  + 30% × recentPriceCagr
  + 20% × trimmedMeanAnnualPriceReturn
~~~

Use the median dividend yield from the most recent five complete years when available. If a provider confirms that a ticker has never paid a dividend, use 0%. If dividend history is unavailable, show an unavailable state and require an explicit fallback before the simulation runs.

To reduce the effect of company-specific boom years such as an isolated 120% or 200% year, anchor individual-stock total returns toward VOO:

~~~text
rawTotalReturnEstimate = robustPriceEstimate + netDividendYieldEstimate
stockTotalReturnEstimate =
  VOO total-return estimate
  + 60% × (rawTotalReturnEstimate - VOO total-return estimate)
forecastPriceReturn = stockTotalReturnEstimate - netDividendYieldEstimate
~~~

Use each fund’s own robust estimate for VOO and VXUS. Treat SGOV as the interest-bearing cash sleeve described below. Apply a visible base-case guardrail of -20% to +25% to an individual stock’s forecast total return and flag any ticker that was shrunk or capped. Keep the 60% shrinkage and guardrail as named constants.

This method uses price growth and cash dividends as separate inputs. It must not extrapolate the largest historical year or silently assume that dividends are reinvested into the paying stock.

Dividends and SGOV
------------------

Treat dividends from every non-SGOV holding, including VOO and VXUS, as cash received and swept into SGOV:

- Existing stocks and ETFs grow by forecast price return only.
- Each month, estimate gross dividends as beginning-of-month position value × gross annual dividend yield ÷ 12.
- Apply the visible dividend withholding-tax assumption to obtain net dividends.
- Add net dividends to SGOV after the month’s SGOV return is applied.
- Grow the SGOV sleeve at its forecast annual yield. Treat SGOV’s own distributions as retained in SGOV so they compound there, and do not count them twice.
- Show gross dividends, tax withheld, net dividends swept, and cumulative dividends by ticker when data supports it.
- If no tax assumption is supplied, default to 0% only in a clearly labelled gross-cash scenario and expose the rate as an input.

Monthly Rp 13 million VOO DCA
-----------------------------

Add a monthly contribution stream of Rp 13,000,000 to VOO:

- Make the monthly IDR amount editable, defaulting to Rp 13,000,000.
- Convert it to USD using a visible USD/IDR assumption. Default to the current exchange rate held constant unless the user supplies an FX-growth assumption.
- Default the first contribution to the next full month-end after the as-of date. Add a control to include the current month if the user has not yet contributed.
- At each month-end, buy fractional VOO shares using that month’s forecast VOO price. Do not replace monthly DCA with one annual contribution.
- Track existing VOO shares and DCA-purchased VOO shares separately, while also showing the combined VOO total.
- Dividends from both existing VOO shares and DCA-purchased VOO shares flow into SGOV.
- Keep the Rp 13 million contribution fixed in nominal terms. Do not automatically increase it for inflation.
- Keep DCA principal separate from investment growth. Ignore purchase fees and spread unless the user supplies those assumptions.

Monthly simulation
------------------

Implement the calculation as a pure helper that receives starting positions, current quotes, annual forecast inputs, as-of date, DCA amount, FX assumption, withholding-tax rate, and end year. It should return annual snapshots and per-ticker audit fields.

For each non-SGOV holding, track shares, price-only value, gross dividends, net dividends swept, and ending value. For VOO, track existing shares and DCA shares separately. For SGOV, track opening balance, swept dividends, SGOV growth, and ending balance.

For a full forecast month, use:

~~~text
monthlyPriceFactor = (1 + forecastPriceReturn) ^ (1 / 12)
monthlySgovFactor = (1 + forecastSgovYield) ^ (1 / 12)

assetValueEnd = assetValueStart × monthlyPriceFactor
dividendCash = assetValueStart × netDividendYield / 12
sgovEnd = sgovStart × monthlySgovFactor + dividendCashFromOtherHoldings
vooDcaSharesAdded = monthlyDcaUsd / vooMonthEndPrice
~~~

For the partial remainder of 2026, use the fraction of the year remaining from the as-of date to December 31 for price growth and dividend accrual. Start the regular monthly schedule in the next full month and apply DCA at the selected month-end dates.

For every annual snapshot, return:

- Beginning portfolio value.
- Ending value by ticker and ending total portfolio value.
- New DCA contribution during the year and cumulative DCA principal.
- Gross dividends, tax withheld, net dividends, amount swept into SGOV, and SGOV ending balance.
- Price-growth contribution, dividend contribution, and external-contribution contribution.
- Portfolio allocation by ticker and by portfolio bucket.
- A reconciliation check showing that ending value equals beginning value plus contributions, price growth, SGOV growth, and net dividend cash, subject to rounding.

Do not describe the ending-value increase as investment return when it was caused by the Rp 13 million contributions.

Required output
---------------

Show a short methodology panel with:

- As-of date and quote source.
- Starting portfolio market value, cost basis, current unrealized gain or loss, and current allocation.
- Forecast price return and dividend yield for every ticker.
- Historical window used, data coverage, benchmark anchor, shrinkage, caps, FX rate, tax rate, DCA timing, and dividend destination.

Show summary cards for:

- Current starting value.
- Estimated 2036 ending value in USD and IDR.
- Total DCA principal through 2036.
- Estimated investment growth excluding DCA principal.
- Cumulative net dividends swept into SGOV.
- Estimated SGOV balance in 2036.
- Estimated VOO value attributable to monthly DCA.

Show an annual table for 2026E through 2036 with beginning value, DCA contribution, net dividends, SGOV sweep, investment growth, ending value, and total allocation.

Show a per-ticker table with ticker, name, role, starting value, current shares, forecast price return, gross dividend yield, net dividend yield, annual dividends swept, 2026E ending value, every later year-end value, 2036 ending value, DCA contribution if applicable, and data-quality status. Include a Total Portfolio row.

Add charts where they improve readability:

- Total portfolio value versus cumulative contributions.
- Stacked value by ticker or portfolio bucket through 2036.
- SGOV balance and cumulative swept dividends.
- Optional base-case sensitivity for a conservative and optimistic return assumption.

Label every projected number as Model estimate or Forecast. Keep actual 2026 YTD data visually separate from forecasted remainder-of-year data. Use accessible tables as the source of exact values.

Data quality and guardrails
---------------------------

- Missing prices, missing dividend history, limited history, stale quotes, ticker changes, splits, and delistings need visible statuses.
- Never turn missing data into 0%. A confirmed non-dividend payer may show 0%; unavailable dividend history must remain unavailable until a fallback is selected.
- If a stock has fewer than five complete years, use the available history, lower its confidence, and show the fallback or benchmark anchor used.
- If a starting holding has no current quote, keep its last known value with a stale-data warning or stop the simulation with a clear error. Do not silently treat it as zero.
- Use nominal values by default. If inflation-adjusted values are added, label the inflation assumption and keep real and nominal values separate.
- Keep taxes, fees, and FX assumptions visible. Do not present gross cash as net personal wealth without showing the assumptions.
- Preserve the existing ledger and Firestore schemas unless a schema change is necessary and documented.

Implementation and validation
----------------------------

- Reuse the existing Performance Returns dashboard, portfolio ledger, snapshot data, bucket definitions, server-side Yahoo Finance integration, and styles.
- Keep the simulation formulas in pure calculation helpers so they can be checked independently from the UI.
- Add focused coverage for partial 2026, current-value anchoring, 2036 horizon, monthly VOO DCA, fractional shares, dividends flowing to SGOV, SGOV compounding, missing data, tax and FX assumptions, contribution-versus-return reconciliation, and the distinction between price return and cash total return.
- Preserve the existing historical returns and actual TWR/XIRR behavior.
- Validate the implementation with the project’s relevant type checks, lint checks, and focused tests before committing.
~~~

## Defaults to use unless I clarify them

- **Placement:** a Simulation subtab inside the existing Performance Returns page.
- **Horizon:** 2026 estimated year-end through 2036 year-end, which is the current partial year plus ten future calendar years.
- **Starting value:** current ledger quantities priced at the latest available close, including current unrealized gains and losses.
- **DCA timing:** Rp 13 million at the next full month-end after the as-of date.
- **FX:** current USD/IDR rate held constant.
- **Dividend treatment:** gross dividends reduced by an editable withholding-tax rate, then swept into SGOV; SGOV distributions remain in SGOV.
- **Costs:** no fees, spread, or inflation increase by default.
- **Output:** nominal values in both USD and IDR, plus per-ticker and whole-portfolio annual values.

## Choices worth confirming before implementation

The prompt can be implemented with the defaults above. The only inputs that materially change the result are:

1. Whether the Rp 13 million DCA starts next month or should include the current month.
2. The dividend withholding-tax rate to show net cash rather than gross cash.
3. Whether a constant current USD/IDR rate is acceptable or an FX forecast should be supplied.
4. Whether the thirteen stock names should be read dynamically from the current portfolio or fixed to a specific symbol list.
