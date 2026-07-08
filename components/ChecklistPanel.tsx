"use client";

import type { LatestIndicators, SetupType, ChecklistItem } from "@/lib/types";

function detectSetup(ind: LatestIndicators): SetupType {
  const ema20VsEma50 = (ind.ema20 - ind.ema50) / ind.ema50;
  const priceVsEma20 = (ind.price - ind.ema20) / ind.ema20;

  // Rule 1: EMA20 more than 10% below EMA50 → beaten down
  if (ema20VsEma50 < -0.10) return "beaten_down";

  // Rule 2: Price extended more than 20% above EMA20 and EMA20 above EMA50 → parabolic
  if (ind.ema20 > ind.ema50 && priceVsEma20 > 0.20) return "parabolic";

  // Rule 3: EMA20 above EMA50 and price pulled back → pullback
  if (ind.ema20 > ind.ema50) return "pullback";

  // Rule 4: EMAs tangled or no clear trend
  return "volatile";
}

function buildChecklist(setup: SetupType, ind: LatestIndicators): ChecklistItem[] {
  if (setup === "beaten_down") {
    return [
      { label: "OBV higher low (visual check needed)", mustHave: true, pass: ind.obv > 0 },
      { label: "CMF above zero", mustHave: true, pass: ind.cmfVal > 0 },
      { label: "RSI bullish divergence (visual check needed)", mustHave: true, pass: ind.rsi < 45 },
      { label: "DI+ cross above DI-", mustHave: false, pass: ind.diPlus > ind.diMinus },
      { label: "EMA20 cross above EMA50", mustHave: false, pass: ind.ema20 > ind.ema50 },
    ];
  }
  if (setup === "parabolic") {
    return [
      { label: "Price within 20% of EMA20 weekly", mustHave: true, pass: Math.abs((ind.price - ind.ema20) / ind.ema20) < 0.20 },
      { label: "RSI below 65", mustHave: true, pass: ind.rsi < 65 },
      { label: "OBV confirming (visual check needed)", mustHave: true, pass: true },
      { label: "ADX 25–45", mustHave: false, pass: ind.adx >= 25 && ind.adx <= 45 },
      { label: "EMA20 vs EMA50 gap under 25%", mustHave: false, pass: Math.abs((ind.ema20 - ind.ema50) / ind.ema50) < 0.25 },
    ];
  }
  // pullback (2B) default
  return [
    { label: "EMA20 above EMA50", mustHave: true, pass: ind.ema20 > ind.ema50 },
    { label: "OBV flat or rising (visual check needed)", mustHave: true, pass: true },
    { label: "DI+ above DI-", mustHave: true, pass: ind.diPlus > ind.diMinus },
    { label: "Price at or above EMA50", mustHave: false, pass: ind.price >= ind.ema50 },
    { label: "RSI 40–55", mustHave: false, pass: ind.rsi >= 40 && ind.rsi <= 55 },
    { label: "CMF above -0.15", mustHave: false, pass: ind.cmfVal > -0.15 },
  ];
}

interface Props {
  indicators: LatestIndicators;
}

export default function ChecklistPanel({ indicators }: Props) {
  const setup = detectSetup(indicators);
  const checklist = buildChecklist(setup, indicators);
  const passes = checklist.filter((c) => c.pass).length;
  const mustFails = checklist.filter((c) => c.mustHave && !c.pass);

  const setupLabels: Record<SetupType, string> = {
    beaten_down: "Beaten Down (40%+ off high)",
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
          ⚠ Must-have failures: {mustFails.map((c) => c.label).join("; ")}
        </div>
      )}

      <ul className="space-y-1.5">
        {checklist.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 flex-shrink-0 ${item.pass ? "text-green-400" : "text-red-400"}`}>
              {item.pass ? "✓" : "✗"}
            </span>
            <span className={`${!item.pass && item.mustHave ? "text-red-300 font-semibold" : "text-slate-300"}`}>
              {item.label}
              {item.mustHave && (
                <span className="ml-1 text-xs text-yellow-500 uppercase">MUST</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-slate-700 pt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
        <div>EMA20: <span className="text-white">{indicators.ema20.toFixed(2)}</span></div>
        <div>EMA50: <span className="text-white">{indicators.ema50.toFixed(2)}</span></div>
        <div>RSI: <span className="text-white">{indicators.rsi.toFixed(1)}</span></div>
        <div>CMF: <span className={indicators.cmfVal > 0 ? "text-green-400" : "text-red-400"}>{indicators.cmfVal.toFixed(3)}</span></div>
        <div>DI+: <span className="text-white">{indicators.diPlus.toFixed(1)}</span></div>
        <div>DI-: <span className="text-white">{indicators.diMinus.toFixed(1)}</span></div>
        <div>ADX: <span className="text-white">{indicators.adx.toFixed(1)}</span></div>
        <div>Price: <span className="text-white">${indicators.price.toFixed(2)}</span></div>
      </div>
    </div>
  );
}
