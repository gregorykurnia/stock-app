"use client";

import { useState } from "react";
import type { Verdict } from "@/lib/types";

const urgencyStyles: Record<string, string> = {
  urgent: "bg-green-600 text-white",
  watch: "bg-yellow-500 text-black",
  hold: "bg-blue-600 text-white",
  avoid: "bg-red-600 text-white",
};

interface BusinessQuality {
  biz_model: { score: number; desc: string };
  demand: { score: number; desc: string };
  moat: { score: number; desc: string };
  mgmt: { score: number; desc: string };
  overall: number;
  generated_at?: string;
}

interface Props {
  ticker: string;
  verdict: Verdict;
  businessQuality: BusinessQuality;
  onReanalyze: () => void;
  reanalyzing: boolean;
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-700 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full bg-blue-500"
          style={{ width: `${(score / 10) * 100}%` }}
        />
      </div>
      <span className="text-white font-semibold text-sm w-6 text-right">{score}</span>
    </div>
  );
}

export default function VerdictCard({ ticker, verdict, businessQuality, onReanalyze, reanalyzing }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className="bg-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">AI Verdict — {ticker}</h2>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${urgencyStyles[verdict.urgency] ?? "bg-slate-600 text-white"}`}>
              {verdict.urgency}
            </span>
            <button
              onClick={onReanalyze}
              disabled={reanalyzing}
              className="text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 px-2.5 py-1 rounded transition-colors disabled:opacity-40"
            >
              {reanalyzing ? "Analyzing…" : "Re-analyze"}
            </button>
          </div>
        </div>

        <div className="text-slate-200 text-sm leading-relaxed">{verdict.verdict_text}</div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-700/50 rounded p-2.5">
            <div className="text-slate-400 text-xs mb-1">Entry Zone</div>
            <div className="text-green-400 font-semibold">{verdict.entry_zone}</div>
          </div>
          <div className="bg-slate-700/50 rounded p-2.5">
            <div className="text-slate-400 text-xs mb-1">Checklist Score</div>
            <div className="text-white font-semibold">{verdict.checklist_score}</div>
          </div>
          <div className="bg-slate-700/50 rounded p-2.5">
            <div className="text-slate-400 text-xs mb-1">Stop EMA20</div>
            <div className="text-red-400 font-semibold">${verdict.stop_ema20?.toFixed(2)}</div>
          </div>
          <div className="bg-slate-700/50 rounded p-2.5">
            <div className="text-slate-400 text-xs mb-1">Stop EMA50</div>
            <div className="text-red-400 font-semibold">${verdict.stop_ema50?.toFixed(2)}</div>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded p-2.5 text-sm">
          <div className="text-slate-400 text-xs mb-1">Position Sizing</div>
          <div className="text-white">{verdict.position_sizing}</div>
        </div>

        {verdict.must_have_failures?.length > 0 && (
          <div className="bg-red-900/40 border border-red-700 rounded p-2 text-xs text-red-300">
            ⚠ Must-have failures: {verdict.must_have_failures.join(", ")}
          </div>
        )}

        <div className="text-xs text-slate-500">
          Setup: <span className="text-slate-400">{verdict.setup?.replace("_", " ")}</span>
          {verdict.date && <> · {new Date(verdict.date).toLocaleDateString()}</>}
        </div>
      </div>

      {/* Business Quality */}
      <div className="bg-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Business Quality</h2>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{businessQuality.overall}</span>
            <span className="text-slate-500 text-sm">/10</span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-slate-400 hover:text-white ml-2"
            >
              {expanded ? "▲ less" : "▼ more"}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {(["biz_model", "demand", "moat", "mgmt"] as const).map((key) => {
            const labels = { biz_model: "Business Model", demand: "Market Demand", moat: "Moat", mgmt: "Management" };
            const dim = businessQuality[key];
            return (
              <div key={key}>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>{labels[key]}</span>
                </div>
                <ScoreBar score={dim.score} />
                {expanded && (
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{dim.desc}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
