# ETF scoring M4 readiness · 2026-10-07

Status: M4 implementation has started with conservative personal-use defaults recorded in [the policy file](../data/etf-scoring-data-use-policy.json). Automated Yahoo and issuer requests are blocked; raw-history, derived-score, and issuer-evidence retention remain unresolved pending applicable source terms or express permission. A 365-day retention target is selected but does not authorize writes. This is an implementation checkpoint, not the M4 acceptance report.

## Infrastructure inspection

- A Vercel production deployment is Ready. The repository has portfolio snapshot and alert cron handlers, but no ETF scoring refresh handler or checked-in Vercel schedule was found. The deployment listing does not establish that an ETF scoring worker or durable M4 run store is deployed.
- `lib/etfMetricStore.ts` already has a Firestore job cursor, run ID, hourly Tiingo request counter, and year-partitioned history writes. `lib/etfFreeCoreTrialStore.ts` stores hash-keyed history chunks but replaces each ticker's displayed snapshot. These are useful patterns, not a complete immutable ETF run store.
- Existing ETF persistence imports the Firebase web client from `lib/firebase.ts`; its snapshot writers replace per-ticker documents. The M4 code now has a separate server-only Firebase Admin initializer and run-store adapter in `lib/firebaseAdminServer.ts` and `lib/etfEquityIndexM4FirestoreStore.ts`. No service-account credential is configured in the Vercel environment-variable listing. Encrypted values were not read, and the adapter has not connected to Firestore.
- M4 expects `FIREBASE_SERVICE_ACCOUNT_JSON`, containing a service account for project `stock-app-898d1`, only in a private server environment, following [Firebase Admin SDK server-credential guidance](https://firebase.google.com/docs/admin/setup). The M4 adapter adds Firestore `ttlExpiresAt` timestamps, but the project's TTL policy and the service account's IAM permissions still need configuration and verification.
- The retained M3 artifact is 4,046,474 bytes. Standard Cloud Firestore documents are limited to 1 MiB, so this artifact cannot be saved as a single document; the [official quota documentation](https://firebase.google.com/docs/firestore/quotas) confirms that limit. Existing yearly chunking may help with history rows, but the M4 artifact, manifest and total run cost still need a measured storage design.
- The repository's M4 scope remains the frozen 12-fund sample and unchanged `equity-index-free-core-trial-v1` method. IEFA, EFA and ACWX return discrepancies, continuity/history blockers, and historical fee blockers remain in force.

## Initial implementation

`lib/etfEquityIndexM4Policy.ts` validates a dated, recorded source-use review and a bounded retention period. The M3 refresh script checks this policy before a new Yahoo request or writing its retained artifact. The checked-in review blocks automated Yahoo and issuer requests and leaves all three retention categories unresolved. Yahoo's [Terms of Service](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html) restrict automated access or collection without prior express permission; no applicable permission or authorized market-data API agreement is evidenced here. A successful prior request is not treated as permission for another capture or durable storage.

The policy separately records Yahoo requests, raw adjusted-close retention, derived-score retention, issuer return-evidence retention, and future issuer requests. It requires a review timestamp, review record, and retention period of 1–3650 days before retained data is written. The policy test uses synthetic policy objects and does not contact providers or write captured data.

`lib/etfEquityIndexM4Storage.ts` defines immutable M4 acquisition plans and manifests, deterministic IDs, content-hashed 512 KiB raw-text chunks, per-ticker history stages bound to the frozen sample and retention window, expiry metadata, exact chunk reassembly, and raw-text replay before a run can advance the internal latest-success pointer. Acquisition checkpoints track leases, retries, errors, and a shared hourly Yahoo request budget; a staged history is created and read back before its hash can mark a ticker complete. `lib/etfEquityIndexM4FirestoreStore.ts` implements create-only Firestore records, transactional progress compare-and-set, readback, and passing-run promotion. Tests exercise plan/stage/run behavior with an in-memory adapter and replay the already retained M3 artifact under Node 26; no Firestore credentials or provider requests are used by those tests.

## Open M4 dependencies

1. Establish an applicable permitted acquisition path and retention rights for each provider/data category. Until then, keep automated requests and durable M4 writes blocked; the 365-day window is only a target if later approved.
2. Add the server credential to private local/Vercel configuration, verify its project and least-privilege Firestore access, and configure Firestore TTL for `ttlExpiresAt`.
3. Measure storage and request costs and test the adapter's create-only, revision-CAS, TTL, concurrency and prior-run-preservation behavior against the deployed Firestore project.
4. Connect a permitted provider adapter to the acquisition-plan and ticker-stage APIs. Enforce provider approval at the worker boundary, resume from verified stages, and assemble/replay the final M3 artifact after all sample tickers have an explicit success or failure state.

Until these dependencies are met, M4 has not performed a new provider capture or written an M4 run. The M3 artifact remains the existing validation record; it has not been converted into a new persistent run.
