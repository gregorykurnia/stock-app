import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { StoredRankingRun } from "@/lib/etfRankingRun";

// Stored runs live at etf_rankings/{cutoff} (plan Section 6). Only this module and the read route touch the collection.
const COLLECTION = "etf_rankings";

export async function getETFRankingRun(cutoff: string): Promise<StoredRankingRun | null> {
  const snapshot = await getDoc(doc(db, COLLECTION, cutoff));
  return snapshot.exists() ? snapshot.data() as StoredRankingRun : null;
}

// Refuses to replace a stored run with different inputs. A changed input needs a new method version or cutoff.
// The JSON round trip drops undefined values, which Firestore rejects.
export async function saveETFRankingRun(run: StoredRankingRun): Promise<"created" | "unchanged"> {
  const ref = doc(db, COLLECTION, run.cutoff);
  const payload = JSON.parse(JSON.stringify(run)) as StoredRankingRun;
  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists()) {
      const previous = existing.data() as StoredRankingRun;
      if (previous.inputHash === payload.inputHash) return "unchanged";
      throw new Error(`etf_rankings/${run.cutoff} already exists with a different input hash.`);
    }
    transaction.set(ref, payload);
    return "created";
  });
}
