import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifestPath = join(root, "data", "etf-equity-index-m3-sample-v1.json");
const digestPath = join(root, "data", "etf-equity-index-m3-sample-v1.sha256");
const freezeRequested = process.argv.includes("--freeze");
const bytes = readFileSync(manifestPath);
const manifest = JSON.parse(bytes.toString("utf8"));
const errors = [];

function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const allowedDomains = new Map([
  ["State Street Investment Management", "www.ssga.com"],
  ["Charles Schwab Investment Management", "www.schwabassetmanagement.com"],
  ["BlackRock / iShares", "www.ishares.com"],
  ["The Vanguard Group", "advisors.vanguard.com"],
]);
const requiredStrata = ["us-broad-equity", "developed-ex-us-equity", "broad-international-ex-us-equity"];
const excluded = new Set(["VOO", "VTI", "IVV", "ITOT", "SCHB", "VXUS", "VEA", "IXUS"]);
const isoCapture = Date.parse(manifest.frozenAt);
const captureDate = Number.isFinite(isoCapture) ? new Date(isoCapture).toISOString().slice(0, 10) : "";

if (manifest.schemaVersion !== 1 || manifest.sampleId !== "equity-index-m3-sample-v1") errors.push("Unsupported sample manifest identity or schema version.");
if (!isDate(manifest.selectionDate) || !captureDate || captureDate !== manifest.selectionDate) errors.push("The freeze timestamp must be valid and fall on the recorded selection date.");
if (manifest.frozenBeforePriceAcquisition !== true) errors.push("The manifest does not declare that it was frozen before price acquisition.");
if (!Array.isArray(manifest.issuerDomainReviews) || manifest.issuerDomainReviews.length < 3) errors.push("At least three explicit issuer-domain reviews are required.");

const domainReviewByIssuer = new Map((manifest.issuerDomainReviews ?? []).map((entry) => [entry.issuer, entry]));
for (const review of manifest.issuerDomainReviews ?? []) {
  if (allowedDomains.get(review.issuer) !== review.domain || !isDate(review.reviewedAt) || review.reviewedAt > manifest.selectionDate) {
    errors.push(`Issuer domain review is missing, invalid or not dated by selection for ${review.issuer}.`);
  }
}

const funds = Array.isArray(manifest.funds) ? manifest.funds : [];
const tickers = funds.map((fund) => fund.ticker);
if (funds.length < 12 || new Set(tickers).size !== funds.length) errors.push("The sample must contain at least 12 funds with unique tickers.");
if (tickers.some((ticker) => excluded.has(ticker))) errors.push("The sample overlaps an M1 ticker that must be excluded.");
if (manifest.excludedM1Tickers?.join(",") !== [...excluded].join(",")) errors.push("The manifest's M1 exclusion list does not match the frozen protocol.");
if (new Set(funds.map((fund) => fund.issuer)).size < 3) errors.push("The sample must span at least three issuers.");

for (const stratum of requiredStrata) {
  const count = funds.filter((fund) => fund.exposureStratum === stratum).length;
  if (count < 4) errors.push(`${stratum} has ${count} funds; at least four are required.`);
}

for (const fund of funds) {
  const expectedDomain = allowedDomains.get(fund.issuer);
  const review = domainReviewByIssuer.get(fund.issuer);
  if (!expectedDomain || fund.issuerDomain !== expectedDomain || review?.domain !== expectedDomain || !review?.reviewedFunds?.includes(fund.ticker)) {
    errors.push(`${fund.ticker} does not match its reviewed issuer domain.`);
  }
  for (const key of ["identitySourceUrl", "mandateSourceUrl"]) {
    try {
      const parsed = new URL(fund[key]);
      if (parsed.protocol !== "https:" || parsed.hostname !== expectedDomain) errors.push(`${fund.ticker} ${key} is not HTTPS on its reviewed issuer domain.`);
    } catch { errors.push(`${fund.ticker} ${key} is invalid.`); }
  }
  const fee = fund.expenseRatio;
  if (!fund.name || !fund.indexName || !fund.inclusionRationale || !isDate(fund.knownInceptionDate) || !isDate(fund.selectionDate)) {
    errors.push(`${fund.ticker} is missing a required identity, mandate, rationale or date field.`);
  }
  if (!fee || !Number.isFinite(fee.valuePct) || fee.valuePct < 0 || fee.designation !== "net" || !isDate(fee.financialDate)
    || fee.financialDate > manifest.selectionDate || manifest.selectionDate < fee.financialDate
    || (Date.parse(`${manifest.selectionDate}T00:00:00Z`) - Date.parse(`${fee.financialDate}T00:00:00Z`)) / 86_400_000 > 365
    || !fee.waiverStatus?.trim()) {
    errors.push(`${fund.ticker} has missing, gross-only, stale or undated net-fee evidence.`);
  }
  try {
    const parsed = new URL(fee.sourceUrl);
    if (parsed.protocol !== "https:" || parsed.hostname !== expectedDomain) errors.push(`${fund.ticker} fee source is not HTTPS on its reviewed issuer domain.`);
  } catch { errors.push(`${fund.ticker} fee source URL is invalid.`); }
  if (fee?.waiverExpiryDate && (!isDate(fee.waiverExpiryDate) || fee.waiverExpiryDate < manifest.selectionDate)) {
    errors.push(`${fund.ticker} has an expired or invalid fee waiver.`);
  }
}

const groupById = new Map((manifest.comparisonGroups ?? []).map((group) => [group.id, group]));
for (const group of manifest.comparisonGroups ?? []) {
  if (!group.id || !group.basis || !Array.isArray(group.tickers) || group.tickers.length < 2
    || group.tickers.some((ticker) => !tickers.includes(ticker))) errors.push(`Comparison group ${group.id ?? "(missing id)"} is incomplete or refers to an unregistered ticker.`);
}
for (const fund of funds) {
  if (fund.comparisonGroupId === "unranked-pending-peer") continue;
  const group = groupById.get(fund.comparisonGroupId);
  if (!group?.tickers.includes(fund.ticker)) errors.push(`${fund.ticker} has no matching preregistered comparison group.`);
}

if (errors.length) {
  console.error(JSON.stringify({ valid: false, errors }, null, 2));
  process.exitCode = 1;
} else {
  const digest = createHash("sha256").update(bytes).digest("hex");
  const expectedSidecar = `${digest}  etf-equity-index-m3-sample-v1.json\n`;
  if (freezeRequested) {
    try {
      readFileSync(digestPath);
      console.error("The sample already has a SHA-256 sidecar; it is frozen and cannot be replaced by this command.");
      process.exitCode = 1;
    } catch {
      writeFileSync(digestPath, expectedSidecar, { flag: "wx" });
      console.log(JSON.stringify({ valid: true, frozen: true, sha256: digest, funds: funds.length, issuers: new Set(funds.map((fund) => fund.issuer)).size }, null, 2));
    }
  } else {
    let sidecar;
    try { sidecar = readFileSync(digestPath, "utf8"); }
    catch {
      console.error("The sample SHA-256 sidecar is missing; freeze the manifest before acquiring histories.");
      process.exitCode = 1;
    }
    if (sidecar && sidecar !== expectedSidecar) {
      console.error("The sample manifest does not match its frozen SHA-256 sidecar.");
      process.exitCode = 1;
    } else if (sidecar) {
      console.log(JSON.stringify({ valid: true, frozen: true, sha256: digest, funds: funds.length, issuers: new Set(funds.map((fund) => fund.issuer)).size }, null, 2));
    }
  }
}
