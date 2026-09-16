export interface ListTrialIndicatorStateData {
  rsi: number | null;
  rsiAtCurrentLow: number | null;
  rsiAtPriorLow: number | null;
  rsiDeltaCurrentVsPrior: number | null;
  macdHist: number | null;
  macdHistPctOfPrice: number | null;
  macdHistPctAtCurrentLow: number | null;
  macdHistPctAtPriorLow: number | null;
  macdHistPctDeltaCurrentVsPrior: number | null;
  diPlus: number | null;
  diMinus: number | null;
  diGap: number | null;
  diGapAtCurrentLow: number | null;
  diGapAtPriorLow: number | null;
  adx: number | null;
  adxAtCurrentLow: number | null;
  adxAtPriorLow: number | null;
  adxDeltaCurrentVsPrior: number | null;
  cmf: number | null;
  cmfAtCurrentLow: number | null;
  cmfAtPriorLow: number | null;
  cmfDeltaCurrentVsPrior: number | null;
  atr14: number | null;
  atrPct: number | null;
  volume: number | null;
  averageVolume20: number | null;
  relativeVolume20: number | null;
}

interface ListTrialIndicatorStateDetailsProps {
  state: ListTrialIndicatorStateData;
  asOfDate: string;
  price: number | null;
  currentRollingLow: number | null;
  pctAboveCurrentRollingLow: number | null;
  requestedDateWasTradingDay: boolean;
  heading: string;
}

const formatValue = (value: number | null | undefined, digits: number) => value == null ? "—" : value.toFixed(digits);
const formatPercent = (value: number | null | undefined, digits = 1) => value == null ? "—" : `${value.toFixed(digits)}%`;
const formatPercentagePoints = (value: number | null | undefined, digits = 2) => value == null ? "—" : `${value.toFixed(digits)} pp`;
const formatPrice = (value: number | null | undefined) => value == null ? "—" : `$${value.toFixed(2)}`;
const formatVolume = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);

function indicatorInterpretation(state: ListTrialIndicatorStateData): string {
  const rsiText = state.rsi == null
    ? "RSI is unavailable"
    : state.rsi < 30
      ? `RSI is ${state.rsi.toFixed(1)}, below the commonly used 30 oversold reference`
      : state.rsi > 70
        ? `RSI is ${state.rsi.toFixed(1)}, above the commonly used 70 overbought reference`
        : `RSI is ${state.rsi.toFixed(1)}, outside the usual oversold/overbought extremes`;
  const directionText = state.diPlus == null || state.diMinus == null
    ? "DI direction is unavailable"
    : state.diMinus > state.diPlus
      ? `DI− (${state.diMinus.toFixed(1)}) is above DI+ (${state.diPlus.toFixed(1)})`
      : `DI+ (${state.diPlus.toFixed(1)}) is at or above DI− (${state.diMinus.toFixed(1)})`;
  const adxText = state.adx == null
    ? "ADX is unavailable"
    : state.adx < 20
      ? `ADX is ${state.adx.toFixed(1)}, generally read as weak directional strength`
      : state.adx < 25
        ? `ADX is ${state.adx.toFixed(1)}, indicating modest directional strength`
        : `ADX is ${state.adx.toFixed(1)}, indicating stronger directional strength`;
  const cmfText = state.cmf == null
    ? "CMF is unavailable"
    : state.cmf > 0
      ? `CMF is positive at ${state.cmf.toFixed(3)}`
      : state.cmf < 0
        ? `CMF is negative at ${state.cmf.toFixed(3)}`
        : "CMF is neutral at 0.000";
  return `${rsiText}; ${directionText}; ${adxText}; ${cmfText}. These are descriptive indicator readings, not a forecast or trading recommendation.`;
}

export function ListTrialIndicatorStateSummary({ state }: { state: ListTrialIndicatorStateData }) {
  return <span className="whitespace-nowrap">RSI {formatValue(state.rsi, 1)} · DI gap {formatValue(state.diGap, 1)} · ADX {formatValue(state.adx, 1)} · CMF {formatValue(state.cmf, 3)}</span>;
}

export default function ListTrialIndicatorStateDetails({ state, asOfDate, price, currentRollingLow, pctAboveCurrentRollingLow, requestedDateWasTradingDay, heading }: ListTrialIndicatorStateDetailsProps) {
  return (
    <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-left" data-testid="list-trial-indicator-state">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{heading}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">Absolute readings captured as of <span className="font-semibold text-slate-800">{asOfDate}</span>. They describe the current state at that date; score deltas compare the selected low with the prior selling episode.</p>
          {!requestedDateWasTradingDay && <p className="mt-1 text-xs leading-5 text-amber-800">The requested date was not a trading day, so these values use the nearest available trading date shown above.</p>}
        </div>
        <div className="shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">As-of price</p>
          <p className="text-lg font-bold text-slate-900">{formatPrice(price)}</p>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border border-emerald-100 bg-white p-3"><dt className="text-xs text-slate-500">RSI</dt><dd className="mt-1 text-base font-semibold text-slate-900">{formatValue(state.rsi, 1)}</dd></div>
        <div className="rounded border border-emerald-100 bg-white p-3"><dt className="text-xs text-slate-500">DI+ / DI−</dt><dd className="mt-1 text-base font-semibold text-slate-900">{formatValue(state.diPlus, 1)} / {formatValue(state.diMinus, 1)}</dd></div>
        <div className="rounded border border-emerald-100 bg-white p-3"><dt className="text-xs text-slate-500">DI gap</dt><dd className="mt-1 text-base font-semibold text-slate-900">{formatValue(state.diGap, 1)}</dd></div>
        <div className="rounded border border-emerald-100 bg-white p-3"><dt className="text-xs text-slate-500">ADX</dt><dd className="mt-1 text-base font-semibold text-slate-900">{formatValue(state.adx, 1)}</dd></div>
        <div className="rounded border border-emerald-100 bg-white p-3"><dt className="text-xs text-slate-500">CMF</dt><dd className="mt-1 text-base font-semibold text-slate-900">{formatValue(state.cmf, 3)}</dd></div>
        <div className="rounded border border-emerald-100 bg-white p-3"><dt className="text-xs text-slate-500">MACD histogram</dt><dd className="mt-1 text-base font-semibold text-slate-900">{formatValue(state.macdHist, 4)}</dd><p className="mt-1 text-[11px] text-slate-500">{formatPercent(state.macdHistPctOfPrice, 2)} of price</p></div>
        <div className="rounded border border-emerald-100 bg-white p-3"><dt className="text-xs text-slate-500">ATR(14) / ATR%</dt><dd className="mt-1 text-base font-semibold text-slate-900">{formatPrice(state.atr14)} / {formatPercent(state.atrPct)}</dd></div>
        <div className="rounded border border-emerald-100 bg-white p-3"><dt className="text-xs text-slate-500">Relative volume 20</dt><dd className="mt-1 text-base font-semibold text-slate-900">{formatValue(state.relativeVolume20, 2)}</dd><p className="mt-1 text-[11px] text-slate-500">{formatVolume(state.volume)} current · {formatVolume(state.averageVolume20)} average</p></div>
      </dl>

      <div className="overflow-x-auto rounded border border-emerald-100 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score comparison context</p>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">These are the low-point readings used by the score deltas: current rolling low versus prior selling-episode low. They are separate from the absolute readings above.</p>
        <table className="mt-2 min-w-[520px] w-full text-xs">
          <thead className="border-b border-slate-100 text-left text-slate-500"><tr><th className="px-2 py-1.5 font-medium">Measure</th><th className="px-2 py-1.5 font-medium">Current low</th><th className="px-2 py-1.5 font-medium">Prior low</th><th className="px-2 py-1.5 font-medium">Change used by score</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            <tr><th className="px-2 py-1.5 text-left font-medium">RSI</th><td className="px-2 py-1.5">{formatValue(state.rsiAtCurrentLow, 1)}</td><td className="px-2 py-1.5">{formatValue(state.rsiAtPriorLow, 1)}</td><td className="px-2 py-1.5">{formatValue(state.rsiDeltaCurrentVsPrior, 1)}</td></tr>
            <tr><th className="px-2 py-1.5 text-left font-medium">DI gap</th><td className="px-2 py-1.5">{formatValue(state.diGapAtCurrentLow, 1)}</td><td className="px-2 py-1.5">{formatValue(state.diGapAtPriorLow, 1)}</td><td className="px-2 py-1.5">{formatValue(state.diGapAtCurrentLow != null && state.diGapAtPriorLow != null ? state.diGapAtCurrentLow - state.diGapAtPriorLow : null, 1)}</td></tr>
            <tr><th className="px-2 py-1.5 text-left font-medium">ADX</th><td className="px-2 py-1.5">{formatValue(state.adxAtCurrentLow, 1)}</td><td className="px-2 py-1.5">{formatValue(state.adxAtPriorLow, 1)}</td><td className="px-2 py-1.5">{formatValue(state.adxDeltaCurrentVsPrior, 1)}</td></tr>
            <tr><th className="px-2 py-1.5 text-left font-medium">MACD hist % of price</th><td className="px-2 py-1.5">{formatPercent(state.macdHistPctAtCurrentLow, 2)}</td><td className="px-2 py-1.5">{formatPercent(state.macdHistPctAtPriorLow, 2)}</td><td className="px-2 py-1.5">{formatPercentagePoints(state.macdHistPctDeltaCurrentVsPrior)}</td></tr>
            <tr><th className="px-2 py-1.5 text-left font-medium">CMF</th><td className="px-2 py-1.5">{formatValue(state.cmfAtCurrentLow, 3)}</td><td className="px-2 py-1.5">{formatValue(state.cmfAtPriorLow, 3)}</td><td className="px-2 py-1.5">{formatValue(state.cmfDeltaCurrentVsPrior, 3)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border border-emerald-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price context</p>
          <dl className="mt-2 space-y-1.5 text-xs"><div className="flex justify-between gap-3"><dt className="text-slate-500">Current rolling low</dt><dd className="font-medium text-slate-800">{formatPrice(currentRollingLow)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Above rolling low</dt><dd className="font-medium text-slate-800">{formatPercent(pctAboveCurrentRollingLow)}</dd></div></dl>
        </div>
        <div className="rounded border border-emerald-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How to read this snapshot</p>
          <p className="mt-1 text-xs leading-5 text-slate-700">{indicatorInterpretation(state)}</p>
        </div>
      </div>
    </div>
  );
}
