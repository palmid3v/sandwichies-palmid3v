import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionOrderStatus,
  canTransitionPaymentStatus,
  isCompletedSale,
} from "../shared/business.js";

test("order status transitions follow the operational flow", () => {
  assert.equal(canTransitionOrderStatus("pendiente", "confirmado"), true);
  assert.equal(canTransitionOrderStatus("confirmado", "preparando"), true);
  assert.equal(canTransitionOrderStatus("preparando", "listo"), true);
  assert.equal(canTransitionOrderStatus("listo", "entregado"), true);
  assert.equal(canTransitionOrderStatus("pendiente", "cancelado"), true);

  assert.equal(canTransitionOrderStatus("pendiente", "listo"), false);
  assert.equal(canTransitionOrderStatus("entregado", "preparando"), false);
  assert.equal(canTransitionOrderStatus("cancelado", "confirmado"), false);
});

test("payment status is one-way for completed-sale accounting", () => {
  assert.equal(canTransitionPaymentStatus("pendiente", "pagado"), true);
  assert.equal(canTransitionPaymentStatus("pagado", "pendiente"), false);
  assert.equal(canTransitionPaymentStatus("pendiente", "pendiente"), true);
});

test("a completed sale requires delivery and payment", () => {
  assert.equal(
    isCompletedSale({ status: "entregado", payment: { status: "pagado" } }),
    true,
  );
  assert.equal(
    isCompletedSale({ status: "entregado", payment: { status: "pendiente" } }),
    false,
  );
  assert.equal(
    isCompletedSale({ status: "listo", payment: { status: "pagado" } }),
    false,
  );
});