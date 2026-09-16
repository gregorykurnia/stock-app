import type { BottomScoreComponentStatus, BottomScoreExplanation as BottomScoreExplanationData } from "@/lib/listTrialScore";
import ListTrialIndicatorState, { type ListTrialIndicatorStateData } from "./ListTrialIndicatorState";

interface BottomScoreExplanationProps {
  explanation: BottomScoreExplanationData;
  indicatorState?: ListTrialIndicatorStateData;
  asOfDate?: string;
  price?: number | null;
  currentRollingLow?: number | null;
  pctAboveCurrentRollingLow?: number | null;
  requestedDateWasTradingDay?: boolean;
}

const statusLabel: Record<BottomScoreComponentStatus, string> = {
  favorable: "Favorable",
  neutral: "Neutral",
  unfavorable: "Unfavorable",
  unavailable: "Unavailable",
};

const statusClass: Record<BottomScoreComponentStatus, string> = {
  favorable: "bg-emerald-100 text-emerald-800",
  neutral: "bg-amber-100 text-amber-800",
  unfavorable: "bg-rose-100 text-rose-800",
  unavailable: "bg-slate-100 text-slate-600",
};

const formatInput = (value: number | null, unit: "percent" | "percentagePoints" | "points" | "value") => {
  if (value == null) return "Unavailable";
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "percentagePoints") return `${value.toFixed(2)} pp`;
  if (unit === "points") return `${value.toFixed(2)} pts`;
  return value.toFixed(3);
};

const formatPrice = (value: number | null) => value == null ? "Unavailable" : value.toFixed(2);

export default function BottomScoreExplanation({ explanation, indicatorState, asOfDate, price, currentRollingLow, pctAboveCurrentRollingLow, requestedDateWasTradingDay = true }: BottomScoreExplanationProps) {
  return (
    <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-left" data-testid="bottom-score-explanation">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">How this Bottom Score was calculated</p>
          <p className="mt-1 text-sm text-slate-700">{explanation.summary}</p>
        </div>
        <div className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Heuristic score</p>
          <p className="text-xl font-bold text-slate-900">{explanation.score == null ? "Not scoreable" : `${explanation.score.toFixed(1)} / ${explanation.maxScore}`}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded border border-blue-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What it means</p>
          <p className="mt-1 text-xs leading-5 text-slate-700">{explanation.interpretation}</p>
          <p className="mt-2 text-xs leading-5 text-amber-800">{explanation.warning}</p>
        </div>
        <div className="rounded border border-blue-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hard gates</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {explanation.gates.map((gate) => (
              <li key={gate.key} className="flex items-start gap-2">
                <span aria-hidden="true" className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${gate.passed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{gate.passed ? "✓" : "!"}</span>
                <span className="min-w-0"><span className="font-medium text-slate-800">{gate.label}:</span> <span className={gate.passed ? "text-emerald-700" : "text-rose-700"}>{gate.passed ? "Passed" : "Failed"}</span><span className="block text-slate-500">{gate.passed ? gate.rule : gate.reason}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {indicatorState && asOfDate && <ListTrialIndicatorState state={indicatorState} asOfDate={asOfDate} price={price ?? null} currentRollingLow={currentRollingLow ?? null} pctAboveCurrentRollingLow={pctAboveCurrentRollingLow ?? null} requestedDateWasTradingDay={requestedDateWasTradingDay} heading="As-of candidate-date indicator state" />}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Component contributions</p>
          <p className="text-xs text-slate-500">Points earned / maximum</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {explanation.components.map((component) => (
            <article key={component.key} className="rounded border border-blue-100 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">{component.label}</h4>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass[component.status]}`}>{statusLabel[component.status]}</span>
                </div>
                <p className="shrink-0 text-sm font-bold text-slate-900">+{component.points.toFixed(1)} / {component.maxPoints}</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${component.label} contribution`} aria-valuemin={0} aria-valuemax={component.maxPoints} aria-valuenow={component.points}>
                <div className={`h-full rounded-full ${component.status === "favorable" ? "bg-emerald-500" : component.status === "neutral" ? "bg-amber-500" : component.status === "unavailable" ? "bg-slate-300" : "bg-rose-400"}`} style={{ width: `${Math.min(100, Math.max(0, component.contributionPct))}%` }} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-700">{component.explanation}</p>
              <dl className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
                {component.inputs.map((input) => <div key={input.label} className="flex items-start justify-between gap-3"><dt className="text-slate-500">{input.label}</dt><dd className="font-medium text-slate-800">{formatInput(input.value, input.unit)}</dd></div>)}
              </dl>
              <p className="mt-2 text-[11px] leading-4 text-slate-500"><span className="font-semibold">Rule:</span> {component.rule} <span className="ml-1">({component.contributionPct.toFixed(1)}% of this component&apos;s maximum)</span></p>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded border border-blue-100 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">As-of-date anchors</p>
        <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
          <div><dt className="text-slate-500">Then-known ATH</dt><dd className="font-medium text-slate-800">{formatPrice(explanation.anchors.allTimeHigh)}</dd></div>
          <div><dt className="text-slate-500">Current rolling low</dt><dd className="font-medium text-slate-800">{explanation.anchors.currentRollingLow ? `${formatPrice(explanation.anchors.currentRollingLow.close)} · ${explanation.anchors.currentRollingLow.date}` : "Unavailable"}</dd></div>
          <div><dt className="text-slate-500">Prior selling low</dt><dd className="font-medium text-slate-800">{explanation.anchors.priorSellingLow ? `${formatPrice(explanation.anchors.priorSellingLow.close)} · ${explanation.anchors.priorSellingLow.date}` : "Unavailable"}</dd></div>
        </dl>
      </div>
    </div>
  );
}
