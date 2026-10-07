import type { Metadata } from "next";
import Link from "next/link";
import ETFExplorer from "@/components/ETFExplorer";
import {
  ETF_CATALOG,
  ETF_CATALOG_COUNTS,
  ETF_CATEGORY_META,
  ETF_ETNS,
  ETF_EXCLUSIONS,
  ETF_SNAPSHOT_DATE,
  type ETFMetricSnapshot,
} from "@/lib/etfCatalog";
import { getETFMetricSnapshots } from "@/lib/etfMetricStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "ETF Catalogue · Stock Analysis",
  description: "Browse and compare the public ETF and ETN catalogue observed on Pluang.",
};

export default async function ETFPage() {
  let initialMetricSnapshots: Record<string, ETFMetricSnapshot> = {};
  let initialMetricLoadError = false;
  try {
    const storedSnapshots = await getETFMetricSnapshots();
    // Freshness is relative to the server request that renders this page.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    initialMetricSnapshots = Object.fromEntries(Object.entries(storedSnapshots).map(([ticker, snapshot]) => [ticker, {
      ...snapshot,
      stale: !snapshot.observedAt || now - new Date(snapshot.observedAt).getTime() > 5 * 24 * 60 * 60 * 1000,
      scoreStale: !snapshot.scoreObservedAt || now - new Date(snapshot.scoreObservedAt).getTime() > 5 * 24 * 60 * 60 * 1000,
    }]));
  } catch (error) {
    console.error("[etf] failed to load stored metric snapshots", error);
    initialMetricLoadError = true;
  }

  return (
    <main className="mx-auto w-full max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-wrap justify-end gap-2"><Link href="/etf/free-core-trial" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">VOO / VXUS · Free Core trial →</Link><Link href="/etf/equity-index-validation" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100">Broad equity-index validation batch →</Link></div>
      <ETFExplorer
        catalogue={ETF_CATALOG}
        etns={ETF_ETNS}
        exclusions={ETF_EXCLUSIONS}
        categoryMeta={ETF_CATEGORY_META}
        counts={ETF_CATALOG_COUNTS}
        snapshotDate={ETF_SNAPSHOT_DATE}
        initialMetricSnapshots={initialMetricSnapshots}
        initialMetricLoadError={initialMetricLoadError}
      />
    </main>
  );
}
