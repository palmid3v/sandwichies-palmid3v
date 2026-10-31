import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";

// Keep storefront anonymous sessions isolated from administrator auth.
export const customerApp = initializeApp(firebaseConfig, "sandwichies-customer");
export const customerAuth = getAuth(customerApp);
export const customerDb = getFirestore(customerApp);
