"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const BreakoutChartView = dynamic(() => import("@/components/BreakoutChartView"), { ssr: false });

export default function BreakoutChartPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const sym = ticker.toUpperCase();
  const router = useRouter();
  const [input, setInput] = useState("");

  const goToTicker = () => {
    const next = input.trim().toUpperCase();
    if (!next || next === sym) return;
    router.push(`/breakout-chart/${next}`);
    setInput("");
  };

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 gap-4 sticky top-0 z-30 bg-[#0f172a]">
        <h1 className="text-lg font-semibold text-slate-100 shrink-0">{sym} — Daily Chart</h1>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && goToTicker()}
          placeholder="Jump to ticker…"
          className="bg-slate-800 border border-slate-600 rounded px-2.5 py-1 text-sm text-slate-100 placeholder:text-slate-500 w-40 uppercase focus:outline-none focus:border-slate-400"
        />
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-100 shrink-0">
          ← Back
        </Link>
      </div>
      <BreakoutChartView ticker={sym} />
    </div>
  );
}
