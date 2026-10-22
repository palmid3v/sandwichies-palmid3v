import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

// Keep storefront anonymous sessions isolated from administrator auth.
const customerApp = initializeApp(firebaseConfig, "sandwichies-customer");
export const customerAuth = getAuth(customerApp);
