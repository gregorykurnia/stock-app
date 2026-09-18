import type { Metadata } from "next";
import PersonalFinanceDashboard from "@/components/PersonalFinanceDashboard";

export const metadata: Metadata = { title: "Personal Finance · Stock Analysis" };

export default function PersonalFinancePage() {
  return (
    <main className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
      <PersonalFinanceDashboard />
    </main>
  );
}
