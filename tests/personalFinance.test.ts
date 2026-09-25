import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePersonalFinanceRows,
  formatIdr,
  MONTHLY_PETTY_CASH,
  validatePersonalFinanceMonth,
  type PersonalFinanceMonthInput,
} from "../lib/personalFinance";

function month(month: string, overrides: Partial<PersonalFinanceMonthInput> = {}): PersonalFinanceMonthInput {
  return {
    month,
    income: 20_000_000,
    creditCardPayment: 5_000_000,
    futurePlanningInstallments: 4_000_000,
    actualMonthlySpending: null,
    ...overrides,
  };
}

test("positive remainder uses the fixed petty cash deduction and a 60/40 VXUS/VOO DCA split", () => {
  const [row] = calculatePersonalFinanceRows([month("2026-01")]);
  assert.equal(row.plannedDeductions, 11_500_000);
  assert.equal(row.remainder, 8_500_000);
  assert.equal(row.vxusRecommendation, 5_100_000);
  assert.equal(row.vooRecommendation, 3_400_000);
  assert.equal(row.vooRecommendation + row.vxusRecommendation, row.dcaBase);
  assert.equal(row.deficitCarryover, 0);
});

test("an exact zero remainder has no DCA recommendation", () => {
  const [row] = calculatePersonalFinanceRows([month("2026-01", { income: 11_500_000 })]);
  assert.equal(row.remainder, 0);
  assert.equal(row.vooRecommendation, 0);
  assert.equal(row.vxusRecommendation, 0);
});

test("a negative remainder carries its deficit and has zero DCA", () => {
  const [row] = calculatePersonalFinanceRows([month("2026-01", { income: 8_000_000, creditCardPayment: 4_000_000, futurePlanningInstallments: 3_000_000 })]);
  assert.equal(row.remainder, -1_500_000);
  assert.equal(row.vooRecommendation, 0);
  assert.equal(row.vxusRecommendation, 0);
  assert.equal(row.deficitCarryover, 1_500_000);
});

test("carryover is applied before the next month's deductions", () => {
  const rows = calculatePersonalFinanceRows([
    month("2026-01", { income: 8_000_000, creditCardPayment: 4_000_000, futurePlanningInstallments: 3_000_000 }),
    month("2026-02", { income: 20_000_000, creditCardPayment: 5_000_000, futurePlanningInstallments: 4_000_000 }),
  ]);
  assert.equal(rows[1].carryoverApplied, 1_500_000);
  assert.equal(rows[1].remainder, 7_000_000);
  assert.equal(rows[1].vxusRecommendation, 4_200_000);
  assert.equal(rows[1].vooRecommendation, 2_800_000);
});

test("multiple consecutive deficits accumulate through each recorded month", () => {
  const rows = calculatePersonalFinanceRows([
    month("2026-01", { income: 8_000_000, creditCardPayment: 4_000_000, futurePlanningInstallments: 3_000_000 }),
    month("2026-02", { income: 5_000_000, creditCardPayment: 1_000_000, futurePlanningInstallments: 1_000_000 }),
    month("2026-03", { income: 20_000_000, creditCardPayment: 5_000_000, futurePlanningInstallments: 4_000_000 }),
  ]);
  assert.equal(rows[1].carryoverApplied, 1_500_000);
  assert.equal(rows[1].remainder, -1_000_000);
  assert.equal(rows[1].deficitCarryover, 1_000_000);
  assert.equal(rows[2].carryoverApplied, 1_000_000);
  assert.equal(rows[2].remainder, 7_500_000);
});

test("a skipped month preserves the outstanding deficit until the next recorded month", () => {
  const rows = calculatePersonalFinanceRows([
    month("2026-01", { income: 8_000_000, creditCardPayment: 4_000_000, futurePlanningInstallments: 3_000_000 }),
    month("2026-03", { income: 20_000_000, creditCardPayment: 5_000_000, futurePlanningInstallments: 4_000_000 }),
  ]);
  assert.deepEqual(rows.map((row) => row.month), ["2026-01", "2026-03"]);
  assert.equal(rows[1].carryoverApplied, 1_500_000);
});

test("whole-rupiah rounding keeps all DCA recommendations balanced", () => {
  const [row] = calculatePersonalFinanceRows([month("2026-01", {
    income: MONTHLY_PETTY_CASH + 1,
    creditCardPayment: 0,
    futurePlanningInstallments: 0,
  })]);
  assert.equal(row.dcaBase, 1);
  assert.equal(row.vooRecommendation, 0);
  assert.equal(row.vxusRecommendation, 1);
  assert.equal(row.vooRecommendation + row.vxusRecommendation, row.dcaBase);
});

test("changing Actual Monthly Spending does not change calculations", () => {
  const withoutSpending = calculatePersonalFinanceRows([month("2026-01", { actualMonthlySpending: null })])[0];
  const withSpending = calculatePersonalFinanceRows([month("2026-01", { actualMonthlySpending: 18_000_000 })])[0];
  assert.deepEqual(
    { remainder: withSpending.remainder, carryover: withSpending.deficitCarryover, voo: withSpending.vooRecommendation, vxus: withSpending.vxusRecommendation },
    { remainder: withoutSpending.remainder, carryover: withoutSpending.deficitCarryover, voo: withoutSpending.vooRecommendation, vxus: withoutSpending.vxusRecommendation },
  );
});

test("validation rejects malformed months and non-whole or negative rupiah values", () => {
  assert.throws(() => validatePersonalFinanceMonth(month("2026-13")), /YYYY-MM/);
  assert.throws(() => validatePersonalFinanceMonth(month("2026-01", { income: -1 })), /income/);
  assert.throws(() => validatePersonalFinanceMonth(month("2026-01", { income: 1.5 })), /income/);
});

test("IDR formatting uses Indonesian separators without decimal places", () => {
  assert.equal(formatIdr(2_500_000), "Rp2.500.000");
});
