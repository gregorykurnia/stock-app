import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const APP_NAME = "etf-equity-index-m4";
const EXPECTED_PROJECT_ID = "stock-app-898d1";

interface FirebaseServiceAccount {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

let firestore: Firestore | null = null;

/** Admin credentials stay in a non-public environment variable and are never logged. */
export function getETFEquityIndexM4Firestore(): Firestore {
  if (firestore) return firestore;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required for the M4 server-side Firestore store.");

  let serviceAccount: FirebaseServiceAccount;
  try {
    const parsed: unknown = JSON.parse(serviceAccountJson);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    serviceAccount = parsed as FirebaseServiceAccount;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain a valid Firebase service-account JSON object.");
  }
  if (serviceAccount.project_id !== EXPECTED_PROJECT_ID || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error(`The M4 Firestore credential must be a complete service account for ${EXPECTED_PROJECT_ID}.`);
  }
  const credential = {
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  };

  const existing = getApps().find((app) => app.name === APP_NAME);
  const app = existing ?? initializeApp({
    credential: cert(credential),
    projectId: EXPECTED_PROJECT_ID,
  }, APP_NAME);
  firestore = getFirestore(app);
  return firestore;
}
