# Breakout → List Trial: Step 0 Contract

Status: frozen experiment contract for the first implementation slice.

## Purpose

List Trial is an experimental, early-bottom research view. It asks whether a beaten-down stock looks like it may be forming a provisional bottom while it is still near the low. It is not a confirmed-recovery signal and is not a trading recommendation.

The implementation exposes causal, as-of-date evidence before applying a composite score. Future outcome labels remain separate from all score inputs.

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

## First-version evidence and provisional score

The raw List Trial view shows the following evidence alongside its score:

- drawdown from then-known all-time high
- distance from the relevant rolling low
- prior selling-episode / prior-low context
- RSI and RSI change versus the prior selling episode
- ATR-normalized MACD histogram change
- DI gap and ADX change
- CMF and volume context
- ATR and a clearly displayed provisional invalidation reference

The first Provisional Bottom Score is a fixed, unoptimized 0–100 heuristic. It is withheld, rather than coerced to zero, unless all hard gates pass:

- at least 40% below then-known ATH
- within 15% of the 20-day rolling low
- a comparable prior selling episode is available
- RSI, normalized MACD histogram, DI gap, ADX, and CMF comparison data are all available

When scoreable, it allocates 5 points to drawdown depth, 20 to proximity to the rolling low, 15 to price structure, 15 to RSI improvement, 15 to normalized MACD histogram improvement, 15 to DI/ADX selling-pressure improvement, and 15 to CMF improvement. These weights are deliberately not fitted to benchmark names and must be tested against controls before calibration.

The score must not use MACD or DI bullish crosses, neckline reclaims, future returns, or future drawdowns as inputs.

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

## Small causal replay

List Trial supports an on-demand replay for one ticker over a user-selected range of up to five years. For every qualifying day in that range, the score is calculated from that day and earlier bars only; future daily closes are used only to grade the saved signal under the +20% before -12% primary outcome.

Repeated qualifying days are grouped into one bottoming episode. An episode opens on its first qualifying day and re-arms only after 10 consecutive non-qualifying trading sessions. The episode keeps the first qualifying day's trigger score, evidence anchors, and entry plan; later qualifying days do not replace those values. Replay reports raw qualifying-day counts separately, while outcome and score-band accounting is episode-level.

The entry plan is causal and executable: the zone is frozen from the trigger day's 20-day rolling low through `min(trigger close, rolling low + 1 × ATR14)`. Execution is allowed only at the next trading session's open, with a fixed 10 bps buy-slippage assumption. A next-session open above the zone is `missed_zone`; if no next session is available, the episode is `not_entered_no_future_data`. These states are reported separately from entered-episode outcomes.

The replay is intentionally limited to selected tickers and ranges. It does not attempt a full-market historical screen or persist a replay dataset.

## Live candidate trial

The Live Candidates panel is a small, manually curated prospective watchlist. Tickers are added from the user's beaten-down Finviz run, with an optional note and the timestamp when the candidate entered the trial.

When the panel loads, each ticker receives the same causal evidence and provisional score as a snapshot through today (or the latest available trading day). It does not attach future outcome labels, import Finviz automatically, schedule background scans, or tune the score. The live list is therefore a clean place to observe whether the current score/evidence remains useful before adding any automation or execution workflow.

## Explicit non-goals for the first slice

- no automatic full-market historical screener
- no point-in-time reconstruction of the entire Finviz universe
- no batch job or persistent full-universe replay dataset
- no changes to existing Breakout or Low Detection calculations
- no position sizing or buy/sell recommendation
- no weight fitting against the benchmark names
- no new database or background-job system unless existing persistence cannot support the manual rows

## Phase 0 exit criteria

Step 0 is complete when this contract is reviewed and accepted. The next implementation step may add only the List Trial tab shell and its experimental empty state; it must not add data fetching or scoring.
