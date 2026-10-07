# ETF scoring M4 readiness · 2026-10-07

Status: M4 implementation has started with a reviewed data-use gate. New Yahoo acquisition and retained-artifact writes are blocked until the personal-use source and retention decisions are recorded in [the policy file](../data/etf-scoring-data-use-policy.json). This is an implementation checkpoint, not the M4 acceptance report.

## Infrastructure inspection

- A Vercel production deployment is Ready. The repository has portfolio snapshot and alert cron handlers, but no ETF scoring refresh handler or checked-in Vercel schedule was found. The deployment listing does not establish that an ETF scoring worker or durable M4 run store is deployed.
- `lib/etfMetricStore.ts` already has a Firestore job cursor, run ID, hourly Tiingo request counter, and year-partitioned history writes. `lib/etfFreeCoreTrialStore.ts` stores hash-keyed history chunks but replaces each ticker's displayed snapshot. These are useful patterns, not a complete immutable ETF run store.
- Existing ETF persistence imports the Firebase web client from `lib/firebase.ts`; its snapshot writers replace per-ticker documents. The M4 code now has a separate server-only Firebase Admin initializer and run-store adapter in `lib/firebaseAdminServer.ts` and `lib/etfEquityIndexM4FirestoreStore.ts`. No service-account credential is configured in the Vercel environment-variable listing. Encrypted values were not read, and the adapter has not connected to Firestore.
- M4 expects `FIREBASE_SERVICE_ACCOUNT_JSON`, containing a service account for project `stock-app-898d1`, only in a private server environment, following [Firebase Admin SDK server-credential guidance](https://firebase.google.com/docs/admin/setup). The M4 adapter adds Firestore `ttlExpiresAt` timestamps, but the project's TTL policy and the service account's IAM permissions still need configuration and verification.
- The retained M3 artifact is 4,046,474 bytes. Standard Cloud Firestore documents are limited to 1 MiB, so this artifact cannot be saved as a single document; the [official quota documentation](https://firebase.google.com/docs/firestore/quotas) confirms that limit. Existing yearly chunking may help with history rows, but the M4 artifact, manifest and total run cost still need a measured storage design.
- The repository's M4 scope remains the frozen 12-fund sample and unchanged `equity-index-free-core-trial-v1` method. IEFA, EFA and ACWX return discrepancies, continuity/history blockers, and historical fee blockers remain in force.

## Initial implementation

`lib/etfEquityIndexM4Policy.ts` validates a dated, recorded source-use review and a bounded retention period. The M3 refresh script checks this policy before a new Yahoo request or writing its retained artifact. All five decisions in the checked-in policy are currently `unresolved`; this prevents a successful prior request from being treated as permission for another capture or durable storage.

The policy separately records Yahoo requests, raw adjusted-close retention, derived-score retention, issuer return-evidence retention, and future issuer requests. It requires a review timestamp, review record, and retention period of 1–3650 days before retained data is written. The policy test uses synthetic policy objects and does not contact providers or write captured data.

`lib/etfEquityIndexM4Storage.ts` defines an immutable M4 manifest, deterministic run IDs, content-hashed 512 KiB raw-text chunks, expiry metadata, exact chunk reassembly, and raw-text M3 replay before a run can advance the internal latest-success pointer. Its resumable ticker checkpoint tracks leases, retries, errors, and a shared hourly Yahoo request budget scope. `lib/etfEquityIndexM4FirestoreStore.ts` implements create-only Firestore records, transactional progress compare-and-set, readback, and passing-run promotion. Tests exercise the stored-run workflow with an in-memory adapter and replay the already retained M3 artifact under Node 26; no Firestore credentials or provider requests are used by those tests.

## Open M4 dependencies

1. Record which provider requests and data categories may be used and retained for the personal-use deployment, with a retention period.
2. Add the server credential to private local/Vercel configuration, verify its project and least-privilege Firestore access, and configure Firestore TTL for `ttlExpiresAt`.
3. Measure storage and request costs and test the adapter's create-only, revision-CAS, TTL, concurrency and prior-run-preservation behavior against the deployed Firestore project.
4. Connect resumable Yahoo acquisition to the store, retaining successful per-ticker histories in bounded staging records so an interrupted worker can resume without recapturing completed tickers.

Until these dependencies are met, M4 has not performed a new provider capture or written an M4 run. The M3 artifact remains the existing validation record; it has not been converted into a new persistent run.
