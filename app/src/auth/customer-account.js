export async function createOrLinkCustomerAccount({
  auth,
  email,
  password,
  createAccount,
  linkAccount,
  createEmailCredential,
}) {
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail || !password) {
    throw new Error("Customer email and password are required.");
  }

  if (auth.currentUser?.isAnonymous === true) {
    const credential = createEmailCredential(normalizedEmail, password);
    return linkAccount(auth.currentUser, credential);
  }

  return createAccount(auth, normalizedEmail, password);
}
