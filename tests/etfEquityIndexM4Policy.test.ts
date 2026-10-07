import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  assessETFEquityIndexM4RetentionPolicy,
  assertETFEquityIndexM4IssuerAcquisitionAllowed,
  assertETFEquityIndexM4RetentionAllowed,
  assertETFEquityIndexM4YahooAcquisitionAllowed,
  type ETFM4DataUsePolicy,
} from "../lib/etfEquityIndexM4Policy";

const policyPath = join(process.cwd(), "data", "etf-scoring-data-use-policy.json");
const currentPolicy = JSON.parse(readFileSync(policyPath, "utf8"));
const now = new Date("2026-10-07T12:00:00.000Z");

function approvedPolicy(): ETFM4DataUsePolicy {
  return {
    schemaVersion: 1,
    targetDeployment: "personal-use",
    reviewedAt: "2026-10-07T11:00:00.000Z",
    reviewRecord: "review-2026-10-07",
    retentionDays: 365,
    permissions: {
      yahooProviderRequests: "approved",
      rawAdjustedCloseRetention: "approved",
      derivedScoreRetention: "approved",
      issuerReturnEvidenceRetention: "approved",
      issuerProviderRequests: "unresolved",
    },
  };
}

test("conservative checked-in policy blocks requests and retention pending rights review", () => {
  assert.equal(currentPolicy.retentionDays, 365);
  assert.equal(currentPolicy.permissions.yahooProviderRequests, "blocked");
  assert.equal(currentPolicy.permissions.issuerProviderRequests, "blocked");
  assert.equal(currentPolicy.permissions.rawAdjustedCloseRetention, "unresolved");
  assert.equal(currentPolicy.permissions.derivedScoreRetention, "unresolved");
  assert.equal(currentPolicy.permissions.issuerReturnEvidenceRetention, "unresolved");
  const assessment = assessETFEquityIndexM4RetentionPolicy(currentPolicy, now);
  assert.equal(assessment.ready, false);
  assert.throws(() => assertETFEquityIndexM4RetentionAllowed(currentPolicy, now), /retention is blocked/);
  assert.throws(() => assertETFEquityIndexM4YahooAcquisitionAllowed(currentPolicy, now), /retention is blocked/);
});

test("reviewed policy with bounded retention permits the declared data categories", () => {
  const policy = approvedPolicy();
  assert.equal(assessETFEquityIndexM4RetentionPolicy(policy, now).ready, true);
  assert.doesNotThrow(() => assertETFEquityIndexM4RetentionAllowed(policy, now));
  assert.doesNotThrow(() => assertETFEquityIndexM4YahooAcquisitionAllowed(policy, now));
});

test("issuer requests remain separately blocked unless approved", () => {
  const policy = approvedPolicy();
  assert.throws(() => assertETFEquityIndexM4IssuerAcquisitionAllowed(policy, now), /issuer-provider requests are not approved/);
  policy.permissions.issuerProviderRequests = "approved";
  assert.doesNotThrow(() => assertETFEquityIndexM4IssuerAcquisitionAllowed(policy, now));
});

test("retention approval requires a review record, timestamp, and bounded retention period", () => {
  const policy = approvedPolicy();
  policy.reviewedAt = null;
  policy.reviewRecord = " ";
  policy.retentionDays = 0;
  const assessment = assessETFEquityIndexM4RetentionPolicy(policy, now);
  assert.equal(assessment.ready, false);
  assert.match(assessment.issues.join(" "), /reviewedAt/);
  assert.match(assessment.issues.join(" "), /reviewRecord/);
  assert.match(assessment.issues.join(" "), /retentionDays/);
});

test("Yahoo requests remain blocked unless separately approved", () => {
  const policy = approvedPolicy();
  policy.permissions.yahooProviderRequests = "unresolved";
  assert.doesNotThrow(() => assertETFEquityIndexM4RetentionAllowed(policy, now));
  assert.throws(() => assertETFEquityIndexM4YahooAcquisitionAllowed(policy, now), /requests are not approved/);
});

test("future-dated policy review is rejected", () => {
  const policy = approvedPolicy();
  policy.reviewedAt = "2026-10-08T00:00:00.000Z";
  assert.equal(assessETFEquityIndexM4RetentionPolicy(policy, now).ready, false);
});
