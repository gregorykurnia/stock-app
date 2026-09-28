# Performance Returns and 10-Year Simulation feature prompt

Status: historical returns implemented; simulation requirements added; historical USD/IDR context implemented
Requested: 2026-09-27
Updated: 2026-09-28

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

Historical USD/IDR strength context
------------------------------------

Add a compact currency-context panel to the **Historical Returns** subtab, directly after the annual basket table and before the annual return chart. Do not create another top-level page, and do not mix observed FX history with the 10-Year Simulation’s forecast assumptions.

- Use Yahoo Finance `IDR=X` as the USD/IDR pair, quoted as Indonesian rupiah per US dollar.
- Label the panel **USD/IDR strength (IDR per USD)**. A rising quote means USD strengthened against IDR and IDR weakened; a falling quote means the reverse.
- Show one row for every year in the selected range: 2016, 2017, …, the last completed year, and the current year labelled YTD. With the current defaults, this is 2016–2026 YTD.
- For each full year, use the last valid FX close before January 1 as the beginning rate and the last valid close inside that calendar year as the ending rate. For 2016, the beginning observation is the last valid close in 2015.
- For the current year, use the prior calendar-year close through the latest available current-year close and label the row YTD with its as-of date.
- Calculate the observed quote change as:

      usdStrengthPct = (endUsdIdr / startUsdIdr - 1) * 100

- Display the beginning rate, ending rate, annual USD strengthening percentage, and data status. Positive values should be visually distinct from negative values, while the exact values remain available in an accessible table.
- Include a small summary for cumulative USD/IDR change across the selected period. If an annualized figure is shown, calculate it from the actual elapsed time and label it as an observed historical annualized change, not a forecast.
- If the UI also shows IDR’s change measured in USD purchasing-power terms, use `startUsdIdr / endUsdIdr - 1` and label it separately. Do not present that inverse percentage as the same number as the USD/IDR quote change.
- Keep the FX series separate from USD stock price return, dividend yield, and cash total return. Do not add FX to those returns unless an explicitly labelled IDR-translated return mode is implemented.
- Show the source, quote direction, latest FX close, fetched-at time, and coverage status. Missing FX history must remain unavailable rather than becoming 0%.

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
- A historical FX context panel below the annual basket table showing annual USD/IDR quote changes from 2016 through current YTD, with start/end rates, percentage change, source, and as-of date.
- A compact annual USD/IDR strengthening chart may accompany the table, but the table must remain the accessible source of exact values and statuses.

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
- Treat `IDR=X` as a separate historical FX series. Require a prior-year FX close for each annual FX calculation, including the 2015 close needed for 2016, and show an explicit unavailable status when it is missing.
- Show market history for a stock added after 2016 in the per-stock table when available, while clearly labelling the equal-weight basket as a current selection applied historically. Show only usable years for that stock and a coverage count.
- Handle ticker changes, splits, delistings, and missing dividend events through a visible status.
- Treat fees and taxes separately from stock total return. If actual ledger-backed portfolio TWR includes them, show that methodology in the existing Performance accounting area.
- Keep monetary dividend amounts in the source currency unless the user selects an existing app currency display option. Percent returns remain currency-neutral.
- Do not call an equal-weight basket result “personal return”. Reserve that label for ledger-backed measures such as TWR or XIRR.

Implementation and validation
----------------------------

- Reuse the existing `PortfolioPerformanceDashboard`, portfolio ledger, snapshot data, bucket definitions, and current design tokens where appropriate.
- Fetch historical prices and dividend events through the existing server-side Yahoo Finance integration or a new server route that follows the project’s established provider pattern. Avoid direct browser calls to the data provider.
- Fetch the historical `IDR=X` series through the same server-side pattern, normalize it as a quote in IDR per USD, and keep its source/as-of metadata with the response.
- Keep calculations in pure helpers so they can be tested independently from the UI.
- Add focused tests for full-year returns, current YTD, dividends, no-dividend stocks, missing years, split-adjusted history, negative returns, cumulative return, CAGR, weighting, partial portfolio coverage, the distinction between arithmetic average and CAGR, and the USD/IDR annual-change formula including positive, negative, flat, YTD, and missing-prior-close cases.
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
11. **Historical FX context:** use `IDR=X` quoted as IDR per USD. Show the annual USD/IDR quote change from 2016 through the current YTD, where a positive percentage means USD strengthened against IDR. Keep this observed series separate from simulation FX assumptions and USD-denominated stock returns.

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
- Historical FX context: `IDR=X`, quoted as IDR per USD, with annual 2016–current-YTD quote changes and explicit source/as-of metadata.
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
- For this implementation, use the thirteen stock names currently in the portfolio at implementation time, plus VOO, VXUS, and SGOV. Snapshot and show the exact resolved list in the UI. If the current data contains a different number, use the actual list and label the count.
- The selected comparison basket may contain tickers that are not currently owned. The simulation starting positions must come only from the actual portfolio ledger.
- Keep the simulation universe fixed to the current names for this first version. Structure the code so a future version can make the universe dynamic, but do not add a second dynamic ticker-management workflow now.

Simulation dates and starting point
-----------------------------------

- Use the latest available market close as the simulation as-of date.
- Use the actual current market value and share quantity for every ledger position, priced with the latest available quote. The current unrealized gain or loss is already included in this value.
- Include current uninvested cash as a separate Unallocated cash row or explicitly map it into the SGOV sleeve. Do not silently drop cash.
- Show an as-of row for the current portfolio and then one estimated 2026 year-end row followed by 2027 through 2036 year-end rows.
- Treat 2026 as a partial-year estimate: actual value through the as-of date plus forecasted performance for the remaining days or months.
- Show each ticker’s actual 2026 YTD price return as context where history is available. Do not apply that YTD return again to the current market-value starting point.
- Keep the historical equal-weight basket separate from the simulation’s actual starting weights.

FX treatment
-----------

Model USD/IDR explicitly because the monthly contribution is fixed in rupiah while the securities are priced in USD:

- Fetch the latest USD/IDR spot rate at runtime and show the as-of rate.
- Use a provisional base case in which USD/IDR rises by 3% per year, meaning the rupiah weakens by approximately 3% per year. Treat this as a planning assumption, not a prediction.
- Show 0%, 3%, and 5% annual USD/IDR growth as selectable sensitivity cases, with 3% as the default until a different assumption is supplied.
- Interpolate the FX path monthly. Convert each Rp 13,000,000 contribution into USD at that month’s projected rate, so a weaker rupiah buys fewer USD of VOO over time.
- Convert projected USD holdings to IDR at each year-end FX rate. Show both USD and IDR values, because FX can raise the IDR value of USD assets while reducing the USD amount purchased by future IDR contributions.
- Include an FX translation line in the annual portfolio bridge and show the difference between the USD return, the FX translation effect, and the total IDR result.

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
- Apply the visible dividend withholding-tax assumption to obtain net dividends. Because the user has not selected a tax rate, run the primary view as a clearly labelled 0% gross-dividend scenario and offer 15% and 30% withholding sensitivity cases until a tax rate is confirmed.
- Add net dividends to SGOV after the month’s SGOV return is applied.
- Grow the SGOV sleeve at its forecast annual yield. Treat SGOV’s own distributions as retained in SGOV so they compound there, and do not count them twice.
- Show gross dividends, tax withheld, net dividends swept, and cumulative dividends by ticker when data supports it.
- If no tax assumption is supplied, default to 0% only in a clearly labelled gross-cash scenario and expose the rate as an input.

Monthly Rp 13 million VOO DCA
-----------------------------

Add a monthly contribution stream of Rp 13,000,000 to VOO:

- Make the monthly IDR amount editable, defaulting to Rp 13,000,000.
- Start 100% of the contribution in VOO at the November 2026 month-end, then continue every month-end through 2036. Do not allocate this DCA stream to VXUS, SGOV, or the individual stocks.
- Convert each contribution to USD using the projected monthly USD/IDR rate. Do not use one constant exchange rate for the entire horizon.
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
monthlyFxRate = startingUsdIdr × (1 + annualUsdIdrGrowth) ^ (monthsFromStart / 12)
monthlyDcaUsd = monthlyDcaIdr / monthlyFxRate

assetValueEnd = assetValueStart × monthlyPriceFactor
dividendCash = assetValueStart × netDividendYield / 12
sgovEnd = sgovStart × monthlySgovFactor + dividendCashFromOtherHoldings
vooDcaSharesAdded = monthlyDcaUsd / vooMonthEndPrice
portfolioValueIdr = portfolioValueUsd × monthlyFxRate
~~~

For the partial remainder of 2026, use the fraction of the year remaining from the as-of date to December 31 for price growth and dividend accrual. Start the regular monthly schedule in the next full month and apply DCA at the selected month-end dates.

For every annual snapshot, return:

- Beginning portfolio value.
- Ending value by ticker and ending total portfolio value.
- New DCA contribution during the year and cumulative DCA principal.
- Gross dividends, tax withheld, net dividends, amount swept into SGOV, and SGOV ending balance.
- Price-growth contribution, dividend contribution, and external-contribution contribution.
- USD/IDR rate at the snapshot date, FX translation effect, and the IDR value of the same USD portfolio.
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
- Estimated 2036 USD/IDR rate and the IDR value added or lost through FX translation.

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
- Show the FX data source, starting spot rate, annual growth assumption, and sensitivity case. A missing FX quote must be visible and must not become zero.
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
- **DCA timing:** 100% of Rp 13 million to VOO at the November 2026 month-end, then every month-end through 2036.
- **FX:** latest runtime USD/IDR spot rate with a provisional 3% annual USD/IDR growth base case and 0% and 5% sensitivity cases.
- **Dividend treatment:** primary view shows gross dividends with 0% withholding because the tax rate is unresolved; also show 15% and 30% sensitivity cases, then sweep net dividends into SGOV. SGOV distributions remain in SGOV.
- **Costs:** no fees, spread, or inflation increase by default.
- **Output:** nominal values in both USD and IDR, plus per-ticker and whole-portfolio annual values.

## Updated choices and remaining confirmations

1. **DCA timing — confirmed:** start 100% in VOO at the November 2026 month-end and continue monthly.
2. **Dividend withholding tax — unresolved:** keep the rate editable and show 0%, 15%, and 30% cases until the user confirms the applicable rate.
3. **FX — model explicitly:** fetch the latest USD/IDR spot rate, use 3% annual USD/IDR growth as the provisional base case, and show 0% and 5% sensitivity cases. This affects both IDR portfolio gains and the USD amount purchased by each fixed-rupiah DCA contribution.
4. **Ticker universe — confirmed for this version:** use the current stock names now, plus VOO, VXUS, and SGOV. Make the implementation easy to convert to a dynamic list later.

The provisional 3% FX assumption is a modeling input, not a claim about the future exchange rate. Keep it visible so the user can change it and see how much of the IDR result comes from FX rather than the securities’ USD performance.

## Fresh-chat implementation prompt

### Recommended model

Use **Astra with Extra high reasoning** for the first end-to-end implementation if it is available. This feature combines repo archaeology, financial calculation design, historical-data edge cases, monthly simulation, FX conversion, and a multi-part UI. OpenAI’s current [model selection guidance](https://developers.openai.com/api/docs/guides/model-selection) positions Astra Extra high for demanding analysis and complex deliverables. Use **Sol with Extra high reasoning** when you want a strong coding workflow with a better speed or cost balance. Reserve **Luna** for focused follow-up fixes after the architecture and calculations are stable. Availability and limits depend on the product and account.

### Paste this after clearing the chat

~~~text
Implement the 10-Year Simulation described in docs/performance-returns-prompt.md in this existing stock-app repository. Work directly in the repo and complete the implementation end to end. Do not only give me a plan or a code sketch.

The existing Performance Returns page and historical-return view are already implemented. Extend them with a Simulation subtab. Do not create a duplicate top-level route or navigation item.

Locked product decisions
------------------------

- Keep the existing top-level Performance Returns tab.
- Add a segmented subtab: Historical Returns | 10-Year Simulation.
- In Historical Returns, add the observed USD/IDR context described in this document: annual 2016–current-YTD USD/IDR quote changes from `IDR=X`, quoted as IDR per USD. Keep this separate from the simulation’s forecast FX assumptions.
- For this first version, use the current stock names in the portfolio at implementation time, plus VOO, VXUS, and SGOV. Snapshot and display the resolved list. Keep the code easy to make dynamic later, but do not add a second dynamic ticker-management workflow now.
- Use the actual portfolio ledger quantities and current market values as the simulation starting point. Include current uninvested cash as Unallocated cash or explicitly map it into SGOV.
- Show an as-of row, an estimated 2026 year-end row, and 2027 through 2036 year-end rows.
- Start 100% of the Rp 13,000,000 monthly contribution in VOO at the November 2026 month-end, then contribute every month-end through 2036.
- Fetch the latest USD/IDR spot rate at runtime. Use a provisional base case where USD/IDR rises 3% per year, with selectable 0%, 3%, and 5% annual USD/IDR growth cases.
- Because the dividend withholding-tax rate is unresolved, show 0%, 15%, and 30% withholding cases. Label the primary 0% case as a gross-dividend scenario.
- Dividends from all non-SGOV holdings go to SGOV. SGOV distributions remain in SGOV and compound there. Do not reinvest dividends into the paying stock.
- Ignore fees, spread, and automatic inflation increases unless the existing app already has a relevant assumption control.

Operating rules
--------------

1. Read AGENTS.md and CLAUDE.md completely before editing.
2. Treat package.json and the installed Next.js version as the source of truth. Before writing code, read the relevant guide under node_modules/next/dist/docs/ as required by AGENTS.md.
3. Read docs/performance-returns-prompt.md completely, then inspect the current Performance Returns page, dashboard, portfolio ledger, portfolio snapshots, bucket definitions, Firestore helpers, Yahoo Finance helpers, existing API routes, styles, and related tests.
4. Check git status before editing. Preserve unrelated user changes and do not reset or overwrite them.
5. Work in stages. After each stage, inspect the diff and keep the code in a buildable state.
6. Use the repository’s existing architecture and naming patterns. Use apply_patch for local edits.
7. Do not ask me to approve ordinary implementation choices already decided above. Ask only if a real external blocker or contradictory repository state prevents safe progress.

Stage 0: inspect and plan
-------------------------

- Identify where the current Performance Returns page stores tab state, loads history, loads ledger positions, and renders tables or charts.
- Identify how current market values, quantities, cost basis, cash, portfolio buckets, and snapshots are represented.
- Identify the existing server-side Yahoo Finance pattern and the best available source for USD/IDR.
- Identify the project’s current chart and formatting conventions.
- Identify how to load and normalize the historical `IDR=X` series alongside selected ticker history without treating it as a portfolio constituent.
- Write a short implementation plan in your progress update, then execute it without waiting for another confirmation.

Stage 1: create the pure simulation model
-----------------------------------------

Add or extend pure TypeScript helpers for the simulation. Keep the calculation independent of React, Firestore, and browser state.

The model must accept:

- Starting positions, quantities, cash, cost basis, and current quotes.
- Historical annual price returns and dividend yields for each ticker.
- VOO benchmark history.
- As-of date and end year 2036.
- Monthly DCA amount in IDR and fixed start month 2026-11.
- Starting USD/IDR spot rate and annual FX growth scenario.
- Dividend withholding-tax scenario.

Calculate forecast inputs from complete historical years only:

1. Long-window price CAGR using up to the most recent ten complete years.
2. Recent price CAGR using up to the most recent five complete years.
3. Trimmed arithmetic mean of annual price returns, removing the single highest and lowest return when enough observations exist.
4. Robust price estimate:

   50% × long-window price CAGR
   + 30% × recent price CAGR
   + 20% × trimmed arithmetic mean

5. Dividend yield estimate as the median of the latest five complete annual yields when available.
6. For individual stocks, shrink total return toward VOO:

   raw total return = robust price estimate + net dividend yield
   stock total return = VOO total return + 60% × (raw total return − VOO total return)
   forecast price return = stock total return − net dividend yield

7. Apply the visible individual-stock total-return guardrail of -20% to +25% and flag estimates that were shrunk or capped.
8. Use each fund’s own estimate for VOO and VXUS. Model SGOV as the interest-bearing sleeve.
9. Never convert missing history into zero. Use an explicit status and confidence field.

Stage 2: implement the monthly simulation
-------------------------------------------

Use a monthly state transition from the as-of date through December 2036.

- Anchor the current portfolio to actual current market value. Do not apply 2026 YTD performance again.
- For the remaining portion of 2026, apply forecast price growth and dividends only for the time remaining after the as-of date.
- Begin monthly DCA at the November 2026 month-end. Every contribution is 100% VOO.
- Convert each Rp 13,000,000 contribution using the projected monthly USD/IDR rate. A weaker rupiah must buy fewer USD of VOO.
- Buy fractional VOO shares at the forecast month-end VOO price.
- Existing stocks and ETFs grow by forecast price return only.
- Estimate monthly dividends from beginning-of-month value × annual dividend yield ÷ 12, apply the selected withholding case, and sweep the net cash into SGOV.
- Grow SGOV by its forecast annual yield. Add swept dividends after the month’s SGOV growth so the timing is explicit.
- Track existing VOO shares and DCA VOO shares separately.
- Track starting value, price growth, gross dividends, tax withheld, net dividends, SGOV sweep, DCA principal, ending value, and allocation for every ticker.

Use these core relationships:

   monthly price factor = (1 + annual price return) ^ (1 / 12)
   monthly SGOV factor = (1 + annual SGOV yield) ^ (1 / 12)
   monthly USD/IDR = starting USD/IDR × (1 + annual FX growth) ^ (months / 12)
   monthly DCA USD = 13,000,000 / monthly USD/IDR
   VOO shares added = monthly DCA USD / month-end VOO price
   IDR portfolio value = USD portfolio value × year-end USD/IDR

Return annual snapshots with a reconciliation check:

   ending value = beginning value
   + external DCA contributions
   + price growth
   + SGOV growth
   + net dividend cash
   + FX translation when viewed in IDR

Make the reconciliation mathematically consistent and document the treatment of rounding and contribution timing.

Stage 3: wire the data
----------------------

- Reuse the existing server-side historical-price and dividend provider pattern.
- Add or extend a server route for simulation inputs if needed. Do not fetch Yahoo data directly from the browser.
- Include the historical `IDR=X` series for the Historical Returns view. Use IDR per USD quote direction, prior-year closes for annual baselines, and the latest current-year close for YTD.
- Fetch the latest USD/IDR rate through a server-side source following the project’s existing pattern. Show the source and as-of time.
- Reuse the existing ledger and snapshot helpers. Do not fabricate holdings from the historical selection list.
- Preserve existing Firestore schemas unless a schema change is necessary and documented.
- Handle stale or missing quotes, missing dividend history, limited ticker history, ticker changes, splits, delistings, and missing FX data with visible statuses.

Stage 4: build the UI
---------------------

Add the Simulation subtab to the existing Performance Returns dashboard.

Also add the historical FX context to the Historical Returns view: a compact panel below the annual basket table with annual 2016–current-YTD start rate, end rate, observed USD strengthening percentage, status, source, and as-of date. A rising IDR-per-USD quote is positive USD strengthening; do not merge this observed series into USD stock returns or the simulation forecast.

Include:

- As-of date and data-source note.
- Starting portfolio value, cost basis, unrealized gain or loss, cash, and starting allocation.
- Base-case forecast assumptions by ticker.
- Controls for FX case: 0%, 3%, 5% annual USD/IDR growth.
- Controls for dividend withholding case: 0%, 15%, 30%.
- A visible note that 3% FX is a provisional planning assumption.
- Summary cards for current value, 2036 value in USD and IDR, cumulative DCA principal, investment growth excluding DCA, SGOV balance, swept dividends, VOO DCA value, and FX translation effect.
- Annual table from 2026E through 2036 showing beginning value, DCA, dividends, SGOV sweep, price/investment growth, FX effect, ending USD value, ending IDR value, and total allocation.
- Per-ticker table showing starting value, shares, forecast price return, gross and net dividend yield, annual swept dividends, annual ending values, DCA attribution, and data status.
- A Total Portfolio row.
- Charts for total value versus contributions, stacked value by ticker or bucket, SGOV balance and swept dividends, and the USD-versus-IDR projection.
- Exact accessible table values behind every chart.

Keep actual 2026 YTD context visually separate from the forecasted remainder of 2026. Label all future values as Model estimate or Forecast.

Stage 5: validate
-----------------

Add focused tests for:

- Forecast-window selection and trimming.
- VOO benchmark shrinkage and return guardrails.
- Dividend yield handling and unavailable data.
- Partial 2026 anchoring without double-counting YTD performance.
- November 2026 DCA start and monthly contributions through 2036.
- Fractional VOO shares and fixed-rupiah contributions.
- 0%, 3%, and 5% FX scenarios.
- 0%, 15%, and 30% dividend-tax scenarios.
- Dividends flowing to SGOV and SGOV compounding.
- USD-to-IDR conversion and FX translation attribution.
- Historical USD/IDR quote-change formula, including positive, negative, flat, current-YTD, and missing-prior-close cases.
- Contribution-versus-investment-growth reconciliation.
- Missing quotes and visible data-quality states.

Run the relevant validation after implementation, including:

- npm run typecheck
- npm run lint
- the focused simulation tests
- the existing relevant portfolio and performance tests
- npm run build if the code path or route warrants it

Fix failures instead of weakening the tests. Inspect the final diff and verify that the historical Performance Returns view and existing Performance page still work.

Stage 6: finish the repository task
-----------------------------------

- Update docs/performance-returns-prompt.md only if the implementation reveals a necessary assumption or interface correction.
- Run git diff --check.
- Stage only files related to this feature.
- Commit the validated change with a clear message.
- Push the current branch to origin as required by AGENTS.md.
- In the final response, summarize the implementation, assumptions, files changed, validation run, commit, and any remaining limitation.
~~~
