import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LOYALTY_RULE,
  PromotionValidationError,
  buildPromotionIdempotencyKey,
  buildRewardRecord,
  calculateRewardExpiry,
  getLoyaltyMilestonesCrossed,
  isEligiblePromotionPurchase,
  validateLoyaltyRule,
} from "../shared/promotions.js";

const completedOrder = {
  status: "entregado",
  payment: { status: "pagado" },
  total: 25000,
};

test("loyalty rule defaults to disabled until a reward amount is configured", () => {
  assert.equal(DEFAULT_LOYALTY_RULE.enabled, false);
  assert.equal(DEFAULT_LOYALTY_RULE.qualifyingPurchaseCount, 3);
  assert.equal(DEFAULT_LOYALTY_RULE.rewardExpiryDays, 90);
  assert.throws(
    () => validateLoyaltyRule({ ...DEFAULT_LOYALTY_RULE, enabled: true }),
    PromotionValidationError,
  );
});

test("enabled loyalty rule requires positive COP reward and valid integer thresholds", () => {
  const rule = validateLoyaltyRule({
    ...DEFAULT_LOYALTY_RULE,
    enabled: true,
    rewardAmountCop: 5000,
    minimumOrderAmountCop: 15000,
  });
  assert.equal(rule.rewardAmountCop, 5000);
  assert.equal(rule.minimumOrderAmountCop, 15000);
  assert.throws(
    () => validateLoyaltyRule({ ...rule, rewardAmountCop: 0 }),
    PromotionValidationError,
  );
  assert.throws(
    () => validateLoyaltyRule({ ...rule, minimumOrderAmountCop: 1.5 }),
    PromotionValidationError,
  );
});

test("only delivered and paid orders meeting the minimum are eligible", () => {
  const rule = { enabled: true, minimumOrderAmountCop: 20000 };
  assert.equal(isEligiblePromotionPurchase({
    order: completedOrder, customerUid: "uid-1", rule,
  }), true);
  assert.equal(isEligiblePromotionPurchase({
    order: { ...completedOrder, status: "listo" }, customerUid: "uid-1", rule,
  }), false);
  assert.equal(isEligiblePromotionPurchase({
    order: { ...completedOrder, payment: { status: "pendiente" } },
    customerUid: "uid-1",
    rule,
  }), false);
  assert.equal(isEligiblePromotionPurchase({
    order: { ...completedOrder, total: 19999 }, customerUid: "uid-1", rule,
  }), false);
  assert.equal(isEligiblePromotionPurchase({
    order: completedOrder, customerUid: "", rule,
  }), false);
  assert.equal(isEligiblePromotionPurchase({
    order: completedOrder, customerUid: "uid-1", rule: { ...rule, enabled: false },
  }), false);
});

test("loyalty milestones occur on purchases 3, 6, 9 and every configured interval", () => {
  assert.deepEqual(getLoyaltyMilestonesCrossed(0, 2), []);
  assert.deepEqual(getLoyaltyMilestonesCrossed(2, 3), [3]);
  assert.deepEqual(getLoyaltyMilestonesCrossed(3, 8), [6]);
  assert.deepEqual(getLoyaltyMilestonesCrossed(8, 12), [9, 12]);
  assert.deepEqual(getLoyaltyMilestonesCrossed(0, 4, 2), [2, 4]);
});

test("loyalty milestones reject backwards progress and invalid counts", () => {
  assert.throws(() => getLoyaltyMilestonesCrossed(4, 3), PromotionValidationError);
  assert.throws(() => getLoyaltyMilestonesCrossed(-1, 3), PromotionValidationError);
  assert.throws(() => getLoyaltyMilestonesCrossed(0, 3, 0), PromotionValidationError);
});

test("idempotency keys are deterministic and distinguish reward milestones", () => {
  const base = { kind: "loyalty", sourceId: "order-3", customerUid: "uid-1" };
  assert.equal(
    buildPromotionIdempotencyKey(base),
    buildPromotionIdempotencyKey(base),
  );
  assert.notEqual(
    buildPromotionIdempotencyKey({ ...base, milestone: 3 }),
    buildPromotionIdempotencyKey({ ...base, milestone: 6 }),
  );
  assert.throws(
    () => buildPromotionIdempotencyKey({ ...base, customerUid: "" }),
    PromotionValidationError,
  );
});

test("reward expires 90 days after issuance using UTC calendar days", () => {
  const issuedAt = new Date("2026-01-01T12:00:00.000Z");
  assert.equal(
    calculateRewardExpiry(issuedAt, 90).toISOString(),
    "2026-04-01T12:00:00.000Z",
  );
});

test("reward record carries immutable source, amount and expiry data", () => {
  const reward = buildRewardRecord({
    customerUid: "uid-1",
    source: "loyalty",
    sourceId: "order-3",
    amountCop: 5000,
    issuedAt: "2026-01-01T12:00:00.000Z",
    expiryDays: 90,
    idempotencyKey: "promotion:loyalty:order-3:uid-1:3",
  });
  assert.equal(reward.customerUid, "uid-1");
  assert.equal(reward.amountCop, 5000);
  assert.equal(reward.currency, "COP");
  assert.equal(reward.status, "available");
  assert.equal(reward.expiresAt.toISOString(), "2026-04-01T12:00:00.000Z");
  assert.throws(
    () => buildRewardRecord({
      customerUid: "uid-1",
      source: "loyalty",
      sourceId: "order-3",
      amountCop: 0,
      issuedAt: new Date(),
      idempotencyKey: "key",
    }),
    PromotionValidationError,
  );
});
