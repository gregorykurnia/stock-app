# Portfolio snapshot recovery

The authenticated capture endpoint reconciles published SPY trading sessions from the first stored snapshot through the latest completed New York day. Weekends and exchange holidays have no daily bar and create no snapshot.

Missing, partial, and stale ledger snapshots are rebuilt from historical unadjusted daily closing prices, same-day USD/IDR, and the ledger through the end of that New York day. Yahoo currency sessions starting at 23:00 UTC belong to the following calendar day. Trading bars with unpublished closes still count as sessions, keeping recovery pending until prices arrive. Complete snapshots are retained unless ledger corrections invalidate them. Each request processes up to three dates; a later retry continues the backlog.

The capture workflow runs every 30 minutes during UTC hours 20–23 and 0–12, including weekends. It retries failed requests twice and requires `healthy: true` with no pending dates. Missing FX or provider failures fail the request; missing security prices remain partial and trigger another retry.

If the newest historical candle has no close yet, security valuation may use the regular-market quote only when it is stamped on the requested New York date at or after 16:00. Older dates and intraday quotes never substitute for missing closes. This fallback is conservative for early-close sessions, which wait for the historical daily close.

A separate daily workflow calls `?audit=1` at 13:23 UTC. This is read-only and fails if completed sessions are missing, partial, or stale. Failed workflow notifications use the repository owner's GitHub Actions notification settings. Both workflows require the existing `CRON_SECRET` in GitHub and Vercel.

Run **Capture portfolio snapshot** manually to recover a gap immediately, then run **Audit portfolio snapshots** to verify coverage. Recovery requires ledger history; it does not invent historical holdings from the legacy editable portfolio table. Scheduler and quote-provider outages can still delay capture, but subsequent successful runs recover missed sessions.
