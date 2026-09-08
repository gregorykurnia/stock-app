"use client";

import { use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const BreakoutChartView = dynamic(() => import("@/components/BreakoutChartView"), { ssr: false });

export default function BreakoutChartPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const sym = ticker.toUpperCase();

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h1 className="text-lg font-semibold text-slate-100">{sym} — Daily Chart</h1>
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-100">
          ← Back
        </Link>
      </div>
      <BreakoutChartView ticker={sym} />
    </div>
  );
}
