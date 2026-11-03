import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Vite development always uses the local Firestore Emulator. Authentication
// intentionally remains on Firebase Auth so real verified ID tokens can be
// exercised against the local Worker without touching production Firestore.
if (import.meta.env.DEV) {
  const configuredHost = String(import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").trim();
  const match = configuredHost.match(/^(localhost|127[.]0[.]0[.]1):([0-9]{2,5})$/);
  if (!match) {
    throw new Error("VITE_FIRESTORE_EMULATOR_HOST must point to localhost or 127.0.0.1 in Vite development.");
  }
  connectFirestoreEmulator(db, match[1], Number(match[2]));
} else if (import.meta.env.VITE_FIRESTORE_EMULATOR_HOST) {
  throw new Error("Firestore Emulator cannot be enabled in a production build.");
}
