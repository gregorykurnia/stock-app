"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculatePersonalFinanceRows,
  formatIdr,
  MONTHLY_PETTY_CASH,
  validatePersonalFinanceMonth,
  type PersonalFinanceComputedRow,
  type PersonalFinanceMonthInput,
} from "@/lib/personalFinance";
import {
  getPersonalFinanceMonths,
  removePersonalFinanceMonth,
  savePersonalFinanceMonth,
  type PersonalFinanceMonthRecord,
} from "@/lib/firestore";

type RupiahInput = number | "";

interface FinanceForm {
  month: string;
  income: RupiahInput;
  creditCardPayment: RupiahInput;
  futurePlanningInstallments: RupiahInput;
  actualMonthlySpending: RupiahInput;
}

const EMPTY_FORM: FinanceForm = {
  month: "",
  income: "",
  creditCardPayment: "",
  futurePlanningInstallments: "",
  actualMonthlySpending: "",
};

const PERSONAL_FINANCE_LOAD_TIMEOUT_MS = 15_000;

function formToInput(form: FinanceForm): PersonalFinanceMonthInput {
  const input: PersonalFinanceMonthInput = {
    month: form.month,
    income: form.income === "" ? -1 : form.income,
    creditCardPayment: form.creditCardPayment === "" ? -1 : form.creditCardPayment,
    futurePlanningInstallments: form.futurePlanningInstallments === "" ? -1 : form.futurePlanningInstallments,
    actualMonthlySpending: form.actualMonthlySpending === "" ? null : form.actualMonthlySpending,
  };
  validatePersonalFinanceMonth(input);
  return input;
}

function recordToForm(record: PersonalFinanceMonthRecord): FinanceForm {
  return {
    month: record.month,
    income: record.income,
    creditCardPayment: record.creditCardPayment,
    futurePlanningInstallments: record.futurePlanningInstallments,
    actualMonthlySpending: record.actualMonthlySpending ?? "",
  };
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  const date = new Date(Date.UTC(Number(year), Number(monthNumber) - 1, 1));
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function statusFor(row: PersonalFinanceComputedRow): { label: string; classes: string } {
  if (row.remainder < 0) return { label: "Deficit carried forward", classes: "bg-red-50 text-red-700" };
  if (row.remainder === 0) return { label: "Balanced", classes: "bg-gray-100 text-gray-600" };
  return { label: "DCA available", classes: "bg-green-50 text-green-700" };
}

function numberInputValue(value: RupiahInput): string | number {
  return value === "" ? "" : value;
}

export default function PersonalFinanceDashboard() {
  const [records, setRecords] = useState<PersonalFinanceMonthRecord[]>([]);
  const [form, setForm] = useState<FinanceForm>(EMPTY_FORM);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingMonth, setDeletingMonth] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      setError("Personal finance history could not be loaded before the request timed out. Check Firestore access and try again.");
      setLoading(false);
    }, PERSONAL_FINANCE_LOAD_TIMEOUT_MS);
    getPersonalFinanceMonths()
      .then((data) => {
        if (!active) return;
        setRecords(data);
        setSelectedMonth((current) => current ?? data.at(-1)?.month ?? null);
        setError("");
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load personal finance history");
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (active) setLoading(false);
      });
    return () => { active = false; window.clearTimeout(timeoutId); };
  }, [reloadToken]);

  const computedRows = useMemo(() => calculatePersonalFinanceRows(records), [records]);
  const selectedRow = useMemo(
    () => computedRows.find((row) => row.month === selectedMonth) ?? computedRows.at(-1) ?? null,
    [computedRows, selectedMonth],
  );
  const historyRows = useMemo(() => [...computedRows].reverse(), [computedRows]);

  function updateForm(field: keyof FinanceForm, value: string) {
    setForm((current) => ({ ...current, [field]: field === "month" ? value : value === "" ? "" : Number(value) }));
  }

  function startNewMonth() {
    setForm(EMPTY_FORM);
    setEditingMonth(null);
    setNotice("");
    setError("");
  }

  function startEditing(record: PersonalFinanceMonthRecord) {
    setForm(recordToForm(record));
    setEditingMonth(record.month);
    setSelectedMonth(record.month);
    setNotice("");
    setError("");
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const wasEditing = editingMonth !== null;
    try {
      const input = formToInput(form);
      const existing = records.find((record) => record.month === input.month);
      if (editingMonth !== null && editingMonth !== input.month) {
        throw new Error("The month cannot be changed while editing a record");
      }
      const saved = await savePersonalFinanceMonth(input, existing?.createdAt);
      const nextRecords = [...records.filter((record) => record.month !== saved.month), saved]
        .sort((a, b) => a.month.localeCompare(b.month));
      setRecords(nextRecords);
      setSelectedMonth(saved.month);
      setEditingMonth(saved.month);
      setForm(recordToForm(saved));
      setNotice(`${wasEditing ? "Updated" : "Saved"} ${formatMonth(saved.month)}. Downstream calculations were refreshed.`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Could not save this month");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record: PersonalFinanceMonthRecord) {
    if (!window.confirm(`Delete the ${formatMonth(record.month)} record?`)) return;
    setDeletingMonth(record.month);
    setError("");
    setNotice("");
    try {
      await removePersonalFinanceMonth(record.month);
      const nextRecords = records.filter((item) => item.month !== record.month);
      setRecords(nextRecords);
      setSelectedMonth((current) => current === record.month ? nextRecords.at(-1)?.month ?? null : current);
      if (editingMonth === record.month) {
        setForm(EMPTY_FORM);
        setEditingMonth(null);
      }
      setNotice(`Deleted ${formatMonth(record.month)}. Downstream calculations were refreshed.`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Could not delete this month");
    } finally {
      setDeletingMonth(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="surface-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Personal Finance</h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted)]">
              Record monthly income and planned deductions to estimate guidance for VOO and VXUS DCA. Recommendations are guidance only; no investments are executed.
            </p>
          </div>
          <span className="badge bg-[var(--accent-soft)] text-[var(--accent-soft-text)]">IDR</span>
        </div>
        {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{error}</div>}
        {notice && <div role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-xs leading-5 text-green-800">{notice}</div>}
      </section>

      <section className="surface-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{editingMonth ? `Edit ${formatMonth(editingMonth)}` : "Add monthly record"}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Use whole rupiah amounts. Blank Actual Monthly Spending is kept as null.</p>
          </div>
          {editingMonth && <button type="button" className="btn btn-ghost" onClick={startNewMonth}>New month</button>}
        </div>
        <form className="mt-4 space-y-4" onSubmit={handleSave}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label>
              <span className="field-label">Month</span>
              <input className="input-field w-full" type="month" value={form.month} onChange={(event) => updateForm("month", event.target.value)} disabled={editingMonth !== null} required />
            </label>
            <label>
              <span className="field-label">Income</span>
              <input className="input-field w-full" type="number" min="0" step="1" inputMode="numeric" value={numberInputValue(form.income)} onChange={(event) => updateForm("income", event.target.value)} required />
            </label>
            <label>
              <span className="field-label">Credit Card Payment</span>
              <input className="input-field w-full" type="number" min="0" step="1" inputMode="numeric" value={numberInputValue(form.creditCardPayment)} onChange={(event) => updateForm("creditCardPayment", event.target.value)} required />
            </label>
            <label>
              <span className="field-label">Future Planning Installments</span>
              <input className="input-field w-full" type="number" min="0" step="1" inputMode="numeric" value={numberInputValue(form.futurePlanningInstallments)} onChange={(event) => updateForm("futurePlanningInstallments", event.target.value)} required />
            </label>
            <label>
              <span className="field-label">Actual Monthly Spending</span>
              <input className="input-field w-full" type="number" min="0" step="1" inputMode="numeric" value={numberInputValue(form.actualMonthlySpending)} onChange={(event) => updateForm("actualMonthlySpending", event.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-gray-50 px-3 py-2.5 text-xs">
            <div>
              <span className="font-semibold text-gray-700">Monthly Petty Cash Spendings</span>
              <span className="ml-2 text-gray-500">Automatic fixed deduction</span>
            </div>
            <span className="font-bold text-gray-900">{formatIdr(MONTHLY_PETTY_CASH)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : editingMonth ? "Update month" : "Save month"}</button>
            {editingMonth && <button type="button" className="btn btn-secondary" onClick={startNewMonth} disabled={saving}>Cancel edit</button>}
          </div>
        </form>
      </section>

      {loading ? (
        <section className="surface-card flex min-h-48 items-center justify-center p-6 text-sm text-gray-400">Loading personal finance history…</section>
      ) : records.length === 0 ? (
        <section className="surface-card flex min-h-48 flex-col items-center justify-center p-6 text-center">
          <div className="rounded-full bg-[var(--accent-soft)] px-4 py-3 text-xl text-[var(--accent)]">Rp</div>
          <h2 className="mt-3 font-semibold text-gray-900">No monthly records yet</h2>
          <p className="mt-1 max-w-md text-xs leading-5 text-gray-500">Add your first month above. The fixed petty cash deduction and DCA recommendations will be calculated automatically.</p>
        </section>
      ) : (
        <>
          {selectedRow && <SummaryCard row={selectedRow} />}
          <HistoryCard
            rows={historyRows}
            selectedMonth={selectedRow?.month ?? null}
            onSelect={setSelectedMonth}
            onEdit={(month) => { const record = records.find((item) => item.month === month); if (record) startEditing(record); }}
            onDelete={(month) => { const record = records.find((item) => item.month === month); if (record) void handleDelete(record); }}
            deletingMonth={deletingMonth}
          />
        </>
      )}

      {error && records.length === 0 && !loading && (
        <div className="flex justify-end"><button type="button" className="btn btn-secondary" onClick={() => { setLoading(true); setReloadToken((value) => value + 1); }}>Retry load</button></div>
      )}
    </div>
  );
}

function SummaryCard({ row }: { row: PersonalFinanceComputedRow }) {
  const status = statusFor(row);
  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{formatMonth(row.month)} summary</h2>
            <span className={`badge ${status.classes}`}>{status.label}</span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">Income → prior deficit → planned deductions → remaining balance → DCA guidance</p>
        </div>
        <div className={`text-right ${row.remainder < 0 ? "text-red-600" : "text-gray-900"}`}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Remaining Balance</div>
          <div className="text-xl font-bold">{formatIdr(row.remainder)}</div>
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5 sm:p-5">
        <SummaryValue label="Income" value={formatIdr(row.income)} />
        <SummaryValue label="Carryover Applied" value={formatIdr(row.carryoverApplied)} detail="Prior deficit" />
        <SummaryValue label="Credit Card Payment" value={formatIdr(row.creditCardPayment)} />
        <SummaryValue label="Future Planning Installments" value={formatIdr(row.futurePlanningInstallments)} />
        <SummaryValue label="Monthly Petty Cash Spendings" value={formatIdr(MONTHLY_PETTY_CASH)} />
      </div>
      <div className="grid gap-3 border-t border-[var(--border)] bg-gray-50/70 p-4 sm:grid-cols-3 sm:p-5">
        <SummaryValue label="Planned Deductions" value={formatIdr(row.plannedDeductions)} detail="Three planned lines" />
        <SummaryValue label="Actual Monthly Spending" value={row.actualMonthlySpending === null ? "Not recorded" : formatIdr(row.actualMonthlySpending)} detail="Display only; not in formula" />
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Recommended DCA</div>
          {row.remainder > 0 ? (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-indigo-900"><span>VOO {formatIdr(row.vooRecommendation)}</span><span>VXUS {formatIdr(row.vxusRecommendation)}</span></div>
          ) : <div className="mt-1 text-sm font-bold text-indigo-900">{formatIdr(0)}</div>}
          <div className="mt-0.5 text-[10px] text-indigo-700">Guidance only · 60% / 40%</div>
        </div>
      </div>
      {row.remainder < 0 && <div className="border-t border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-800 sm:px-5">This month is short by {formatIdr(Math.abs(row.remainder))}. The deficit will be deducted from the next recorded month before its planned deductions.</div>}
    </section>
  );
}

function SummaryValue({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-0"><div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div><div className="mt-1 truncate text-sm font-bold text-gray-900">{value}</div>{detail && <div className="mt-0.5 text-[10px] text-gray-400">{detail}</div>}</div>;
}

function HistoryCard({
  rows,
  selectedMonth,
  onSelect,
  onEdit,
  onDelete,
  deletingMonth,
}: {
  rows: PersonalFinanceComputedRow[];
  selectedMonth: string | null;
  onSelect: (month: string) => void;
  onEdit: (month: string) => void;
  onDelete: (month: string) => void;
  deletingMonth: string | null;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5"><h2 className="font-semibold">Monthly history</h2><p className="mt-1 text-xs text-[var(--muted)]">Newest first. Select a row to update the summary.</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead className="border-b border-[var(--border)] bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
            <tr><th className="px-4 py-2.5 font-semibold sm:px-5">Month</th><th className="px-3 py-2.5 font-semibold">Income</th><th className="px-3 py-2.5 font-semibold">Carryover</th><th className="px-3 py-2.5 font-semibold">Deductions</th><th className="px-3 py-2.5 font-semibold">Actual Spending</th><th className="px-3 py-2.5 font-semibold">Remaining</th><th className="px-3 py-2.5 font-semibold">Recommended DCA</th><th className="px-3 py-2.5 font-semibold">Status</th><th className="px-4 py-2.5 font-semibold sm:px-5">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row) => {
              const status = statusFor(row);
              return (
                <tr key={row.month} className={`transition-colors ${selectedMonth === row.month ? "bg-[var(--accent-soft)]/50" : "hover:bg-gray-50"}`}>
                  <td className="px-4 py-3 font-semibold text-gray-900 sm:px-5"><button type="button" className="text-left hover:text-[var(--accent)]" onClick={() => onSelect(row.month)}>{formatMonth(row.month)}</button></td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-700">{formatIdr(row.income)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-700">{formatIdr(row.carryoverApplied)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-700">{formatIdr(row.plannedDeductions)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-700">{row.actualMonthlySpending === null ? "—" : formatIdr(row.actualMonthlySpending)}</td>
                  <td className={`px-3 py-3 whitespace-nowrap font-semibold ${row.remainder < 0 ? "text-red-600" : "text-gray-900"}`}>{formatIdr(row.remainder)}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-700">{row.remainder > 0 ? `${formatIdr(row.vooRecommendation)} / ${formatIdr(row.vxusRecommendation)}` : "Rp0"}</td>
                  <td className="px-3 py-3"><span className={`badge ${status.classes}`}>{status.label}</span></td>
                  <td className="px-4 py-3 sm:px-5"><div className="flex gap-1.5"><button type="button" className="btn btn-secondary !px-2.5 !py-1.5" onClick={() => onEdit(row.month)}>Edit</button><button type="button" className="btn btn-ghost !px-2.5 !py-1.5 !text-red-600" onClick={() => onDelete(row.month)} disabled={deletingMonth === row.month}>{deletingMonth === row.month ? "Deleting…" : "Delete"}</button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
