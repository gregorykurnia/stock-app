export const MONTHLY_PETTY_CASH = 2_500_000;
export const VOO_ALLOCATION = 0.6;
export const VXUS_ALLOCATION = 0.4;

export interface PersonalFinanceMonthInput {
  month: string;
  income: number;
  creditCardPayment: number;
  futurePlanningInstallments: number;
  actualMonthlySpending: number | null;
}

export interface PersonalFinanceComputedRow extends PersonalFinanceMonthInput {
  carryoverApplied: number;
  plannedDeductions: number;
  remainder: number;
  dcaBase: number;
  vooRecommendation: number;
  vxusRecommendation: number;
  deficitCarryover: number;
}

function assertWholeNonNegativeRupiah(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a whole non-negative rupiah value`);
  }
}

function assertValidMonth(month: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("month must use YYYY-MM format");
  }
}

export function validatePersonalFinanceMonth(input: PersonalFinanceMonthInput): void {
  assertValidMonth(input.month);
  assertWholeNonNegativeRupiah(input.income, "income");
  assertWholeNonNegativeRupiah(input.creditCardPayment, "creditCardPayment");
  assertWholeNonNegativeRupiah(input.futurePlanningInstallments, "futurePlanningInstallments");
  if (input.actualMonthlySpending !== null) {
    assertWholeNonNegativeRupiah(input.actualMonthlySpending, "actualMonthlySpending");
  }
}

export function calculatePersonalFinanceRows(
  inputs: readonly PersonalFinanceMonthInput[],
): PersonalFinanceComputedRow[] {
  const ordered = [...inputs].sort((a, b) => a.month.localeCompare(b.month));
  const seenMonths = new Set<string>();
  let deficitCarryover = 0;

  return ordered.map((input) => {
    validatePersonalFinanceMonth(input);
    if (seenMonths.has(input.month)) {
      throw new Error(`month ${input.month} is duplicated`);
    }
    seenMonths.add(input.month);

    const carryoverApplied = deficitCarryover;
    const plannedDeductions = input.creditCardPayment + input.futurePlanningInstallments + MONTHLY_PETTY_CASH;
    const remainder = input.income - carryoverApplied - plannedDeductions;
    const dcaBase = Math.max(remainder, 0);
    const vooRecommendation = Math.round(dcaBase * VOO_ALLOCATION);
    const vxusRecommendation = dcaBase - vooRecommendation;
    deficitCarryover = Math.max(-remainder, 0);

    return {
      ...input,
      carryoverApplied,
      plannedDeductions,
      remainder,
      dcaBase,
      vooRecommendation,
      vxusRecommendation,
      deficitCarryover,
    };
  });
}

export function formatIdr(value: number): string {
  return `Rp${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}
