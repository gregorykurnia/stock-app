# Performance Accounting Architecture

Status: design note for future implementation
Created: 2026-09-17

## Purpose

This note records the audit and recommendation for the Performance tab so work can resume without reconstructing the discussion. It is a design recommendation only; no implementation has been made yet.

The central issue is that the application currently mixes two different concepts:

1. **Portfolio equity/value:** how much the total portfolio or a pocket is worth, including cash.
2. **Investment performance:** how much value changed because of market movement, dividends, fees, and realized gains/losses, excluding the effect of external contributions and withdrawals.

Deposits, withdrawals, buys, sells, and transfers can change value or allocation without representing the same kind of investment return. The UI should show both concepts explicitly instead of trying to make one line or one percentage answer every question.

## Relevant implementation

Review these files before implementation:

- app/performance/page.tsx
- components/PortfolioPerformanceDashboard.tsx
- components/PortfolioPerformanceChart.tsx
- lib/portfolioPerformance.ts
- lib/portfolioSnapshotServer.ts
- app/api/cron/portfolio-snapshot/route.ts
- lib/firestore.ts
- app/page.tsx
- tests/portfolioPerformance.test.ts

The current test suite passed all 55 tests on 2026-09-17. Those tests validate the existing estimator; they do not establish that the current model is complete portfolio accounting.

## Current behavior and problems

### Snapshot limitations

lib/portfolioSnapshotServer.ts reads the three current collections (portfolio_longterm, portfolio_index, and portfolio_swing) and includes only positions with a positive entry_quantity. It values those positions using closing quotes and USD/IDR FX.

Snapshots do not currently contain:

- cash balances;
- deposits or withdrawals;
- trade timestamps or execution prices;
- dividends;
- fees/taxes;
- transfers between pockets;
- realized gains/losses;
- a transaction ledger or ledger version.

Therefore, a sale that leaves cash in the account can make the tracked invested value fall to zero even though the real account still has the sale proceeds.

### Current inferred-flow formula

lib/portfolioPerformance.ts currently estimates flow from position quantity changes:

    inferredFlow = sum(quantity change × current/ending price)
    dailyReturn = (current value - inferredFlow) / previous value - 1

This is an endpoint-only estimate. It does not know whether a quantity change came from a deposit-funded purchase, an internal cash-funded trade, a partial sale, a transfer, or a manual correction. It also uses the ending price for additions and, for a position that disappears, the prior price. That can differ materially from the execution price.

### UI inconsistencies

In PortfolioPerformanceDashboard.tsx:

- Current Value is based on invested positions only, not cash.
- Latest Change uses the raw dollar value change.
- The percentage displayed under Latest Change uses the flow-adjusted estimate.
- The Value chart shows raw position value.
- The Return chart compounds the estimated flow-adjusted return.
- The chart hover text currently describes raw value change while the selected currency and return mode may imply a different measure.
- Pocket values and allocation also exclude cash.
- Partial snapshots can understate value because positions with missing/stale quotes are omitted; returns should not silently appear trustworthy when snapshot status is partial.
- Selecting a date range rebuilds points from the first snapshot inside the range, rather than necessarily using the immediately preceding snapshot as the opening baseline.
- Average daily/weekly/monthly statistics are arithmetic averages of period returns, although their labels imply compounded period performance. Define the desired methodology before preserving those labels.

### Manual-edit limitations

app/page.tsx currently writes entry_quantity and entry_price directly to the current pocket document. A quantity edit between two snapshots creates an unexplained discontinuity. Removing a position deletes the current document and leaves no sale or archive event. A single entry_price cannot accurately represent multiple purchases at different prices or the cost basis of partial sales.

## Numerical scenarios

Use USD for illustration. Assume the portfolio starts with 100 shares of ABC at $100. The current application does not include cash in its snapshot values.

| Scenario | Correct accounting result | Current behavior |
|---|---|---|
| Deposit $2,000 into Swing, no purchase, price stays flat | Equity rises from $10,000 to $12,000. Net contribution is $2,000. Investment return is 0%. | Cash is invisible; the portfolio still appears worth $10,000. |
| Deposit $2,000 and buy 20 shares at $100 | Equity becomes $12,000 and return is 0%. | Value jumps by $2,000, while inferred return is 0%. The dollar and percentage parts of Latest Change describe different concepts. |
| Use existing $2,000 cash to buy 20 shares at $90; close at $100 | Starting equity is $12,000; ending equity is $12,200. Gain is $200, or 1.67%. | The app sees invested value move from $10,000 to $12,000, infers a $2,000 flow, and reports 0%. |
| Sell 20 shares at $100; remaining 80 shares close at $110 | Equity is 80 × $110 + $2,000 cash = $10,800, an 8% gain. | Invested value is $8,800; inferred flow is -20 × $110 = -$2,200; adjusted return is reported as +10%, and the raw value chart falls 12%. |
| Sell all shares at $100 and leave $10,000 as cash | Equity remains $10,000 and return is 0%. | Invested value becomes $0; the chart crashes to zero and Current Value becomes $0. If the sale was at $105, the app also misses the 5% realized gain. |
| Transfer $3,000 from Long Term to Index | Total equity and total return are unchanged; only allocation changes. | Cash transfers are invisible. Position transfers may cancel mathematically, but there is no transfer identity or annotation, and pocket value lines jump. |
| Receive a $100 dividend as cash | Equity increases by $100 and investment return is +1%. | Holdings are unchanged, so return is 0%. If the price drops by $1 on the ex-dividend date, the app may show -1% even though the total return is approximately 0%. |
| Pay a $50 fee from cash | Equity decreases by $50 and return is -0.5%. | Holdings are unchanged, so return is 0%. |
| Buy 20 shares at $100 early in the day; close at $110 | With a $2,000 contribution, ending equity is $13,200 and the actual market return is +10%. | The inferred flow is 20 × $110 = $2,200; the formula reports 0% and loses the market gain. |

Two daily endpoints cannot establish the exact event timing, execution price, or whether cash existed before the trade. This is why a proper ledger is needed.

## Return methodology recommendation

### Time-weighted return (TWR)

Use TWR as the primary performance measure for the total portfolio and for comparing Long Term, Swing, and Index. It removes the effect of external deposits and withdrawals, so it measures the performance of the invested strategy rather than the timing of contributions.

Conceptually, split the timeline around external cash flows:

    subperiod return = value after market movement / value before the market movement - 1
    total TWR = product of (1 + each subperiod return) - 1

Exact TWR requires valuations immediately before and after significant external flows. With only daily closes, use a documented daily convention or Modified Dietz as a fallback.

### Modified Dietz

Use Modified Dietz as a practical interim or fallback method when event-level valuations are unavailable:

    R = (ending value - beginning value - sum of external flows)
        / (beginning value + sum of weighted external flows)

The weight represents how long each external flow was invested during the measurement period. It still requires the flow amount and timestamp; it is not a replacement for a transaction ledger.

### Money-weighted return / XIRR

Offer XIRR as an optional personal-return metric. It answers: “What annualized return did my actual invested cash experience, given when I deposited and withdrew money?” It is useful for personal wealth tracking but not ideal for comparing pockets because contribution timing can dominate the result.

Recommended primary metrics:

- Overall portfolio strategy: TWR.
- Comparing Long Term, Swing, and Index: pocket-level TWR.
- Personal experience after deposits and withdrawals: XIRR/MWR.
- Temporary daily-only fallback: Modified Dietz.

## Action classification

| Action | Total portfolio treatment | Pocket treatment | Performance treatment |
|---|---|---|---|
| Deposit | External cash flow | External cash flow assigned to a pocket | Exclude from TWR; include in net contributions |
| Withdrawal | External cash flow | External cash flow from a pocket | Exclude from TWR; include in net contributions |
| Buy | Cash-to-security exchange | Internal | No external flow if cash is tracked; affects future P/L |
| Sell | Security-to-cash exchange | Internal | No external flow; calculate realized P/L |
| Transfer between pockets | Internal | Transfer between pockets | No total flow; neutralize in pocket returns |
| Dividend | Investment income | Investment income | Counts toward investment performance |
| Fee/tax | Investment expense | Investment expense | Reduces investment performance |
| FX conversion | Internal currency exchange | Internal | Not a contribution; record both currency legs |
| FX movement | Valuation effect | Valuation effect | Included in IDR return; excluded from USD return if USD is the base |

A dividend that is later withdrawn should be two records: dividend income, then an external withdrawal.

## Minimum recommended data model

Use an append-only transaction ledger as the source of truth for activity. Current pocket documents may remain as a derived/cache view during migration.

### Transaction record

    transactionId
    occurredAt
    recordedAt
    type: deposit | withdrawal | buy | sell | transfer | dividend | fee
          | fx_conversion | opening_balance | reconciliation_adjustment
    bucket
    fromBucket
    toBucket
    ticker
    quantity
    price
    grossAmount
    fees
    currency
    cashDelta
    externalFlow
    transferId
    notes
    source

Use signed, documented amounts and immutable occurredAt values. Buy and sell records should contain both security quantity movement and the opposite cash movement. Transfers should have linked legs with the same transferId.

### Cash and positions

Track cash for each pocket and total:

    cash.longterm
    cash.swing
    cash.index
    cash.total

Prefer deriving the balance from the ledger, with a denormalized balance only as a performance optimization. A reconciliation tool can create an explicit adjustment record rather than silently changing the balance.

### Snapshot schema version 2

Future snapshots should include cash plus invested value:

    schemaVersion
    sessionDate
    capturedAt
    ledgerAsOf
    baseCurrency
    fxRate

    total:
      cashValue
      investedValue
      totalValue
      realizedGain
      unrealizedGain
      income
      fees

    buckets:
      longterm: same value fields
      swing: same value fields
      index: same value fields

    positions:
      ticker
      bucket
      quantity
      closePrice
      marketValue
      costBasis
      unrealizedGain

    status

The snapshot should identify the ledger version/as-of time used to calculate it. If a quote is missing, do not silently present an understated total as a precise return; mark it partial and suppress or label affected performance calculations.

### Cost basis

One manual entry_price is not enough for multiple purchases and partial sales. Choose and document one of:

- Weighted-average cost: simpler and probably sufficient for this personal analytics app.
- FIFO lots: more accurate for realized P/L and tax-style reporting.

The ledger should retain actual trade prices and fees even if the UI initially displays only average cost.

## Performance UI recommendation

### Cards

- Current Value: cash plus current market value of positions.
- Net Contributions: deposits minus withdrawals for the selected scope and period.
- Investment Gain/Loss: current equity minus opening equity minus net external contributions; include realized/unrealized gains, income, expenses, and FX according to the selected base currency.
- Latest Equity Change: raw change in total equity.
- Latest External Flow: deposits/withdrawals during the latest period.
- Latest Investment Return: TWR after excluding external flows.
- Period Return: TWR for the selected range, using an opening baseline immediately before the range.
- Average daily/weekly/monthly return: geometric average of valid period returns, not an arithmetic average. Consider replacing these with annualized return/CAGR when the period is long enough.
- Maximum Drawdown: drawdown from the normalized TWR high-water mark, not from a raw equity curve inflated by deposits.
- Bucket Allocation: bucket equity divided by total equity, including cash.
- Bucket Return: pocket-level TWR, neutralizing deposits and transfers assigned to that pocket.

Do not combine a raw dollar change with a flow-adjusted percentage without labeling both concepts.

### Charts

Show two separate chart modes:

1. **Equity / Value chart**
   - Shows actual total and pocket equity, including cash.
   - Deposits and withdrawals visibly change the level.
   - Buys and sells should not change total equity at the transaction price when cash is tracked.
   - Pocket transfers change allocation but not total equity.

2. **Investment Return chart**
   - Starts at 0% or an index of 100.
   - Shows TWR for total and pockets.
   - External contributions and withdrawals do not create fake spikes.
   - Uses a tooltip showing equity, external flow, internal activity, cash, and return separately.

Annotate deposits, withdrawals, transfers, dividends, fees, buys, and sells. For a Long Term → Index transfer, the equity/allocation view should move, while the total return view should remain flat.

### Activity and transaction history

Add a separate Activity History view in a later phase. Snapshot History and Activity History answer different questions:

- Snapshot History shows what the portfolio was worth at each daily market-close capture.
- Activity History shows what the user did and what happened between captures.

Activity History should show, at minimum:

- buy and sell date/time;
- pocket;
- ticker, when applicable;
- quantity;
- execution price;
- gross amount;
- fees;
- net cash movement;
- cost basis of shares sold;
- realized gain/loss for sells;
- remaining quantity after the transaction;
- deposit and withdrawal amounts;
- pocket transfers with source and destination;
- dividend and fee events;
- whether the entry was recorded late or estimated.

Example activity records:

| Date | Type | Pocket | Ticker | Quantity | Amount | Realized P/L |
|---|---|---|---|---:|---:|---:|
| Sep 16 | Buy | Long Term | VOO | 10 | $4,500 | — |
| Sep 17 | Deposit | Long Term | — | — | $2,000 | — |
| Sep 20 | Sell | Swing | ABC | 20 | $2,200 | +$300 |
| Sep 22 | Transfer | Long Term → Index | — | — | $1,000 | — |

A deposit into Long Term and a later VOO purchase should be two separate records. The deposit belongs to the pocket and is an external flow; the buy identifies the ticker and is an internal cash-to-security movement. If the user wants to associate the deposit with a planned ticker, that can be an optional note or purpose field, but it should not replace the accounting events.

Activity History should support filtering by total portfolio, pocket, ticker, transaction type, and date range. It should also support late/backdated entries by showing both occurredAt (when the event happened) and recordedAt (when it was entered). Adding a late event should identify the affected snapshots and trigger recalculation of derived performance from the earliest affected date.

A buy has no realized gain/loss yet; it creates cost basis and future unrealized gain/loss. A sell should calculate:

    realized gain/loss = net sale proceeds - cost basis of shares sold

The history must be append-only for accounting events. Corrections should create a new adjustment or correction record rather than silently deleting the original history.

## Manual edits after the ledger exists

Replace direct quantity editing with a Record activity form:

- Buying more shares creates a buy transaction.
- Selling shares creates a sell transaction.
- Moving money or a position creates a transfer transaction.
- Removing a position means closing/archiving it, not deleting its history.
- Manual edits remain available only as reconciliation adjustments requiring an effective date and reason.
- entry_price should become derived average cost or a display field; it should not silently overwrite ledger history.

## Migration strategy

Do not pretend historical snapshots can become exact without historical transaction data.

1. Preserve schema-version-1 snapshots as legacy estimated history.
2. Add an opening-balance record for each pocket.
3. Record current cash, quantities, and cost basis as of a reconciled effective date.
4. Start accurate ledger-based performance from the first reconciled schema-version-2 snapshot.
5. Optionally import known deposits/trades from CSV.
6. Never invent historical dates, execution prices, or cash balances.
7. Label legacy segments as estimated or show them separately from ledger-accurate history.

## Phased implementation plan

### Phase 1: accounting rules

Document base currency, dividend/fee treatment, cost-basis method, pocket-transfer rules, and whether cash is tracked separately per pocket.

#### Adopted defaults for the first implementation

- USD is the ledger base currency. IDR cash is supported as a separate cash currency, while IDR valuation and FX decomposition remain snapshot/calculation work.
- Positions use weighted-average cost basis. Trade fees are included in buy cost basis and reduce net sale proceeds; dividends are income and fees are expenses.
- Cash is derived separately for each pocket and then summed into portfolio totals.
- The first activity workflow is manual entry. Broker integration and historical CSV import remain later work.
- Opening balances and reconciliation adjustments establish the accurate-history start point. Existing schema-version-1 snapshots remain legacy estimated history.
- TWR is the primary normalized return measure; XIRR is the optional personal cash-timing measure; Modified Dietz remains deferred.

#### Current implementation status

- Schema-version-1 snapshots remain unchanged and are labeled as estimated history.
- Schema-version-2 snapshots are ledger-backed with USD base valuation, per-pocket cash, weighted-average cost, realized/unrealized fields, and explicit partial-data behavior.
- Manual activity entry, reconciliation previews, append idempotency, late-activity impact detection, and USD XIRR are implemented.
- An authenticated snapshot run automatically recaptures affected schema-version-2 sessions from historical daily closes. Missing historical closes remain partial; no historical value is invented.
- XIRR fails closed when the period contains IDR external flows because historical FX conversion is not yet available.

### Phase 2: ledger and cash

Add the transaction collection, transaction types, cash balances, linked transfers, opening balances, reconciliation entries, and duplicate/idempotency protections.

### Phase 3: snapshots

Add cash, total equity, invested value, realized/unrealized fields, ledger version, schema version 2, and explicit partial-data behavior.

### Phase 4: calculations

TWR, XIRR, realized/unrealized gains, correct range baselines, and currency-aware returns are implemented. Modified Dietz remains a future fallback for periods where daily TWR inputs are unavailable.

### Phase 5: UI

Add activity entry, cash display, net contributions, investment gain/loss, separate equity and return charts, activity markers, consistent tooltips, and estimated-history labels.

### Phase 6: tests and reconciliation

Add accounting-invariant tests and a way to reconcile the ledger-derived current state against the manually maintained portfolio view.

## Acceptance criteria

- Depositing cash increases equity but produces 0% TWR at the deposit moment.
- Buying with cash does not change total equity at the trade price.
- Selling into cash does not reduce total equity to zero.
- Partial sales calculate realized P/L from recorded cost basis.
- Dividends increase performance; fees reduce performance.
- Transfers preserve total equity and total return while changing pocket allocation.
- Activity History shows buys, sells, deposits, withdrawals, transfers, dividends, and fees with dates, amounts, and relevant realized P/L.
- A deposit into a pocket and a later ticker purchase appear as separate activity records.
- Late/backdated activity records show occurredAt and recordedAt and cause affected derived metrics to recalculate.
- Multiple transactions on one day are processed in timestamp order.
- USD and IDR returns have explicit, documented FX behavior.
- Missing quotes cannot silently create a false return.
- Total value equals the sum of pocket values.
- Internal transfers net to zero at the total-portfolio level.
- The selected range uses the correct opening baseline.
- Legacy snapshots remain visibly estimated.
- Raw equity changes and flow-neutralized returns are never presented as if they were the same metric.

## Clear recommendation

Implement a manual transaction ledger with cash balances first; broker integration is not required initially. Then:

- use total equity for the raw value chart;
- use TWR for normalized performance and strategy comparison;
- offer XIRR for personal cash-timing performance;
- treat buys and sells as internal cash/security movements;
- treat deposits and withdrawals as external flows;
- treat pocket transfers as internal movements;
- preserve old snapshots as estimated instead of fabricating exact historical attribution.

## Next-session starting point

Before writing code, decide and document:

1. Base currency and whether the app should show both USD and IDR return decomposition.
2. Weighted-average cost versus FIFO lots.
3. Whether every pocket has its own cash balance.
4. Whether the first implementation is manual activity entry only.
5. How to initialize opening balances and the accurate-history start date.
6. Exact card labels and whether average returns should be replaced by annualized metrics.

The first implementation slice should likely be the ledger schema, opening/reconciliation records, and cash-inclusive snapshot model. Return formulas and UI should follow that accounting foundation.
