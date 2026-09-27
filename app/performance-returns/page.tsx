import type { Metadata } from "next";
import PerformanceReturnsDashboard from "@/components/PerformanceReturnsDashboard";

export const metadata: Metadata = { title: "Performance Returns · Stock Analysis" };

export default function PerformanceReturnsPage() {
  return <main className="mx-auto w-full max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8"><PerformanceReturnsDashboard /></main>;
}
