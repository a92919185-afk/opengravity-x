import { initializeApp, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let db: Firestore;

export function getDatabase(): Firestore {
  if (!db) {
    let app: App;
    if (getApps().length === 0) {
      // Initialize using the default Firebase configuration.
      // E.g. relying on GOOGLE_APPLICATION_CREDENTIALS environment variable
      app = initializeApp();
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
  }
  return db;
}

export function closeDatabase(): void {
  // In typical Node.js scripts using firebase-admin, you do not need 
  // to explicitly close the connection. However, we leave this no-op
  // to remain compatible with existing gracefully shutdown handlers.
}
