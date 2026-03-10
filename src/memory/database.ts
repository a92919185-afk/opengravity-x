import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let db: Firestore;

export function getDatabase(): Firestore {
  if (!db) {
    let app: App;
    if (getApps().length === 0) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Cloud: parse JSON from env var directly (no file needed)
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        app = initializeApp({ credential: cert(serviceAccount) });
      } else {
        // Local: rely on GOOGLE_APPLICATION_CREDENTIALS file
        app = initializeApp();
      }
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
  }
  return db;
}

export function closeDatabase(): void {
  // No-op for compatibility with graceful shutdown handlers.
}
