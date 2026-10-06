import type { ETFRecord, ETFScoreAssessment } from "./etfCatalog";

export type { ETFScoreAssessment, ETFScorecardKind } from "./etfCatalog";

export type ETFCoreScorecardFamily =
  | "equity-index"
  | "active-equity"
  | "dividend-equity"
  | "real-asset-equity"
  | "investment-grade-bonds"
  | "high-yield-em-bonds"
  | "preferred-securities"
  | "options-income"
  | "physical-metals"
  | "commodity-digital-futures"
  | "spot-digital-assets"
  | "multi-asset-allocation";

function methodologyState(state: "candidate" | "frozen"): "candidate" | "frozen" {
  return state;
}

export type ETFScoreHorizon = "1Y" | "3Y" | "5Y" | "60-session" | "252-session";
export type ETFScoreStatus =
  | "available"
  | "notApplicable"
  | "identityUnresolved"
  | "mandatePending"
  | "insufficientHistory"
  | "missingSource"
  | "staleInput"
  | "invalidInput"
  | "methodologyPending";

export type ETFCoreFamilySettings = {
  feeScale: number;
  spreadScale: number;
  growthAnchor: number;
  growthScale: number;
  drawdownScale: number;
  downsideScale: number;
  growthWeight: number;
  drawdownWeight: number;
  downsideWeight: number;
};

function coreSettings(
  feeScale: number,
  spreadScale: number,
  growthAnchor: number,
  growthScale: number,
  drawdownScale: number,
  downsideScale: number,
  weights: [number, number, number],
): ETFCoreFamilySettings {
  return {
    feeScale,
    spreadScale,
    growthAnchor,
    growthScale,
    drawdownScale,
    downsideScale,
    growthWeight: weights[0],
    drawdownWeight: weights[1],
    downsideWeight: weights[2],
  };
}

/** Product-preference candidates from the score plan; keep candidate until sensitivity review is complete. */
export const ETF_CORE_SCORECARD_CANDIDATES: Record<ETFCoreScorecardFamily, ETFCoreFamilySettings> = {
  "equity-index": coreSettings(0.5, 10, 8, 4, 25, 15, [0.4, 0.35, 0.25]),
  "active-equity": coreSettings(0.75, 15, 8, 4, 25, 15, [0.4, 0.35, 0.25]),
  "dividend-equity": coreSettings(0.5, 10, 7, 4, 25, 15, [0.4, 0.35, 0.25]),
  "real-asset-equity": coreSettings(0.75, 15, 7, 4, 30, 18, [0.4, 0.35, 0.25]),
  "investment-grade-bonds": coreSettings(0.4, 10, 3, 2, 10, 6, [0.3, 0.4, 0.3]),
  "high-yield-em-bonds": coreSettings(0.6, 20, 5, 3, 20, 12, [0.3, 0.4, 0.3]),
  "preferred-securities": coreSettings(0.6, 20, 5, 3, 25, 15, [0.3, 0.4, 0.3]),
  "options-income": coreSettings(0.75, 20, 6, 4, 25, 15, [0.35, 0.4, 0.25]),
  "physical-metals": coreSettings(0.5, 15, 5, 5, 30, 20, [0.4, 0.35, 0.25]),
  "commodity-digital-futures": coreSettings(1, 25, 5, 6, 40, 25, [0.35, 0.4, 0.25]),
  "spot-digital-assets": coreSettings(0.75, 20, 8, 8, 60, 40, [0.35, 0.4, 0.25]),
  "multi-asset-allocation": coreSettings(0.6, 15, 5, 3, 20, 12, [0.35, 0.4, 0.25]),
};

/** 1Y and 3Y are separate ranking variants, each with a distinct candidate method ID. */
export const ETF_CORE_SCORECARD_VERSION_IDS = Object.fromEntries(
  Object.keys(ETF_CORE_SCORECARD_CANDIDATES).map((family) => [family, {
    "1Y": `${family}-core-1y-candidate-v1`,
    "3Y": `${family}-core-3y-candidate-v1`,
  }]),
) as Record<ETFCoreScorecardFamily, Record<"1Y" | "3Y", string>>;

export const ETF_COST_ONLY_SCORECARD_VERSION_IDS = Object.fromEntries(
  Object.keys(ETF_CORE_SCORECARD_CANDIDATES).map((family) => [family, `${family}-cost-trading-candidate-v1`]),
) as Record<ETFCoreScorecardFamily, string>;

/** Candidate curves stay non-publishable until provider and sensitivity review is complete. */
export const ETF_CORE_SCORECARD_METHODOLOGY_STATE = methodologyState("candidate");

export const ETF_FULL_SCORECARD_CANDIDATE = {
  id: "equity-index-full-candidate-v1",
  grandScoreWeights: { fundQuality: 0.6, historicalPerformance: 0.4 },
  historical: { growthAnchor: 8, growthScale: 4, drawdownScale: 25, consistencyScale: 5, feeScale: 0.5 },
  quality: { fee: 0.2, spread: 0.2, trackingDifference: 0.3, trackingError: 0.3, feeScale: 0.5, spreadScale: 10, trackingDifferenceScale: 0.25, trackingErrorScale: 0.5 },
} as const;
export const ETF_FULL_SCORECARD_METHODOLOGY_STATE = methodologyState("candidate");

export const ETF_EXECUTION_SCORECARD_CANDIDATE = {
  tacticalIds: {
    "60-session": "leveraged-tactical-execution-60-session-candidate-v1",
    "252-session": "leveraged-tactical-execution-252-session-candidate-v1",
  },
  etnIds: {
    "60-session": "etn-execution-60-session-candidate-v1",
    "252-session": "etn-execution-252-session-candidate-v1",
  },
  feeScale: 1,
  spreadScale: 25,
  dailyRmsGapScaleBps: 10,
} as const;
export const ETF_EXECUTION_SCORECARD_METHODOLOGY_STATE = methodologyState("candidate");

export type ETFRouteCandidate =
  | ETFCoreScorecardFamily
  | "equity-mandate-review"
  | "bond-family-review"
  | "tactical-leveraged"
  | "tactical-reset-review"
  | "etn-execution"
  | "excluded"
  | "unclassified";

export interface ETFMandateVerification {
  family: ETFCoreScorecardFamily | "tactical-leveraged" | "etn";
  evidenceSourceIds: string[];
  comparisonDimensions: Record<string, string>;
  comparisonDimensionSourceIds: Record<string, string[]>;
  reviewedAt: string;
  mandateEffectiveDate?: string | null;
  identityVerified: boolean;
}

export interface ETFScorecardRoute {
  candidate: ETFRouteCandidate;
  status: "readyForInputs" | "mandatePending" | "identityUnresolved" | "notApplicable";
  comparisonGroupId: string | null;
  evidenceSourceIds: string[];
  reason: string;
}

export const ETF_COMPARISON_GROUP_SCHEMA_VERSION = "etf-role-group-v1";

/** Required sourced exposure boundaries used to form compatible score rankings. */
export const ETF_COMPARISON_GROUP_REQUIREMENTS: Record<ETFCoreScorecardFamily | "tactical-leveraged" | "etn", string[]> = {
  "equity-index": ["geography", "exposure", "sizeStyle", "incomeObjective", "management", "currency", "hedging", "concentrationClass"],
  "active-equity": ["geography", "exposure", "sizeStyle", "incomeObjective", "management", "currency", "hedging", "concentrationClass"],
  "dividend-equity": ["geography", "dividendMandate", "sizeStyle", "management", "currency", "hedging"],
  "real-asset-equity": ["assetType", "geography", "management", "currency", "hedging"],
  "investment-grade-bonds": ["currency", "hedging", "issuerType", "creditQuality", "durationBucket", "rateType", "inflationLinkage"],
  "high-yield-em-bonds": ["currency", "hedging", "issuerType", "creditQuality", "durationBucket", "rateType", "region"],
  "preferred-securities": ["currency", "issuerConcentration", "subordination", "couponType", "region"],
  "options-income": ["underlyingExposure", "optionMandate", "optionCoverage", "optionTenor", "leverage", "distributionPolicy", "currency"],
  "physical-metals": ["metal", "backingModel", "custodyDisclosure", "currency"],
  "commodity-digital-futures": ["underlyingBasket", "direction", "rollMethod", "collateralConvention", "currency"],
  "spot-digital-assets": ["asset", "backingModel", "custodyDisclosure", "currency"],
  "multi-asset-allocation": ["allocationMix", "objective", "management", "currency", "hedging"],
  "tactical-leveraged": ["underlying", "leverage", "direction", "resetInterval", "currency", "valuationConvention"],
  etn: ["issuer", "series", "reference", "payoff", "resetInterval", "currency"],
};

export function buildETFComparisonGroupId(
  family: ETFCoreScorecardFamily | "tactical-leveraged" | "etn",
  dimensions: Record<string, string>,
): { groupId: string | null; missingDimensions: string[] } {
  const required = ETF_COMPARISON_GROUP_REQUIREMENTS[family];
  const normalized = Object.fromEntries(required.map((key) => [key, (dimensions[key] ?? "").trim().toLowerCase().replace(/\s+/g, " ")]));
  const missingDimensions = required.filter((key) => !normalized[key]);
  if (missingDimensions.length) return { groupId: null, missingDimensions };
  const groupId = `${ETF_COMPARISON_GROUP_SCHEMA_VERSION}:${family}:${required.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(normalized[key])}`).join(";")}`;
  return { groupId, missingDimensions: [] };
}

function defaultCandidate(record: Pick<ETFRecord, "kind" | "category" | "structure" | "strategy" | "identityWarning" | "badges" | "resetInterval" | "leverageTarget" | "name" | "exposure">): ETFRouteCandidate {
  if (record.kind === "excluded") return "excluded";

  // Legal form and reset behavior have routing priority over the exposure label.
  if (record.kind === "etn") return "etn-execution";
  if (record.identityWarning) {
    if (record.strategy === "leveraged" || record.leverageTarget || record.badges.some((badge) => badge === "Leveraged" || badge === "Inverse")) return "tactical-leveraged";
  }
  if (record.strategy === "leveraged" || record.leverageTarget || record.badges.some((badge) => badge === "Leveraged" || badge === "Inverse")) {
    return record.resetInterval === "daily" ? "tactical-leveraged" : "tactical-reset-review";
  }

  if (record.structure === "physical-metal-trust" || record.category === "Physical precious metals") return "physical-metals";
  if (record.category === "Digital asset futures") return "commodity-digital-futures";
  if (record.category === "Spot digital asset trusts" || record.structure === "spot-bitcoin-trust") return "spot-digital-assets";
  if (record.category === "Commodity futures") return "commodity-digital-futures";
  if (record.category === "Multi-asset allocation") return "multi-asset-allocation";
  if (record.category === "Options income and distribution strategies") return "options-income";
  if (record.category === "Dividend equities") return "dividend-equity";
  if (record.category === "Real estate and infrastructure equities") return "real-asset-equity";
  if (record.category === "Fixed income and preferred securities") {
    if (/\bpreferred\b/i.test(`${record.name} ${record.exposure}`)) return "preferred-securities";
    if (/high[- ]yield|emerging market/i.test(`${record.name} ${record.exposure}`)) return "high-yield-em-bonds";
    return "bond-family-review";
  }
  if (["US broad market and styles", "International and global equities", "Sector and thematic equities"].includes(record.category)) {
    return "equity-mandate-review";
  }
  if (record.strategy === "trust") return "unclassified";
  return "unclassified";
}

function familyCandidates(candidate: ETFRouteCandidate): Array<ETFMandateVerification["family"]> {
  if (candidate === "equity-mandate-review") return ["equity-index", "active-equity"];
  if (candidate === "bond-family-review") return ["investment-grade-bonds", "high-yield-em-bonds", "preferred-securities"];
  if (candidate === "etn-execution") return ["etn"];
  if (candidate === "excluded" || candidate === "unclassified" || candidate === "tactical-reset-review") return [];
  return [candidate];
}

export function routeETFFund(
  record: Pick<ETFRecord, "kind" | "category" | "structure" | "strategy" | "identityWarning" | "badges" | "resetInterval" | "leverageTarget" | "name" | "exposure">,
  verification?: ETFMandateVerification,
): ETFScorecardRoute {
  const candidate = defaultCandidate(record);
  if (candidate === "excluded") return { candidate, status: "notApplicable", comparisonGroupId: null, evidenceSourceIds: [], reason: "This catalogue record is explicitly excluded from ETF scorecards." };
  if (record.identityWarning || (verification && !verification.identityVerified)) {
    return { candidate, status: "identityUnresolved", comparisonGroupId: null, evidenceSourceIds: verification?.evidenceSourceIds ?? [], reason: record.identityWarning ?? "Instrument identity has not been verified against issuer evidence." };
  }
  if (candidate === "tactical-reset-review") return { candidate, status: "mandatePending", comparisonGroupId: null, evidenceSourceIds: [], reason: "This product does not have a verified daily reset. The current execution scorecard covers daily-reset mandates only." };
  if (candidate === "unclassified") return { candidate, status: "mandatePending", comparisonGroupId: null, evidenceSourceIds: [], reason: "A verified mandate and scorecard family are required before scoring." };
  if (!verification) return {
    candidate,
    status: "mandatePending",
    comparisonGroupId: null,
    evidenceSourceIds: [],
    reason: candidate === "equity-mandate-review"
      ? "Category is a research lead; verify active/passive mandate, exposure, currency, and comparison group."
      : candidate === "bond-family-review"
        ? "Verify preferred status, credit quality, duration, currency, and comparison group before selecting a bond scorecard."
        : "Verify this fund's current mandate, instrument identity, and comparison group from dated issuer evidence.",
  };
  if (!familyCandidates(candidate).includes(verification.family)) return {
    candidate,
    status: "mandatePending",
    comparisonGroupId: null,
    evidenceSourceIds: verification.evidenceSourceIds,
    reason: "Verified family does not match the catalogue routing candidate; review the classification before scoring.",
  };
  const group = buildETFComparisonGroupId(verification.family, verification.comparisonDimensions);
  const missingEvidence = ETF_COMPARISON_GROUP_REQUIREMENTS[verification.family].filter((dimension) => !(verification.comparisonDimensionSourceIds[dimension]?.length));
  if (!group.groupId || missingEvidence.length || verification.evidenceSourceIds.length === 0) return {
    candidate,
    status: "mandatePending",
    comparisonGroupId: null,
    evidenceSourceIds: [...verification.evidenceSourceIds, ...Object.values(verification.comparisonDimensionSourceIds).flat()],
    reason: !group.groupId
      ? `Verified comparison dimensions are missing: ${group.missingDimensions.join(", ")}.`
      : `Comparison dimensions need dated source evidence: ${missingEvidence.join(", ")}.`,
  };
  return {
    candidate,
    status: "readyForInputs",
    comparisonGroupId: group.groupId,
    evidenceSourceIds: [...new Set([...verification.evidenceSourceIds, ...Object.values(verification.comparisonDimensionSourceIds).flat()])],
    reason: "Mandate routing is verified; score input readiness is assessed separately.",
  };
}

export function isTacticalETF(record: Pick<ETFRecord, "kind" | "category" | "structure" | "strategy" | "identityWarning" | "badges" | "resetInterval" | "leverageTarget" | "name" | "exposure">): boolean {
  return defaultCandidate(record) === "tactical-leveraged";
}

export function primaryETFScoreAssessment(snapshot?: { scoreAssessments?: ETFScoreAssessment[] }, tactical = false): ETFScoreAssessment | null {
  const assessments = snapshot?.scoreAssessments ?? [];
  const ordered = tactical
    ? [assessments.find((item) => item.kind === "tactical"), assessments.find((item) => item.kind === "cost-only")]
    : [
      assessments.find((item) => item.kind === "core" && item.horizon === "3Y"),
      assessments.find((item) => item.kind === "core" && item.horizon === "1Y"),
      assessments.find((item) => item.kind === "cost-only"),
    ];
  return ordered.find((item) => item?.status === "available" && typeof item.score === "number" && Number.isFinite(item.score))
    ?? ordered.find((item) => item != null)
    ?? null;
}
