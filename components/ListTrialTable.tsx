"use client";

import { useState, type FormEvent } from "react";
import type { UsBreakoutListTrialCohort, UsBreakoutListTrialRecord } from "@/lib/firestore";

interface ListTrialTableProps {
  records: UsBreakoutListTrialRecord[];
  loading?: boolean;
  saving?: boolean;
  error?: string;
  onAdd: (record: Omit<UsBreakoutListTrialRecord, "id">) => void;
  onRemove: (id: string) => void;
}

const cohortLabel: Record<UsBreakoutListTrialCohort, string> = {
  benchmark: "Benchmark",
  control: "Control",
};

export default function ListTrialTable({ records, loading = false, saving = false, error = "", onAdd, onRemove }: ListTrialTableProps) {
  const [ticker, setTicker] = useState("");
  const [candidateDate, setCandidateDate] = useState("");
  const [cohort, setCohort] = useState<UsBreakoutListTrialCohort>("benchmark");
  const [note, setNote] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker || !candidateDate) return;
    onAdd({ ticker: normalizedTicker, candidateDate, cohort, note: note.trim() });
    setTicker("");
    setCandidateDate("");
    setCohort("benchmark");
    setNote("");
  }

  return (
    <section className="space-y-4" aria-labelledby="list-trial-title">
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-5">
        <h2 id="list-trial-title" className="text-base font-semibold text-gray-800">List Trial</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Add historical candidate dates to compare known recoveries with false-bottom controls. This step stores the trial rows only; no market data or score is calculated yet.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto] lg:items-end">
          <label className="block text-xs font-medium text-gray-600">
            Ticker
            <input value={ticker} onChange={(event) => setTicker(event.target.value)} placeholder="TEAM" className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm uppercase" required />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Candidate date
            <input type="date" value={candidateDate} onChange={(event) => setCandidateDate(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" required />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Cohort
            <select value={cohort} onChange={(event) => setCohort(event.target.value as UsBreakoutListTrialCohort)} className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm">
              <option value="benchmark">Benchmark</option>
              <option value="control">Control</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Note <span className="font-normal text-gray-400">(optional)</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why this date is interesting" className="mt-1 w-full rounded border border-gray-300 px-2.5 py-2 text-sm" />
          </label>
          <button type="submit" disabled={saving || loading} className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Adding…" : "Add trial"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Ticker</th>
              <th className="px-3 py-2 font-semibold">Candidate date</th>
              <th className="px-3 py-2 font-semibold">Cohort</th>
              <th className="px-3 py-2 font-semibold">Note</th>
              <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Loading trial rows…</td></tr>}
            {!loading && records.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">No trial rows yet. Add a benchmark or control candidate above.</td></tr>}
            {!loading && records.map((record) => (
              <tr key={record.id}>
                <td className="px-3 py-2 font-mono font-semibold text-gray-800">{record.ticker}</td>
                <td className="px-3 py-2 text-gray-700">{record.candidateDate}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${record.cohort === "benchmark" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{cohortLabel[record.cohort]}</span></td>
                <td className="max-w-sm px-3 py-2 text-gray-600">{record.note || <span className="text-gray-400">—</span>}</td>
                <td className="px-3 py-2 text-right"><button type="button" onClick={() => onRemove(record.id)} className="text-xs font-medium text-red-600 hover:text-red-800">Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
