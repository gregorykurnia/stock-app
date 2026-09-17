# Performance Macro Context

## Implementation prompt

I want to enhance the Performance view with a macroeconomic context section that helps explain whether the current environment is more inflationary, expansionary, or exposed to recession risk.

Do not make any code changes yet. First inspect the existing Performance page, charting components, data sources, styling conventions, and the relevant Next.js documentation in `node_modules/next/dist/docs/`. Then report:

1. What the current Performance page supports.
2. Which macroeconomic data is already available.
3. Which new data sources or APIs would be required.
4. A proposed implementation plan.
5. Any important limitations or decisions that need approval.

The proposed feature should include:

### 1. US interest-rate outlook

Create an interactive historical chart showing, where reliable data is available:

- Federal Funds Rate or effective Fed Funds Rate.
- 2-year US Treasury yield.
- 10-year US Treasury yield.
- The 2-year minus 10-year Treasury spread.
- A zero line for the yield spread, with clear visual treatment when the curve is inverted.
- Time-range controls such as 1 year, 5 years, 10 years, and maximum available history.
- Tooltips showing the date, value, unit, and data source.
- If a forward outlook is available, show it separately and label it clearly as either “market-implied expectations” or “official projections.” Never present forecasts as certainty.
- Include the latest update date and source attribution.

The chart should make it easy to understand:

- Whether interest rates are rising, falling, or stable.
- Whether the yield curve is normal, flat, or inverted.
- Whether markets are pricing future rate cuts or hikes.

### 2. Short-term debt-cycle view

Add an educational short-term debt-cycle visualization representing the typical multi-year credit cycle:

- Early expansion / recovery.
- Mid-cycle expansion.
- Late-cycle tightening.
- Contraction / recession risk.
- Easing / renewed recovery.

This should not imply that the cycle can be measured with perfect precision. Show the current estimated phase as a heuristic assessment based on observable signals such as:

- Interest-rate direction.
- Inflation trend.
- Unemployment trend.
- Yield-curve shape.
- Credit conditions or credit spreads, if available.
- Economic growth momentum, if available.

Display the current phase with:

- A clear label.
- A confidence level.
- The main signals supporting the classification.
- A disclaimer that this is an analytical framework, not a prediction or investment recommendation.

### 3. Long-term debt-cycle view

Add a separate, more conceptual long-term debt-cycle visualization based on the idea of long periods of:

- Debt and credit expansion.
- Increasing leverage and asset-price expansion.
- Debt-service pressure and monetary tightening.
- Deleveraging or restructuring.
- Monetary easing and a new expansion phase.

This should be presented as a broad educational framework, not as an exact real-time measurement. Do not fabricate a precise current position if the required historical debt and credit data is unavailable.

If sufficient data exists, support the long-term view with indicators such as:

- Debt-to-GDP.
- Private-sector credit growth.
- Debt-service burden.
- Real interest rates.
- Broad money or liquidity growth.

If sufficient data does not exist, show a clearly labeled conceptual diagram and explain that it is not directly measured by the application.

### 4. Macro-regime summary

Create a summary card that translates the charts into a simple current-regime assessment:

- Inflation pressure: Low / Moderate / High.
- Recession risk: Low / Moderate / High.
- Growth momentum: Weak / Stable / Strong.
- Monetary policy stance: Easing / Neutral / Tightening.
- Yield-curve status: Normal / Flat / Inverted.

Each label should include a short explanation based on the underlying data. Use cautious language such as “risk is rising” or “signals are mixed,” not definitive claims such as “a recession is coming.”

### 5. UX and visual requirements

- Match the existing Performance page design system.
- Keep the section understandable to a user who is familiar with investing but not an economist.
- Use responsive layouts for desktop and mobile.
- Provide legends, tooltips, loading states, error states, and unavailable-data states.
- Do not overload the page with too many charts at once; prioritize clarity.
- Distinguish historical observations from forecasts and conceptual diagrams.
- Include data source, timestamp, units, and methodology wherever appropriate.
- Avoid fake, hardcoded, or stale-looking macroeconomic values.
- Do not provide personalized financial advice.

Before implementing, recommend the best layout and identify whether the feature should use live APIs, cached data, or a combination of both. Wait for approval after presenting the plan.
