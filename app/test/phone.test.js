import test from "node:test";
import assert from "node:assert/strict";
import { isColombianMobile, normalizeColombianPhone } from "../shared/phone.js";

test("normalizes a valid Colombian mobile number to E.164", () => {
  assert.equal(normalizeColombianPhone("301 658 8055"), "+573016588055");
  assert.equal(normalizeColombianPhone("+57 301 658 8055"), "+573016588055");
  assert.equal(normalizeColombianPhone("573016588055"), "+573016588055");
});

test("rejects landline, short, long and malformed phone numbers", () => {
  assert.equal(normalizeColombianPhone("6016588055"), null);
  assert.equal(normalizeColombianPhone("301658805"), null);
  assert.equal(normalizeColombianPhone("301658805512"), null);
  assert.equal(normalizeColombianPhone("abc"), null);
  assert.equal(isColombianMobile("3016588055"), true);
  assert.equal(isColombianMobile("6016588055"), false);
});
