import {
  BUSINESS,
  ORDER_STATUSES,
  canTransitionOrderStatus,
} from "../../shared/business.js";
import { buildOrderConsumption, normalizeInventoryTransaction, InventoryValidationError } from "../../shared/inventory.js";
import { buildTrustedOrder, OrderValidationError } from "../../shared/order-request.js";
import {
  findOperatingZone,
  isCompatibleVirtualTable,
  canTransitionDeliveryStatus,
  validatePolygon,
  VIRTUAL_TABLE_DEFAULTS,
} from "../../shared/virtual-tables.js";
import { FirestoreRest, FirestoreRestError } from "./firestore-rest.js";

export async function recordManualInventory({ payload, claims, env, db: injectedDb, cupboardDb: injectedCupboardDb }) {
  requireAdmin(claims);
  const db = injectedDb || createSandwichiesDb(env);
  let movement;
  try {
    movement = normalizeInventoryTransaction(payload);
  } catch (error) {
    if (error instanceof InventoryValidationError) throw new ApiError(400, "invalid-argument", error.message);
    throw error;
  }
  if (movement.type === "consumption") {
    throw new ApiError(400, "invalid-argument", "Los consumos se generan al confirmar pedidos.");
  }
  const operationId = typeof payload.operationId === "string" ? payload.operationId.trim() : "";
  const config = requireCupboard(env);
  const remoteDb = injectedCupboardDb || new FirestoreRest({
    projectId: config.projectId,
    serviceAccountJson: env.CUPBOARD_SERVICE_ACCOUNT_JSON,
  });
  let result;
  try {
    result = await applyCupboardManualMovement({
      db: remoteDb,
      config,
      operationId,
      line: movement,
    });
  } catch (error) {
    if (error instanceof CupboardWorkerError) throw new ApiError(409, error.code, error.message);
    throw error;
  }
  const balance = result.balances[0];
  const transactionId = "cupboard-manual-" + operationId;
  await db.runTransaction(async (tx) => {
    const movementPath = "inventoryTransactions/" + safeDocId(transactionId);
    const balancePath = "inventoryBalances/" + safeDocId(movement.ingredientId);
    const [existingMovement, existingBalance] = await Promise.all([
      tx.get(movementPath),
      tx.get(balancePath),
    ]);
    const localRevision = Number(existingBalance.data?.cupboardInventoryRevision ?? -1);
    if (!existingBalance.exists || balance.revision >= localRevision) {
      tx.set(balancePath, {
        ingredientId: movement.ingredientId,
        ingredientName: movement.ingredientName,
        unit: movement.unit,
        quantity: balance.quantity,
        cupboardInventoryRevision: balance.revision,
        updatedAt: nowDate(),
        updatedBy: claims.sub,
      });
    }
    if (!existingMovement.exists) {
      tx.create(movementPath, {
        ...movement,
        actorUid: claims.sub,
        source: "cupboard-sync",
        externalProductId: balance.productId,
        externalRevision: balance.revision,
        balanceAfter: balance.quantity,
        operationId,
        createdAt: nowDate(),
      });
    }
  });
  return {
    transactionId,
    balance: balance.quantity,
    source: "cupboard",
    applied: result.applied,
  };
}
