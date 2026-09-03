"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { downloadCsv } from "@/lib/exportCsv";
import { scoreBaggerRow, type BaggerLabel, type BaggerSubScores } from "@/lib/baggerScore";

export interface BaggerStock {
  ticker: string;
  name: string | null;
  industry: string | null;
  addedAt?: string | null;
}

type SortKey =
  | "ticker" | "industry" | "price" | "totalScore" | "distFromAth" | "roc1mo" | "rsVsSpy3mo" | "weeklyRsi"
  | "volRatio10_90" | "capVolRatio" | "rsiFloor52wk" | "priceVs20dLow" | "dropSpeed" | "recoveryCandle";
type SortDir = "asc" | "desc";

const LABEL_STYLES: Record<BaggerLabel, string> = {
  "High Conviction Reversal": "bg-green-100 text-green-700 border border-green-300",
  "Developing Reversal": "bg-blue-100 text-blue-700 border border-blue-300",
  "Early Signs Only": "bg-yellow-100 text-yellow-700 border border-yellow-300",
  "Not Ready": "bg-red-100 text-red-700 border border-red-300",
};

const TIER_TEXT: Record<number, string> = {
  3: "text-green-600 font-semibold",
  2: "text-blue-600 font-medium",
  1: "text-yellow-600 font-medium",
  0: "text-red-500 font-medium",
};
const tierColor = (score: number | undefined) => (score == null ? "text-gray-400" : TIER_TEXT[score] ?? "text-gray-400");

const dash = <span className="text-gray-400">—</span>;

const pctCell = (v: number | null, score: number | undefined, dec = 1) => {
  if (v == null) return dash;
  return <span className={tierColor(score)}>{v >= 0 ? "+" : ""}{v.toFixed(dec)}%</span>;
};

const SCORE_ROW_LABELS: [keyof BaggerSubScores, string][] = [
  ["distFromAth", "% from ATH"],
  ["roc1mo", "ROC 1mo"],
  ["rsVsSpy3mo", "RS vs SPY 3mo"],
  ["weeklyRsi", "Weekly RSI"],
  ["volRatio10_90", "Vol Ratio 10d/90d"],
  ["capVolRatio", "Cap Vol Ratio"],
  ["rsiFloor52wk", "RSI Floor 52wk"],
  ["priceVs20dLow", "Price vs 20d Low"],
  ["dropSpeed", "Drop Speed"],
  ["recoveryCandle", "Recovery Candle"],
];

function ScoreBadge({ score, label, subScores, dataGaps }: {
  score: number; label: BaggerLabel; subScores: BaggerSubScores; dataGaps: string[];
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  function show() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 260) });
    }
  }
  function hide() {
    timerRef.current = setTimeout(() => setPos(null), 120);
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        ref={anchorRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={() => (pos ? setPos(null) : show())}
        className="font-semibold text-gray-900 cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2"
      >
        {score}
      </span>
      <span className={`inline-flex items-center rounded-full ${LABEL_STYLES[label]} text-xs font-semibold px-2 py-0.5 whitespace-nowrap`}>
        {label}
      </span>
      {dataGaps.length > 0 && (
        <span title={`Data gaps: ${dataGaps.join(", ")}`} className="inline-flex items-center rounded-full bg-gray-100 text-gray-500 border border-gray-300 text-xs font-semibold px-1.5 py-0.5 whitespace-nowrap cursor-help">
          ⚑
        </span>
      )}
      {pos && (
        <div
          className="fixed z-[9999] w-60 bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-left normal-case font-normal"
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
          onMouseLeave={hide}
        >
          <div className="text-xs font-semibold text-gray-900 mb-1.5">Score breakdown</div>
          <table className="w-full text-[11px]">
            <tbody>
              {SCORE_ROW_LABELS.map(([key, rowLabel]) => (
                <tr key={key} className="border-b border-gray-50 last:border-0">
                  <td className="py-0.5 text-gray-500">{rowLabel}</td>
                  <td className="py-0.5 text-right font-mono text-gray-800">{subScores[key]}/3</td>
                </tr>
              ))}
              <tr className="border-t border-gray-200">
                <td className="py-1 font-semibold text-gray-900">Total</td>
                <td className="py-1 text-right font-mono font-semibold text-gray-900">{score}/30</td>
              </tr>
            </tbody>
          </table>
          {dataGaps.length > 0 && (
            <div className="text-[10px] text-gray-400 mt-1.5 leading-snug">Data gaps ({dataGaps.length}): {dataGaps.join(", ")}</div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  stocks: BaggerStock[];
  prices: Record<string, number | null>;
  distFromAth: Record<string, number | null>;
  roc1mo: Record<string, number | null>;
  rsVsSpy3mo: Record<string, number | null>;
  weeklyRsi: Record<string, number | null>;
  volRatio10_90: Record<string, number | null>;
  capVolRatio: Record<string, number | null>;
  rsiFloor52wk: Record<string, number | null>;
  priceVs20dLow: Record<string, number | null>;
  dropSpeed: Record<string, number | null>;
  recoveryCandle: Record<string, number | null>;
  loading?: boolean;
  addTicker: string;
  addLoading: boolean;
  addError: string;
  onAddTickerChange: (v: string) => void;
  onAdd: (e: FormEvent) => void;
  onRemove: (ticker: string) => void;
  onMoveToExcluded: (ticker: string) => void;
}

export default function BaggerReversalTable({
  stocks, prices, distFromAth, roc1mo, rsVsSpy3mo, weeklyRsi, volRatio10_90,
  capVolRatio, rsiFloor52wk, priceVs20dLow, dropSpeed, recoveryCandle,
  loading, addTicker, addLoading, addError, onAddTickerChange, onAdd, onRemove, onMoveToExcluded,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("totalScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "ticker" || key === "industry" ? "asc" : "desc"); }
  }

  const rows = useMemo(() => {
    const arr = stocks.map((s) => {
      const raw = {
        distFromAth: distFromAth[s.ticker] ?? null,
        roc1mo: roc1mo[s.ticker] ?? null,
        rsVsSpy3mo: rsVsSpy3mo[s.ticker] ?? null,
        weeklyRsi: weeklyRsi[s.ticker] ?? null,
        volRatio10_90: volRatio10_90[s.ticker] ?? null,
        capVolRatio: capVolRatio[s.ticker] ?? null,
        rsiFloor52wk: rsiFloor52wk[s.ticker] ?? null,
        priceVs20dLow: priceVs20dLow[s.ticker] ?? null,
        dropSpeed: dropSpeed[s.ticker] ?? null,
        recoveryCandle: recoveryCandle[s.ticker] ?? null,
      };
      const result = scoreBaggerRow(raw);
      return { ...s, price: prices[s.ticker] ?? null, ...raw, ...result };
    });
    arr.sort((a, b) => {
      let av: string | number | null = null, bv: string | number | null = null;
      if (sortKey === "ticker" || sortKey === "industry") { av = a[sortKey] ?? ""; bv = b[sortKey] ?? ""; }
      else { av = a[sortKey as keyof typeof a] as number | null; bv = b[sortKey as keyof typeof b] as number | null; }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      const an = Number(av), bn = Number(bv);
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return arr;
  }, [stocks, prices, distFromAth, roc1mo, rsVsSpy3mo, weeklyRsi, volRatio10_90,
      capVolRatio, rsiFloor52wk, priceVs20dLow, dropSpeed, recoveryCandle, sortKey, sortDir]);

  function exportCsv() {
    const date = new Date().toISOString().slice(0, 10);
    const headers = [
      "Ticker", "% from ATH", "ROC 1mo", "RS vs SPY 3mo", "Weekly RSI", "Vol Ratio 10d/90d",
      "Cap Vol Ratio", "RSI Floor 52wk", "Price vs 20d Low", "Drop Speed", "Recovery Candle",
      "Total Score", "Label", "Data Gaps",
    ];
    const data = rows.map((r) => [
      r.ticker,
      r.distFromAth?.toFixed(1) ?? "",
      r.roc1mo?.toFixed(1) ?? "",
      r.rsVsSpy3mo?.toFixed(2) ?? "",
      r.weeklyRsi?.toFixed(1) ?? "",
      r.volRatio10_90?.toFixed(2) ?? "",
      r.capVolRatio?.toFixed(2) ?? "",
      r.rsiFloor52wk?.toFixed(1) ?? "",
      r.priceVs20dLow?.toFixed(1) ?? "",
      r.dropSpeed?.toFixed(1) ?? "",
      r.recoveryCandle?.toFixed(2) ?? "",
      r.totalScore,
      r.label,
      r.dataGaps.join(", "),
    ]);
    downloadCsv(`bagger-reversal-${date}.csv`, headers, data);
  }

  const th = (label: string, k: SortKey, extraClass = "") => {
    const sticky = k === "ticker";
    return (
      <th
        key={k}
        onClick={() => handleSort(k)}
        className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 whitespace-nowrap select-none ${sticky ? "sticky left-0 z-20 bg-gray-100 border-r border-gray-200" : ""} ${extraClass}`}
      >
        {label} {sortKey === k && (sortDir === "asc" ? "▲" : "▼")}
      </th>
    );
  };

  return (
    <div className="space-y-3">
      <form onSubmit={onAdd} className="flex items-center gap-2">
        <input
          value={addTicker}
          onChange={(e) => onAddTickerChange(e.target.value.toUpperCase())}
          placeholder="Add ticker (e.g. AAPL)"
          className="border rounded px-2 py-1 text-sm w-48"
        />
        <button type="submit" disabled={addLoading} className="text-sm bg-blue-600 text-white rounded px-3 py-1 disabled:opacity-50">
          {addLoading ? "Adding..." : "Add"}
        </button>
        {addError && <span className="text-xs text-red-500">{addError}</span>}
        {stocks.length > 0 && (
          <button
            onClick={exportCsv}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm font-semibold ml-auto"
          >
            Export CSV
          </button>
        )}
      </form>

      {loading && <div className="text-sm text-gray-400">Loading...</div>}
      {!loading && stocks.length === 0 && (
        <div className="text-sm text-gray-400">No tickers yet — add one above to start tracking Potential Bagger Reversal setups.</div>
      )}

      {stocks.length > 0 && (
        <div className="overflow-x-auto overflow-y-auto max-h-[72vh] rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                {th("Ticker", "ticker")}
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Industry</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Price</th>
                {th("Score", "totalScore")}
                {th("% from ATH", "distFromAth")}
                {th("ROC 1mo", "roc1mo")}
                {th("RS vs SPY 3mo", "rsVsSpy3mo")}
                {th("Weekly RSI", "weeklyRsi")}
                {th("Vol Ratio 10d/90d", "volRatio10_90")}
                {th("Cap Vol Ratio", "capVolRatio")}
                {th("RSI Floor 52wk", "rsiFloor52wk")}
                {th("Price vs 20d Low", "priceVs20dLow")}
                {th("Drop Speed", "dropSpeed")}
                {th("Recovery Candle", "recoveryCandle")}
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.ticker} className="hover:bg-gray-50 group">
                  <td className="px-3 py-2 font-semibold text-gray-900 sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r border-gray-200">
                    {r.ticker}
                    {r.name && <div className="text-xs text-gray-400 font-normal">{r.name}</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.industry}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.price != null ? `$${r.price.toFixed(2)}` : dash}</td>
                  <td className="px-3 py-2">
                    <ScoreBadge score={r.totalScore} label={r.label} subScores={r.subScores} dataGaps={r.dataGaps} />
                  </td>
                  <td className="px-3 py-2">{pctCell(r.distFromAth, r.subScores.distFromAth)}</td>
                  <td className="px-3 py-2">{pctCell(r.roc1mo, r.subScores.roc1mo)}</td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.rsVsSpy3mo)}`}>
                    {r.rsVsSpy3mo != null ? r.rsVsSpy3mo.toFixed(2) : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.weeklyRsi)}`}>
                    {r.weeklyRsi != null ? r.weeklyRsi.toFixed(1) : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.volRatio10_90)}`}>
                    {r.volRatio10_90 != null ? `${r.volRatio10_90.toFixed(2)}x` : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.capVolRatio)}`}>
                    {r.capVolRatio != null ? `${r.capVolRatio.toFixed(2)}x` : dash}
                  </td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.rsiFloor52wk)}`}>
                    {r.rsiFloor52wk != null ? r.rsiFloor52wk.toFixed(1) : dash}
                  </td>
                  <td className="px-3 py-2">{pctCell(r.priceVs20dLow, r.subScores.priceVs20dLow)}</td>
                  <td className="px-3 py-2">{pctCell(r.dropSpeed, r.subScores.dropSpeed)}</td>
                  <td className={`px-3 py-2 font-medium ${tierColor(r.subScores.recoveryCandle)}`}>
                    {r.recoveryCandle != null ? r.recoveryCandle.toFixed(2) : dash}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => onRemove(r.ticker)} className="text-xs text-red-500 hover:text-red-700 mr-2">Remove</button>
                    <button onClick={() => onMoveToExcluded(r.ticker)} className="text-xs text-[var(--muted)] hover:text-red-600">Move to Excluded</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
