export type ETFM4PermissionStatus = "approved" | "blocked" | "unresolved";

export interface ETFM4DataUsePolicy {
  schemaVersion: 1;
  targetDeployment: "personal-use";
  reviewedAt: string | null;
  reviewRecord: string | null;
  retentionDays: number | null;
  permissions: {
    yahooProviderRequests: ETFM4PermissionStatus;
    rawAdjustedCloseRetention: ETFM4PermissionStatus;
    derivedScoreRetention: ETFM4PermissionStatus;
    issuerReturnEvidenceRetention: ETFM4PermissionStatus;
    issuerProviderRequests: ETFM4PermissionStatus;
  };
}

export interface ETFM4PolicyAssessment {
  ready: boolean;
  issues: string[];
}

const RETAINED_DATA_PERMISSIONS = [
  ["rawAdjustedCloseRetention", "raw Yahoo adjusted-close retention"],
  ["derivedScoreRetention", "derived-score retention"],
  ["issuerReturnEvidenceRetention", "issuer return-evidence retention"],
] as const;
const ALL_PERMISSION_KEYS = [
  "yahooProviderRequests",
  "rawAdjustedCloseRetention",
  "derivedScoreRetention",
  "issuerReturnEvidenceRetention",
  "issuerProviderRequests",
] as const;
const PERMISSION_STATUSES = ["approved", "blocked", "unresolved"] as const;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function assessETFEquityIndexM4RetentionPolicy(
  policy: unknown,
  now = new Date(),
): ETFM4PolicyAssessment {
  const issues: string[] = [];
  if (!record(policy)) return { ready: false, issues: ["The M4 data-use policy must be a JSON object."] };
  if (policy.schemaVersion !== 1) issues.push("The M4 data-use policy schemaVersion must be 1.");
  if (policy.targetDeployment !== "personal-use") issues.push("The M4 policy must identify the personal-use deployment.");

  const permissions = policy.permissions;
  if (!record(permissions)) {
    issues.push("The M4 policy is missing its permissions object.");
  } else {
    for (const key of ALL_PERMISSION_KEYS) {
      if (!PERMISSION_STATUSES.includes(permissions[key] as ETFM4PermissionStatus)) {
        issues.push(`${key} must be approved, blocked or unresolved.`);
      }
    }
    for (const [key, label] of RETAINED_DATA_PERMISSIONS) {
      if (permissions[key] !== "approved") issues.push(`${label} is ${String(permissions[key] ?? "missing")}.`);
    }
  }

  if (!validTimestamp(policy.reviewedAt)) {
    issues.push("A UTC reviewedAt timestamp is required before retained data can be written.");
  } else if (Date.parse(policy.reviewedAt) > now.getTime()) {
    issues.push("The M4 policy review timestamp is in the future.");
  }
  if (typeof policy.reviewRecord !== "string" || policy.reviewRecord.trim().length === 0) {
    issues.push("A reviewRecord link or identifier is required before retained data can be written.");
  }
  if (!Number.isInteger(policy.retentionDays) || (policy.retentionDays as number) < 1 || (policy.retentionDays as number) > 3650) {
    issues.push("retentionDays must be an integer from 1 through 3650.");
  }

  return { ready: issues.length === 0, issues };
}

export function assertETFEquityIndexM4RetentionAllowed(policy: unknown, now = new Date()): void {
  const assessment = assessETFEquityIndexM4RetentionPolicy(policy, now);
  if (!assessment.ready) throw new Error(`ETF M4 retention is blocked: ${assessment.issues.join(" ")}`);
}

export function assertETFEquityIndexM4YahooAcquisitionAllowed(policy: unknown, now = new Date()): void {
  assertETFEquityIndexM4RetentionAllowed(policy, now);
  if (!record(policy) || !record(policy.permissions) || policy.permissions.yahooProviderRequests !== "approved") {
    throw new Error("ETF M4 Yahoo acquisition is blocked: Yahoo provider requests are not approved in the reviewed data-use policy.");
  }
}

export function assertETFEquityIndexM4IssuerAcquisitionAllowed(policy: unknown, now = new Date()): void {
  assertETFEquityIndexM4RetentionAllowed(policy, now);
  if (!record(policy) || !record(policy.permissions) || policy.permissions.issuerProviderRequests !== "approved") {
    throw new Error("ETF M4 issuer acquisition is blocked: issuer-provider requests are not approved in the reviewed data-use policy.");
  }
}
