"use client";

import type { LatestIndicators, HistoricalArrays, SetupType, ChecklistItem } from "@/lib/types";

function detectSetup(ind: LatestIndicators): SetupType {
  const ema20VsEma50 = (ind.ema20 - ind.ema50) / ind.ema50;
  const priceVsEma20 = (ind.price - ind.ema20) / ind.ema20;
  if (ema20VsEma50 < -0.10) return "beaten_down";
  if (ind.ema20 > ind.ema50 && priceVsEma20 > 0.20) return "parabolic";
  if (ind.ema20 > ind.ema50) return "pullback";
  return "volatile";
}

// Find local troughs (values lower than both neighbors) in an array
function findTroughs(arr: number[]): { idx: number; val: number }[] {
  const troughs: { idx: number; val: number }[] = [];
  for (let i = 1; i < arr.length - 1; i++) {
    if (arr[i] < arr[i - 1] && arr[i] < arr[i + 1]) {
      troughs.push({ idx: i, val: arr[i] });
    }
  }
  return troughs;
}

function detectObvHigherLow(obv: number[]): "pass" | "fail" | "unconfirmed" {
  const troughs = findTroughs(obv);
  if (troughs.length < 2) return "unconfirmed";
  const prev = troughs[troughs.length - 2];
  const recent = troughs[troughs.length - 1];
  if (recent.val > prev.val) return "pass";
  if (recent.val < prev.val) return "fail";
  return "unconfirmed";
}

function detectRsiDivergence(
  price: number[],
  rsi: number[]
): "pass" | "fail" | "unconfirmed" {
  const priceTroughs = findTroughs(price);
  if (priceTroughs.length < 2) return "unconfirmed";
  const prevP = priceTroughs[priceTroughs.length - 2];
  const recentP = priceTroughs[priceTroughs.length - 1];
  // Price must be making a lower low
  if (recentP.val >= prevP.val) return "unconfirmed"; // no lower low → not applicable
  const rsiAtPrev = rsi[prevP.idx];
  const rsiAtRecent = rsi[recentP.idx];
  if (isNaN(rsiAtPrev) || isNaN(rsiAtRecent)) return "unconfirmed";
  // Bullish divergence: price lower low but RSI higher low
  return rsiAtRecent > rsiAtPrev ? "pass" : "fail";
}

function buildChecklist(
  setup: SetupType,
  ind: LatestIndicators,
  hist: HistoricalArrays
): ChecklistItem[] {
  if (setup === "beaten_down") {
    const obvStatus = detectObvHigherLow(hist.obv_history);
    const cmfStatus = ind.cmfVal > 0 ? "pass" : ind.cmfVal >= -0.10 ? "borderline" : "fail";
    const rsiStatus = detectRsiDivergence(hist.price_history, hist.rsi_history);
    return [
      { label: "OBV higher low", mustHave: true, status: obvStatus },
      { label: "CMF above zero", mustHave: true, status: cmfStatus },
      { label: "RSI bullish divergence", mustHave: true, status: rsiStatus },
      { label: "DI+ above DI-", mustHave: false, status: ind.diPlus > ind.diMinus ? "pass" : "fail" },
      // EMA20 below EMA50 is the expected starting condition — never a failure
      { label: "EMA20 turning toward EMA50", mustHave: false, status: "unconfirmed" },
    ];
  }
  if (setup === "parabolic") {
    const priceVsEma20 = Math.abs((ind.price - ind.ema20) / ind.ema20);
    const obvTrend = hist.obv_history;
    const obvRising = obvTrend[obvTrend.length - 1] >= obvTrend[0];
    return [
      { label: "Price within 20% of EMA20 weekly", mustHave: true, status: priceVsEma20 < 0.20 ? "pass" : "fail" },
      { label: "RSI below 65", mustHave: true, status: ind.rsi < 65 ? "pass" : "fail" },
      { label: "OBV confirming (no divergence)", mustHave: true, status: obvRising ? "pass" : "fail" },
      { label: "ADX 25–45", mustHave: false, status: ind.adx >= 25 && ind.adx <= 45 ? "pass" : "fail" },
      { label: "EMA20 vs EMA50 gap under 25%", mustHave: false, status: Math.abs((ind.ema20 - ind.ema50) / ind.ema50) < 0.25 ? "pass" : "fail" },
    ];
  }
  if (setup === "pullback") {
    const obvTrend = hist.obv_history;
    const obvFlatOrRising = obvTrend[obvTrend.length - 1] >= obvTrend[0] * 0.97;
    const cmfStatus = ind.cmfVal > -0.15 ? "pass" : ind.cmfVal >= -0.20 ? "borderline" : "fail";
    return [
      { label: "EMA20 above EMA50", mustHave: true, status: ind.ema20 > ind.ema50 ? "pass" : "fail" },
      { label: "OBV flat or rising", mustHave: true, status: obvFlatOrRising ? "pass" : "fail" },
      { label: "DI+ above DI-", mustHave: true, status: ind.diPlus > ind.diMinus ? "pass" : "fail" },
      { label: "Price at or above EMA50", mustHave: false, status: ind.price >= ind.ema50 ? "pass" : "fail" },
      { label: "RSI 40–55", mustHave: false, status: ind.rsi >= 40 && ind.rsi <= 55 ? "pass" : "fail" },
      { label: "CMF above -0.15", mustHave: false, status: cmfStatus },
    ];
  }
  // volatile
  return [
    { label: "Swing only — no long term entry", mustHave: false, status: "unconfirmed" },
  ];
}

const statusIcon: Record<string, string> = {
  pass: "✓",
  fail: "✗",
  borderline: "~",
  unconfirmed: "?",
};

const statusColor: Record<string, string> = {
  pass: "text-green-400",
  fail: "text-red-400",
  borderline: "text-yellow-400",
  unconfirmed: "text-slate-500",
};

const labelColor = (item: ChecklistItem) => {
  if (item.status === "fail" && item.mustHave) return "text-red-300 font-semibold";
  if (item.status === "borderline") return "text-yellow-300";
  if (item.status === "unconfirmed") return "text-slate-400 italic";
  return "text-slate-300";
};

interface Props {
  indicators: LatestIndicators;
  history: HistoricalArrays;
}

export default function ChecklistPanel({ indicators, history }: Props) {
  const setup = detectSetup(indicators);
  const checklist = buildChecklist(setup, indicators, history);

  const passes = checklist.filter((c) => c.status === "pass").length;
  const mustFails = checklist.filter((c) => c.mustHave && c.status === "fail");
  const mustUnconfirmed = checklist.filter((c) => c.mustHave && c.status === "unconfirmed");

  const setupLabels: Record<SetupType, string> = {
    beaten_down: "Beaten Down",
    parabolic: "Parabolic (near ATH)",
    pullback: "Healthy Pullback",
    volatile: "Volatile / Choppy",
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Setup Checklist</h2>
        <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
          {setupLabels[setup]}
        </span>
      </div>

      <div className="text-2xl font-bold text-white">
        {passes}/{checklist.length}
        <span className="text-sm text-slate-400 ml-1">criteria met</span>
      </div>

      {mustFails.length > 0 && (
        <div className="bg-red-900/40 border border-red-700 rounded p-2 text-xs text-red-300">
          ❌ Must-have failures: {mustFails.map((c) => c.label).join("; ")}
        </div>
      )}
      {mustUnconfirmed.length > 0 && mustFails.length === 0 && (
        <div className="bg-slate-700/60 border border-slate-600 rounded p-2 text-xs text-slate-400">
          ⚠️ Needs chart verification: {mustUnconfirmed.map((c) => c.label).join("; ")}
        </div>
      )}

      <ul className="space-y-1.5">
        {checklist.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 flex-shrink-0 font-bold ${statusColor[item.status]}`}>
              {statusIcon[item.status]}
            </span>
            <span className={labelColor(item)}>
              {item.label}
              {item.mustHave && (
                <span className="ml-1 text-xs text-yellow-500 uppercase">MUST</span>
              )}
              {item.status === "borderline" && (
                <span className="ml-1 text-xs text-yellow-400">(borderline)</span>
              )}
              {item.status === "unconfirmed" && (
                <span className="ml-1 text-xs text-slate-500">(needs chart)</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-slate-700 pt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
        <div>EMA20: <span className="text-white">{indicators.ema20.toFixed(2)}</span></div>
        <div>EMA50: <span className="text-white">{indicators.ema50.toFixed(2)}</span></div>
        <div>RSI: <span className="text-white">{indicators.rsi.toFixed(1)}</span></div>
        <div>CMF: <span className={indicators.cmfVal > 0 ? "text-green-400" : indicators.cmfVal >= -0.10 ? "text-yellow-400" : "text-red-400"}>{indicators.cmfVal.toFixed(3)}</span></div>
        <div>DI+: <span className="text-white">{indicators.diPlus.toFixed(1)}</span></div>
        <div>DI-: <span className="text-white">{indicators.diMinus.toFixed(1)}</span></div>
        <div>ADX: <span className="text-white">{indicators.adx.toFixed(1)}</span></div>
        <div>Price: <span className="text-white">${indicators.price.toFixed(2)}</span></div>
      </div>
    </div>
  );
}
