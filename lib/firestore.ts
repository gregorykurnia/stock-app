import { doc, getDoc, setDoc, collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function loadStockData(ticker: string) {
  const ref = doc(db, "stocks", ticker);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveBusinessQuality(ticker: string, data: object) {
  const ref = doc(db, "stocks", ticker);
  await setDoc(ref, { business_quality: { ...data, generated_at: new Date().toISOString() } }, { merge: true });
}

export async function saveVerdict(ticker: string, verdict: object) {
  const dated = { ...verdict, date: new Date().toISOString() };

  // Save as latest
  const ref = doc(db, "stocks", ticker);
  await setDoc(ref, { latest_verdict: dated }, { merge: true });

  // Save to history
  const histRef = collection(db, "verdict_history", ticker, "snapshots");
  await addDoc(histRef, dated);
}
