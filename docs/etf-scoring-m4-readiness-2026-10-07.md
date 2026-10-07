# ETF scoring M4 readiness · 2026-10-07

Status: M4 implementation has started with a reviewed data-use gate. New Yahoo acquisition and retained-artifact writes are blocked until the personal-use source and retention decisions are recorded in [the policy file](../data/etf-scoring-data-use-policy.json). This is an implementation checkpoint, not the M4 acceptance report.

## Infrastructure inspection

- A Vercel production deployment is Ready. The repository has portfolio snapshot and alert cron handlers, but no ETF scoring refresh handler or checked-in Vercel schedule was found. The deployment listing does not establish that an ETF scoring worker or durable M4 run store is deployed.
- `lib/etfMetricStore.ts` already has a Firestore job cursor, run ID, hourly Tiingo request counter, and year-partitioned history writes. `lib/etfFreeCoreTrialStore.ts` stores hash-keyed history chunks but replaces each ticker's displayed snapshot. These are useful patterns, not a complete immutable ETF run store.
- Existing ETF persistence imports the Firebase web client from `lib/firebase.ts`. No Firebase Admin dependency or server-only Firestore initialization was found. The repository also has no checked-in Firestore rules or Firebase deployment configuration, so server-only write permissions and reader immutability have not been demonstrated.
- The retained M3 artifact is 4,046,474 bytes. Standard Cloud Firestore documents are limited to 1 MiB, so this artifact cannot be saved as a single document; the [official quota documentation](https://firebase.google.com/docs/firestore/quotas) confirms that limit. Existing yearly chunking may help with history rows, but the M4 artifact, manifest and total run cost still need a measured storage design.
- The repository's M4 scope remains the frozen 12-fund sample and unchanged `equity-index-free-core-trial-v1` method. IEFA, EFA and ACWX return discrepancies, continuity/history blockers, and historical fee blockers remain in force.

## Initial implementation

`lib/etfEquityIndexM4Policy.ts` validates a dated, recorded source-use review and a bounded retention period. The M3 refresh script checks this policy before a new Yahoo request or writing its retained artifact. All five decisions in the checked-in policy are currently `unresolved`; this prevents a successful prior request from being treated as permission for another capture or durable storage.

The policy separately records Yahoo requests, raw adjusted-close retention, derived-score retention, issuer return-evidence retention, and future issuer requests. It requires a review timestamp, review record, and retention period of 1–3650 days before retained data is written. The policy test uses synthetic policy objects and does not contact providers or write captured data.

## Open M4 dependencies

1. Record which provider requests and data categories may be used and retained for the personal-use deployment, with a retention period.
2. Choose and verify a server-only persistence path. The current web SDK and missing checked-in security rules are insufficient evidence for canonical immutable writes.
3. Measure a bounded chunk/manifest design, run cost and retention behavior against the deployed Firestore project or an approved object store.
4. Implement run IDs, resumable per-ticker progress, shared request budgeting, retry exhaustion, revision detection, prior-run preservation, and persisted raw-text replay after the storage path is selected.

Until these dependencies are met, M4 has not performed a new provider capture or written an M4 run. The M3 artifact remains the existing validation record; it has not been converted into a new persistent run.
