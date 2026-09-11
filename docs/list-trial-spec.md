# Breakout → List Trial: Step 0 Contract

Status: frozen experiment contract for the first implementation slice.

## Purpose

List Trial is an experimental, early-bottom research view. It asks whether a beaten-down stock looks like it may be forming a provisional bottom while it is still near the low. It is not a confirmed-recovery signal and is not a trading recommendation.

The first implementation must expose causal, as-of-date evidence before introducing a composite score.

## Scope

List Trial will be a sibling subtab under Breakout, alongside the existing List and Low Detection subtabs.

The first version supports a small, manually managed set of historical trial rows. Each row has:

- ticker
- candidate date
- cohort: `benchmark` or `control`
- optional note

Initial cohorts should contain known eventual recoveries (for example TEAM, HUBS, CRM, SAP, and WDAY) and beaten-down false-bottom/control examples. A benchmark row is a test example, not proof that the eventual outcome was predictable on that date.

## Eligibility

A candidate is considered beaten down when it is at least 40% below the all-time high known on the candidate date.

For historical evaluation, the all-time high must be calculated only from data available through that date. The current all-time high must never be used to qualify a historical candidate.

Eligibility is a gate for the experiment. A strong indicator reading cannot compensate for a stock that fails the beaten-down requirement.

## Candidate-date rule

The candidate date represents a provisional bottom attempt, not a confirmed pivot or recovery.

At the candidate date, the system may use only information available through that date, including:

- historical prices, volume, and calculated indicators through that date
- rolling-low and prior-selling-episode context
- drawdown from the then-known all-time high

It must not use any later bar to construct the signal, choose the anchor, select the lowest eventual close, or calculate the candidate score.

A stock may base for an extended period after the candidate date. Immediate upside is not required.

## First-version evidence

The raw List Trial view should show evidence before a score is added:

- drawdown from then-known all-time high
- distance from the relevant rolling low
- prior selling-episode / prior-low context
- RSI and RSI change versus the prior selling episode
- ATR-normalized MACD histogram change
- DI gap and ADX change
- CMF and volume context
- ATR and a clearly displayed provisional invalidation reference

The first version must not use MACD or DI bullish crosses, neckline reclaims, future returns, or future drawdowns as inputs to the as-of-date evidence.

## Outcome labels

Future data may be used only after the candidate signal is recorded, to grade the historical trial.

The initial outcome report should support:

- whether +15%, +20%, or +30% was reached
- whether a downside threshold was reached first
- maximum adverse excursion before the target
- days to target, when reached
- returns after 60, 120, and 250 trading days

Success is event-ordered: a candidate succeeds for a given target only when that target is reached before the selected meaningful-breakdown threshold. A later recovery does not erase a failure that happened first.

The first implementation may display a small threshold matrix rather than committing to one final downside threshold. Initial trial variants are -8%, -12%, and -15%, with ATR-relative context shown where practical.

## Explicit non-goals for the first slice

- no automatic full-market historical screener
- no point-in-time reconstruction of the entire Finviz universe
- no automated historical replay yet
- no Bottom Candidate Score yet
- no changes to existing Breakout or Low Detection calculations
- no position sizing or buy/sell recommendation
- no weight fitting against the benchmark names
- no new database or background-job system unless existing persistence cannot support the manual rows

## Phase 0 exit criteria

Step 0 is complete when this contract is reviewed and accepted. The next implementation step may add only the List Trial tab shell and its experimental empty state; it must not add data fetching or scoring.
