"use client";

import type { LatestIndicators, HistoricalArrays, SetupType, ChecklistItem } from "@/lib/types";
import { atrLabel } from "@/lib/indicators";

function detectSetup(ind: LatestIndicators): SetupType {
  const ema20VsEma50 = (ind.ema20 - ind.ema50) / ind.ema50;
  const priceVsEma20 = (ind.price - ind.ema20) / ind.ema20;
  if (ema20VsEma50 < -0.10) return "beaten_down";
  if (ind.ema20 > ind.ema50 && priceVsEma20 > 0.20) return "parabolic";
  // Everything else — EMA20 near/crossing EMA50, choppy price — treated as pullback
  // The checklist indicators will naturally surface poor internals
  return "pullback";
}

function obvPatternToStatus(pattern: HistoricalArrays["obv_analysis"]["pattern"]): "pass" | "fail" | "unconfirmed" {
  if (pattern === "higher_low_forming" || pattern === "clean_staircase") return "pass";
  if (pattern === "flat_sideways") return "unconfirmed";
  return "fail"; // lower_low, sustained_downtrend, parabolic_rollover
}


function detectEma20Turning(ema20: number[]): "pass" | "fail" | "unconfirmed" {
  if (ema20.length < 4) return "unconfirmed";
  // Compare slope of last 3 bars vs 3 bars before that
  const recent = ema20.slice(-3);
  const prior = ema20.slice(-6, -3);
  if (prior.length < 3) return "unconfirmed";
  const recentSlope = recent[2] - recent[0];
  const priorSlope = prior[2] - prior[0];
  // EMA20 is turning up if recent slope is positive and/or improving vs prior slope
  if (recentSlope > 0) return "pass";
  if (recentSlope > priorSlope * 0.5) return "pass"; // flattening out after steep decline
  return "fail";
}

function buildChecklist(
  setup: SetupType,
  ind: LatestIndicators,
  hist: HistoricalArrays
): ChecklistItem[] {
  if (setup === "beaten_down") {
    const obvStatus = obvPatternToStatus(hist.obv_analysis.pattern);
    const cmfStatus = ind.cmfVal > 0 ? "pass" : ind.cmfVal >= -0.10 ? "borderline" : "fail";
    const diStatus = ind.diPlus > ind.diMinus + 2 ? "pass" : ind.diPlus >= ind.diMinus - 2 ? "borderline" : "fail";
    const rsiStatus = ind.rsi >= 40 && ind.rsi <= 55 ? "pass" : ind.rsi < 40 ? "fail" : "borderline";
    const ema20Status = detectEma20Turning(hist.ema20_history);
    return [
      { label: "OBV higher low", mustHave: true, status: obvStatus },
      { label: "CMF above zero", mustHave: true, status: cmfStatus },
      { label: "DI+ above DI-", mustHave: true, status: diStatus },
      { label: "RSI 40–55 (recovery range)", mustHave: false, status: rsiStatus },
      { label: "EMA20 turning upward", mustHave: false, status: ema20Status },
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
  // pullback (covers all remaining cases including choppy/sideways)
  {
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
}

const statusIcon: Record<string, string> = {
  pass: "✓",
  fail: "✗",
  borderline: "~",
  unconfirmed: "?",
};

const statusColor: Record<string, string> = {
  pass: "text-green-600",
  fail: "text-red-500",
  borderline: "text-yellow-600",
  unconfirmed: "text-gray-400",
};

const labelColor = (item: ChecklistItem) => {
  if (item.status === "fail" && item.mustHave) return "text-red-600 font-semibold";
  if (item.status === "borderline") return "text-yellow-600";
  if (item.status === "unconfirmed") return "text-gray-400 italic";
  return "text-gray-700";
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
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Setup Checklist</h2>
        <span className="text-xs bg-gray-100 border border-gray-200 px-2 py-1 rounded text-gray-600">
          {setupLabels[setup]}
        </span>
      </div>

      <div className="text-2xl font-bold text-gray-900">
        {passes}/{checklist.length}
        <span className="text-sm text-gray-400 ml-1">criteria met</span>
      </div>

      {mustFails.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-600">
          ❌ Must-have failures: {mustFails.map((c) => c.label).join("; ")}
        </div>
      )}
      {mustUnconfirmed.length > 0 && mustFails.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-500">
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

      <div className="border-t border-gray-200 pt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
        <div>EMA20: <span className="text-gray-900">{indicators.ema20.toFixed(2)}</span></div>
        <div>EMA50: <span className="text-gray-900">{indicators.ema50.toFixed(2)}</span></div>
        <div>RSI: <span className="text-gray-900">{indicators.rsi.toFixed(1)}</span></div>
        <div>CMF: <span className={indicators.cmfVal > 0 ? "text-green-600" : indicators.cmfVal >= -0.10 ? "text-yellow-600" : "text-red-500"}>{indicators.cmfVal.toFixed(3)}</span></div>
        <div>DI+: <span className="text-gray-900">{indicators.diPlus.toFixed(1)}</span></div>
        <div>DI-: <span className="text-gray-900">{indicators.diMinus.toFixed(1)}</span></div>
        <div>ADX: <span className="text-gray-900">{indicators.adx.toFixed(1)}</span></div>
        <div>Price: <span className="text-gray-900">${indicators.price.toFixed(2)}</span></div>
        {indicators.atrPct > 0 && (() => {
          const al = atrLabel(indicators.atrPct);
          return (
            <div className="col-span-2">
              ATR%: <span className={`font-semibold ${al.color}`}>{indicators.atrPct.toFixed(1)}% — {al.label}</span>
              <span className="text-gray-400 ml-1">({al.description})</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
