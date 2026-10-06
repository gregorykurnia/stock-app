# Research validation — 2026-10-06

Documentation/data changes only; no ETF page or application behavior was changed.

Passed checks:

- All 22 ETF pages report 212 entries; page sizes reconcile to 212 unique IDs/tickers.
- All 103 US-market pages report 1,024 entries; page sizes reconcile to 1,024 unique IDs/tickers.
- The complete public-profile security-type census covers the exact same 1,024 IDs: 222 ETF labels and 802 stock labels.
- The research universe contains exactly those 222 ETF-labeled IDs, with 216 retained ETF/ETF-like candidates, three separate ETNs, and three explicit exclusions.
- All 222 candidates have a retained profile snapshot, exposure classification, issuer source locator, and explicit catalogue-listed/account-eligibility-unchecked status.
- All 222 discoveries appear in the Markdown inventory with an exact Pluang asset-ID link.
- All local links in the research report and updated page plan resolve.
- Uncollected historical statistics retain explicit missing states; issuer candidate observations are not labeled production-validated.
- Evidence JSON parses and its SHA-256 hashes match the audit manifest. Consolidated snapshots preserve 22 ETF-page responses, 103 US-page responses, and 222 relevant profile responses.
- `git diff --check` passes.

These checks validate enumeration, reconciliation, document coverage, and evidence integrity. They do not validate account tradability, FLOT identity, FNGU series continuity, the candidate financial observations, or historical return/distribution/risk calculations. Those open gates are documented in both the research report and page plan.
