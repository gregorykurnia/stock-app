import type { Metadata } from "next";
import MarketDashboard from "@/components/markets/MarketDashboard";

export const metadata: Metadata = { title: "Global Market Pulse · Stock Analysis" };

export default function MarketsPage() {
  return <main className="mx-auto w-full max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8"><MarketDashboard /></main>;
}
