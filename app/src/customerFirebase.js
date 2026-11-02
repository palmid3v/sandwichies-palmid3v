// Compatibility shim: customer sessions now use the single shared Firebase app.
export { auth as customerAuth, db as customerDb } from "./firebase";
