import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const adminEmail = process.env.ADMIN_EMAIL?.trim();
const revoke = process.env.REVOKE_ADMIN === "true";

if (!adminEmail) {
  throw new Error("ADMIN_EMAIL is required. This script only updates an existing Firebase Auth user.");
}

initializeApp();
const auth = getAuth();

try {
  const user = await auth.getUserByEmail(adminEmail);
  const nextClaims = { ...(user.customClaims || {}) };

  if (revoke) {
    delete nextClaims.admin;
  } else {
    nextClaims.admin = true;
  }

  await auth.setCustomUserClaims(user.uid, nextClaims);
  console.log(`Admin claim ${revoke ? "revoked" : "assigned"} for the existing account.`);
  console.log("The user must sign in again or refresh their ID token before /admin reflects this change.");
} catch (error) {
  if (error.code === "auth/user-not-found") {
    throw new Error("No Firebase Auth user exists for ADMIN_EMAIL. No account was created or changed.");
  }
  throw error;
}
