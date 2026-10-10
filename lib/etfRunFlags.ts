import type { EligibilityState } from "./etfRanking";

// Labels for the stored-run builder (docs/etf-ranking/phase3-open-items-2026-10-10.md, item 3).
// Flags never feed the scoring function. The builder attaches them after rankFunds has run.

export const FLAG_LEGAL_FORM_NOT_RECORDED = "Legal form not recorded";
export const FLAG_FEE_OLDER_THAN_12_MONTHS = "Fee older than 12 months";
export const FLAG_VOLUME_NOT_VERIFIED = "Volume not verified as consolidated";

// Owner decision (2026-10-10): the volume check compared Tiingo with a public source. Tiingo was never below it,
// but the 2–3% test was not met on every session. Consolidation is not verified, so every stored run carries the label.
// Set to true only after the consolidation question is closed.
export const VOLUME_CONSOLIDATION_VERIFIED = false;

const FEE_MAX_AGE_MONTHS = 12;

// Fee dates strictly before this date are older than 12 months at the cutoff. Cutoffs are month-ends, so a
// same-day-minus-one-year date always exists (no 29 February cutoff).
export function feeStaleBefore(cutoff: string): string {
  const year = Number(cutoff.slice(0, 4)) - FEE_MAX_AGE_MONTHS / 12;
  return `${year}${cutoff.slice(4)}`;
}

export interface RunFlagInput {
  state: EligibilityState;
  legalFormVerified: boolean;
  feeAsOf: string | null;
  cutoff: string;
}

export function runFlagsFor(input: RunFlagInput): string[] {
  const flags: string[] = [];
  if (input.state === "Ranked" && !input.legalFormVerified) flags.push(FLAG_LEGAL_FORM_NOT_RECORDED);
  if (input.feeAsOf && input.feeAsOf < feeStaleBefore(input.cutoff)) flags.push(FLAG_FEE_OLDER_THAN_12_MONTHS);
  if (!VOLUME_CONSOLIDATION_VERIFIED) flags.push(FLAG_VOLUME_NOT_VERIFIED);
  return flags;
}
