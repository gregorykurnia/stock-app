import type { Metadata } from "next";
import { Suspense } from "react";
import HeatmapDashboard from "@/components/heatmap/HeatmapDashboard";

export const metadata: Metadata = { title: "Market Heatmap · Stock Analysis" };

export default function HeatmapPage() {
  return <main className="mx-auto w-full max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8"><Suspense fallback={<div className="h-[600px] animate-pulse rounded-2xl bg-gray-200" aria-label="Loading market heatmap" />}><HeatmapDashboard /></Suspense></main>;
}
