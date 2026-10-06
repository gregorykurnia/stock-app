# ETF page plan

Status: proposed; planning only. ETF catalogue research and implementation follow later.
Requested: 2026-10-06

## Purpose and scope

Add a top-level **ETF** page at `/etf` to help browse every ETF available on Pluang, understand what each fund does, and compare possible investments.

The page should answer:

1. What can I buy on Pluang, and what does it invest in?
2. How much has it historically returned, and how much cash does it distribute?
3. What losses, costs, and concentration come with those returns?
4. How does it compare with similar funds?
5. What exposure would it add to my portfolio?

This document defines the product and recommends analysis sections. It does not contain a researched ETF list, verified availability, or current fund statistics. No ETF should be assumed available until the later research phase verifies it.

## Recommended page structure

Use three views within the ETF page: **Explore | Compare | Shortlist**. Selecting a fund opens a detail panel with the analysis below. Keep the first screen easy to scan; place specialized metrics in expanded views.

### 1. Catalogue overview and filters

- Summary: ETF count, category counts, last catalogue verification, and number with incomplete data.
- Search by ticker, name, issuer, exposure, or keyword.
- Category cards with a short explanation and fund count.
- Filters: asset class, geography, strategy, issuer, expense ratio, distribution yield, fund age, and availability status.
- Show all verified funds by default, including specialized products with visible strategy labels. Provide an explicit filter to exclude leveraged/inverse or other complex strategies.
- Use alphabetical order within categories initially. Allow sorting by individual metrics without implying an overall recommendation.
- Make partial catalogue coverage visible; missing statistics must never make a fund disappear.

### 2. Main comparison table

Recommended default columns:

| Column | Why it belongs on the first screen |
|---|---|
| Ticker and full name | Identify the exact fund |
| Category and strategy badge | Understand the exposure before comparing returns |
| 5Y annualized total return | Main historical growth comparison |
| 10Y annualized total return | Longer-term context where available |
| Trailing 12-month distribution yield | Recent gross cash distributions relative to price |
| Expense ratio | Recurring fund cost |
| 5Y maximum drawdown | Largest observed loss from a prior peak |
| Fund size (AUM) | Context about scale and possible closure risk |
| Data status | Show missing history, stale values, and availability verification |

Pin identity columns on desktop. Use compact fund cards on mobile, with return, yield, cost, and drawdown visible. Price, 1Y return, volatility, and additional periods should be selectable columns rather than crowding the default table.

### 3. Fund overview: “What am I buying?”

Show the issuer, objective, index or active mandate, inception date, fund structure, domicile, trading currency, underlying asset class, geography, and distribution frequency.

Include a short plain-language explanation covering exposure, intended role, and key tradeoff. For example, distinguish broad equity growth, dividend income, short-duration bond exposure, and concentrated sector exposure. These are descriptive roles, not automatic buy recommendations.

Keep fund-level leverage separate from any margin/leverage offered by Pluang. Explain the platform's actual instrument and access model once verified during research; do not assume buying through the platform is equivalent to direct ownership of fund shares.

### 4. Historical growth and consistency

**Recommendation: make CAGR the headline “average annual return,” and show calendar-year returns underneath.**

- Trailing 1Y total return; 3Y, 5Y, and 10Y annualized total return.
- Since-inception annualized return, clearly labeled with its shorter or longer history.
- Calendar-year return table, with the current year separately labeled YTD.
- Growth of a hypothetical $10,000 with distributions reinvested.
- Best/worst calendar year and share of positive complete years over a stated window.
- Later enhancement: rolling 5Y annualized return range and median, showing how results depend on the starting date.

Display the window and end date beside returns. A new fund without five years of history gets “Insufficient history,” not a substituted since-inception figure in the 5Y column. Benchmark/index backtests must not masquerade as live fund performance.

### 5. Income and distribution analysis

**Recommendation: use recent distribution yield plus historical average yield, with payment stability alongside them.** “Average dividend %” alone hides changes in payouts and may mislabel non-dividend distributions.

- Trailing 12-month distribution yield as the primary income metric.
- Five-year average annual distribution yield, when complete history exists.
- Year-by-year distributions per share and annual cash yield.
- Payment frequency and recent payment history.
- Distribution growth over five years when meaningful, and evidence of cuts or irregular payments.
- Distribution composition when disclosed: income, capital gains, and return of capital.
- Bond funds: issuer-reported 30-day SEC yield, separately labeled from trailing distribution yield.
- Optional cash-income illustration per $1,000 invested using the stated trailing yield; label it as a historical illustration rather than a payment forecast.

High distribution yield should be read alongside total return, drawdown, and distribution composition. An options-income strategy needs an explanation of its income mechanism and upside tradeoff.

### 6. Risk and recovery

**Recommendation: prioritize maximum drawdown and recovery time before adding complex risk scores.**

- Five-year maximum drawdown using daily observations.
- Current drawdown from the prior peak.
- Time to recover the maximum drawdown, with “Not yet recovered” for an open episode.
- Five-year annualized volatility using monthly returns.
- Worst complete calendar year, shown alongside the annual return table.
- Concentration and strategy risks from the holdings section.

Offer a return-versus-drawdown scatterplot with category filters once data is ready. Avoid unqualified “safe” labels. Cash-like, bond, equity, and leveraged strategies need different explanations and peer comparisons.

### 7. Costs and trading practicality

- Net expense ratio and gross expense ratio/waiver expiry if applicable.
- Annual fund-cost illustration per $1,000, distinguishing it from platform charges.
- AUM, fund age, average dollar trading volume, and bid/ask spread where supported.
- Premium/discount to NAV where available and applicable.
- Verified Pluang fees, FX conversion costs, minimum purchase, and trading access in a separate platform section.

Historical fund returns generally already reflect fund operating expenses; confirm the chosen source's treatment and do not deduct the expense ratio again. Platform fees and personal tax are separate from gross fund performance.

### 8. Holdings, diversification, and overlap

- Holdings count, top ten holdings, and their combined weight.
- Sector, country, and asset-class exposure with dates.
- Largest holding weight to highlight concentration.
- Whether exposure is physical, futures-based, or otherwise derivative-based.
- Later enhancement: weighted holdings overlap between selected ETFs and the user's actual portfolio.

Holdings count alone does not establish diversification. Overlap calculations must use dated, compatible holdings files. Partial holdings produce a clearly labeled partial estimate, not a complete overlap score.

### 9. Compare similar funds

Allow selection of two to four funds for a side-by-side comparison covering exposure, matched-period total return, cash yield, fees, drawdown, volatility, concentration, and data coverage.

Normalize the growth chart to the same starting value and common date range. Explain when the common range shortens because one fund is newer. Show each fund's longer history separately.

Use category-appropriate benchmarks: broad equities against relevant equity indices/funds; bonds against matching duration and credit exposures. An S&P 500 comparison can provide optional context, but should not be the default benchmark for every asset class. If category medians are shown, label them as the Pluang-available peer set and publish the sample size.

### 10. Shortlist and decision notes

Let the user save funds and record intended role, reason for interest, concerns, and research status. Useful decision prompts:

- Does this add exposure I lack, or duplicate what I own?
- Am I prioritizing growth, cash income, or capital stability?
- Is the historical loss range acceptable to me?
- Is a cheaper or less concentrated peer available?
- Are the income mechanism and product structure clear?

Keep personal notes separate from sourced facts. The first version should support transparent comparison rather than a composite “best ETF” score or automatic Buy/Sell verdict.

## Category model

Give each fund one primary asset class, a descriptive subcategory, and multiple strategy/exposure tags. Create only categories populated by the later verified catalogue.

| Primary group | Possible subcategories/tags |
|---|---|
| Equities | US broad market, global, developed ex-US, emerging markets, country-specific, small/mid/large cap |
| Equity styles and sectors | Growth, value, quality, dividend, technology, healthcare, other sectors/themes |
| Fixed income | Treasury, cash-like/short duration, aggregate, corporate investment grade, high yield, inflation-linked, international |
| Real assets | Property/REITs, physical precious metals, commodity futures |
| Multi-asset | Balanced, allocation, fund-of-funds |
| Alternative strategies | Options income, buffered/defined outcome, other mandates |
| Digital asset exposure | Spot exposure or futures exposure, distinguished explicitly |

Apply cross-cutting badges for active/passive, income-focused, covered call, leveraged, inverse, single-stock, and other material structures. Preserve the underlying asset class so a leveraged equity fund remains discoverable under equities as well as by strategy.

## Metric definitions and comparison rules

Agree these definitions before gathering statistics:

| Metric | Planned definition |
|---|---|
| Annualized total return (CAGR) | `(ending total-return index / starting index)^(1 / years) - 1`; accounts for compounded growth and reinvested distributions |
| Arithmetic average yearly return | Mean of complete calendar-year returns; optional detail, explicitly separate from CAGR |
| Trailing distribution yield | Split-adjusted gross distributions per share in the previous 12 months divided by unadjusted closing price at the stated end date |
| Annual cash yield | Split-adjusted distributions per share during a complete calendar year divided by split-adjusted share price at the beginning of that year |
| Five-year average cash yield | Arithmetic mean of the five complete calendar-year cash yields; exclude partial YTD and never treat unknown distributions as zero |
| Maximum drawdown | Lowest `total-return index / running peak - 1` in the specified daily window |
| Recovery time | Calendar time from the drawdown episode's peak until that peak is regained; show the episode dates |
| Annualized volatility | Sample standard deviation of monthly total returns multiplied by `sqrt(12)`, using a complete five-year window |

Use a validated total-return series or distribution-adjusted history; never silently replace it with price-only history. Keep reinvested total return, price return, and cash yield distinct. **Do not add dividend yield to total return: distributions are already included.**

Primary results are in USD and gross of investor-specific taxes and platform fees. A later IDR view must use matched historical USD/IDR dates: `(1 + USD return) × (ending FX / starting FX) - 1`. Withholding assumptions belong in an explicitly configurable illustration; do not hardcode a personal tax outcome.

Every metric needs its unit, calculation/source, observation period, and as-of date. Use explicit states: Data unavailable, Insufficient history, Not applicable, Stale, and Calculation error. Zero yield is valid only when absence of distributions is verified.

## Later research phase: establish the complete universe

1. Identify Pluang's authoritative catalogue or supported listing source and enumerate all pages/categories, rather than searching only for popular ETFs.
2. Save a dated raw catalogue snapshot and reconcile unique identifiers, tickers, exchange, and names. Handle aliases, renamed funds, and duplicates.
3. Verify availability separately from the existence of a public marketing page. Record the evidence URL/source, verification date, and status: catalogue-listed, tradability-confirmed, suspended, removed, or unverified.
4. Confirm instrument types with issuer material. Distinguish ETFs, exchange-traded trusts, ETNs, mutual funds, indices, and options. Preserve ETF-like trusts with an accurate structure label; place other discovered products in an exclusions report.
5. Research issuer objectives, costs, distributions, holdings, and strategy; enrich historical series from a validated market-data provider.
6. Publish a coverage report: source totals where available, enumerated count, unique count, exclusions, unresolved records, and data gaps. Claim “all currently available” only when enumeration and availability reconciliation support it. Otherwise show the precise coverage limitation.
7. Retain verified catalogue entries even if return or income enrichment fails.

Research deliverables: versioned catalogue, categorized inventory, per-field source records, exclusions/unresolved report, and the metric data dictionary. Catalogue completeness and statistic completeness are separate checks.

## Implementation direction for this app

- Add `app/etf/page.tsx` and an ETF navigation link in `app/layout.tsx` after the research/data contract is ready.
- Follow the app's existing table styling, shared export patterns, and explicit missing-data approach documented in `docs/long-term-data-map.md`.
- Reuse suitable historical-return helpers and server-side market-data infrastructure after validating their suitability for ETF distributions and daily drawdowns. Existing monthly history alone cannot support the proposed daily drawdown metric.
- Suggested boundaries: catalogue/research records, pure metric calculations, server-side enrichment/cache, and client-side catalogue/comparison UI.
- Start with a versioned reviewed catalogue; add scheduled catalogue reconciliation later. A provider failure must preserve the last successful snapshot and display its age.
- Proposed refresh targets: quotes/history after each US close; availability weekly; distributions weekly and after payment events; issuer fundamentals/holdings monthly or when newer documents appear. Confirm provider access and update frequency during research.
- Store per-field provenance and timestamps, preserve manual classification corrections, and report additions/removals for review before replacing the catalogue.
- CSV export should include all filtered rows, raw numeric values, periods, sources, and data states.
- Read the installed Next.js guides before writing implementation code, as required by `AGENTS.md`.

## Delivery phases and acceptance criteria

### Phase 1 — research and data contract

Complete the universe audit, classifications, source map, and feasibility check for the recommended metrics. Exit when every discovered item is accounted for and coverage limitations are documented.

### Phase 2 — useful first release

Build Explore, fund details, Compare, and Shortlist. Include verified catalogue coverage; categories/search/filters; return and income history; expense ratio/AUM; drawdown and volatility where supported; basic holdings; source dates; and CSV export. All catalogue entries remain visible even when fields are missing.

Exit when two comparable funds can be assessed on matched dates, each metric has a clear definition, and mobile/desktop views are usable.

### Phase 3 — deeper analysis

Add rolling returns, recovery analysis, richer distribution composition, liquidity/NAV context, category benchmarks, holdings overlap, IDR returns, and optional income illustrations as source coverage permits. Unsupported analysis stays visibly unavailable.

### Phase 4 — maintenance and verification

Automate refresh and reconciliation with change reports. Validate calculation fixtures for reinvestment, splits, zero distributions, incomplete history, drawdowns/recovery, matched dates, and provider failures. Check that every catalogue record is rendered or explicitly excluded; verify filters, exports, compare charts, and accessibility.

Run relevant app validation for implementation changes and `git diff --check`. Commit and push validated changes to the current branch as required by `AGENTS.md`.

## Recommended priorities

Build around **exposure → growth → income → risk → cost → diversification**. The most valuable additions to average annual return and average dividend yield are **maximum drawdown, expense ratio, annual return consistency, and concentration**. Together they help distinguish attractive historical numbers from an exposure the user actually wants to hold.

Defer forecasts, Sharpe/Sortino ratios, valuation scores, and automatic rankings until the catalogue and core metrics are reliable. They add assumptions and complexity without replacing the basic comparisons above.
