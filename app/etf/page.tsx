import type { Metadata } from "next";
import ETFExplorer from "@/components/ETFExplorer";
import {
  ETF_CATALOG,
  ETF_CATALOG_COUNTS,
  ETF_CATEGORY_META,
  ETF_ETNS,
  ETF_EXCLUSIONS,
  ETF_SNAPSHOT_DATE,
} from "@/lib/etfCatalog";

export const metadata: Metadata = {
  title: "ETF Catalogue · Stock Analysis",
  description: "Browse and compare the public ETF and ETN catalogue observed on Pluang.",
};

export default function ETFPage() {
  return (
    <main className="mx-auto w-full max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8">
      <ETFExplorer
        catalogue={ETF_CATALOG}
        etns={ETF_ETNS}
        exclusions={ETF_EXCLUSIONS}
        categoryMeta={ETF_CATEGORY_META}
        counts={ETF_CATALOG_COUNTS}
        snapshotDate={ETF_SNAPSHOT_DATE}
      />
    </main>
  );
}
