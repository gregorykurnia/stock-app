"use client";

import { useState } from "react";
import {
  getScreenerDraft, importScreenerDraftEntries, updateScreenerDraftRanks, removeScreenerDraftEntry,
  getScreenerExcludedTickers, excludeScreenerTicker, excludeScreenerTickersBulk, unexcludeScreenerTicker,
  getScreenerExclusionOverrides, addScreenerExclusionOverride,
  getScreenerDraftBeatenDown, importScreenerDraftEntriesBeatenDown, updateScreenerDraftRanksBeatenDown, removeScreenerDraftEntryBeatenDown,
  getScreenerExcludedTickersBeatenDown, excludeScreenerTickerBeatenDown, excludeScreenerTickersBulkBeatenDown, unexcludeScreenerTickerBeatenDown,
} from "@/lib/firestore";
import ScreenerTab, { type ScreenerTabConfig } from "./ScreenerTab";

const SWING_CONFIG: ScreenerTabConfig = {
  apiRoute: "/api/screener",
  criteriaText: "Market cap ≥ $1B, 0-3% below 50-day high, sorted by market cap desc — same criteria as the finviz screener.",
  useStaticExclusions: true,
  getDraft: getScreenerDraft,
  importDraftEntries: importScreenerDraftEntries,
  removeDraftEntry: removeScreenerDraftEntry,
  updateDraftRanks: updateScreenerDraftRanks,
  getExcluded: getScreenerExcludedTickers,
  excludeTicker: excludeScreenerTicker,
  excludeTickersBulk: excludeScreenerTickersBulk,
  unexcludeTicker: unexcludeScreenerTicker,
  getExclusionOverrides: getScreenerExclusionOverrides,
  addExclusionOverride: addScreenerExclusionOverride,
};

const BEATEN_DOWN_CONFIG: ScreenerTabConfig = {
  apiRoute: "/api/screener-beatendown",
  criteriaText: "Market cap ≥ $1B, 40%+ below all-time high, sorted by market cap desc — same criteria as the finviz screener.",
  useStaticExclusions: false,
  getDraft: getScreenerDraftBeatenDown,
  importDraftEntries: importScreenerDraftEntriesBeatenDown,
  removeDraftEntry: removeScreenerDraftEntryBeatenDown,
  updateDraftRanks: updateScreenerDraftRanksBeatenDown,
  getExcluded: getScreenerExcludedTickersBeatenDown,
  excludeTicker: excludeScreenerTickerBeatenDown,
  excludeTickersBulk: excludeScreenerTickersBulkBeatenDown,
  unexcludeTicker: unexcludeScreenerTickerBeatenDown,
};

const MAIN_TABS = [
  { key: "swing", label: "Swing Screener", config: SWING_CONFIG },
  { key: "beatendown", label: "Beaten Down Screener", config: BEATEN_DOWN_CONFIG },
] as const;

export default function ScreenerDraftPage() {
  const [mainTab, setMainTab] = useState<(typeof MAIN_TABS)[number]["key"]>("swing");
  const active = MAIN_TABS.find((t) => t.key === mainTab)!;

  return (
    <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--foreground)]">Screener Draft</h1>
      </div>

      <div className="flex items-center gap-2 mb-6 text-sm border-b border-[var(--border)]">
        {MAIN_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key)}
            className={`px-4 py-2 font-medium border-b-2 -mb-px transition-colors ${
              mainTab === t.key
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ScreenerTab key={active.key} config={active.config} />
    </main>
  );
}
