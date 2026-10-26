import { isCompletedSale } from "./business.js";

export const DEFAULT_LOYALTY_RULE = Object.freeze({
  type: "loyalty",
  enabled: false,
  qualifyingPurchaseCount: 3,
  minimumOrderAmountCop: 0,
  rewardAmountCop: 0,
  rewardExpiryDays: 90,
  currency: "COP",
});

export const DEFAULT_REFERRAL_RULE = Object.freeze({
  type: "referral",
  enabled: false,
  minimumOrderAmountCop: 0,
  inviterRewardAmountCop: 0,
  inviteeRewardAmountCop: 0,
  rewardExpiryDays: 90,
  currency: "COP",
});

const isNonNegativeInteger = (value) =>
  Number.isSafeInteger(value) && value >= 0;

const isPositiveInteger = (value) =>
  Number.isSafeInteger(value) && value > 0;

export class PromotionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PromotionValidationError";
  }
}

/**
 * Validate a loyalty rule before saving or applying it.
 * A zero reward amount is permitted only while the rule remains disabled.
 */
export const validateLoyaltyRule = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PromotionValidationError("La regla de fidelización es inválida.");
  }

  const rule = { ...DEFAULT_LOYALTY_RULE, ...input, type: "loyalty" };
  if (typeof rule.enabled !== "boolean") {
    throw new PromotionValidationError("El estado de la regla es inválido.");
  }
  if (!isPositiveInteger(rule.qualifyingPurchaseCount)) {
    throw new PromotionValidationError("La cantidad de compras debe ser un entero positivo.");
  }
  if (!isNonNegativeInteger(rule.minimumOrderAmountCop)) {
    throw new PromotionValidationError("La compra mínima debe ser un entero en COP.");
  }
  if (!isNonNegativeInteger(rule.rewardAmountCop)) {
    throw new PromotionValidationError("El crédito debe ser un entero en COP.");
  }
  if (rule.enabled && rule.rewardAmountCop < 1) {
    throw new PromotionValidationError("Configura un crédito mayor que cero antes de activar la regla.");
  }
  if (!isPositiveInteger(rule.rewardExpiryDays)) {
    throw new PromotionValidationError("La vigencia debe ser un entero positivo.");
  }
  if (rule.currency !== "COP") {
    throw new PromotionValidationError("La moneda admitida en esta versión es COP.");
  }

  return rule;
};

/**
 * Only trusted order data should be passed to this function.
 * The caller must load the order from Firestore and supply the authenticated
 * customer's stable identity separately; client-provided UIDs are not trusted.
 */
export const isEligiblePromotionPurchase = ({
  order,
  customerUid,
  rule,
}) => {
  if (!order || typeof order !== "object" || !rule || rule.enabled !== true) {
    return false;
  }
  if (typeof customerUid !== "string" || !customerUid.trim()) return false;
  if (!isCompletedSale(order)) return false;

  const amount = order.total ?? order.subtotal;
  if (!isNonNegativeInteger(amount)) return false;
  if (!isNonNegativeInteger(rule.minimumOrderAmountCop)) return false;

  return amount >= rule.minimumOrderAmountCop;
};

/**
 * Return the loyalty milestones crossed by an update. Each milestone must
 * produce its own deterministic reward ID in the persistence layer.
 */
export const getLoyaltyMilestonesCrossed = (
  previousCount,
  nextCount,
  qualifyingPurchaseCount = DEFAULT_LOYALTY_RULE.qualifyingPurchaseCount,
) => {
  if (!isNonNegativeInteger(previousCount) || !isNonNegativeInteger(nextCount)) {
    throw new PromotionValidationError("El progreso de compras es inválido.");
  }
  if (!isPositiveInteger(qualifyingPurchaseCount)) {
    throw new PromotionValidationError("La frecuencia de recompensa es inválida.");
  }
  if (nextCount < previousCount) {
    throw new PromotionValidationError("El progreso de compras no puede retroceder.");
  }

  const previousMilestone = Math.floor(previousCount / qualifyingPurchaseCount);
  const nextMilestone = Math.floor(nextCount / qualifyingPurchaseCount);
  return Array.from(
    { length: nextMilestone - previousMilestone },
    (_, index) => (previousMilestone + index + 1) * qualifyingPurchaseCount,
  );
};

export const buildPromotionIdempotencyKey = ({
  kind,
  sourceId,
  customerUid,
  milestone,
}) => {
  if (![kind, sourceId, customerUid].every(
    (value) => typeof value === "string" && value.trim(),
  )) {
    throw new PromotionValidationError("Faltan datos para la clave de idempotencia.");
  }
  if (milestone !== undefined && !isPositiveInteger(milestone)) {
    throw new PromotionValidationError("El hito de recompensa es inválido.");
  }

  return [
    "promotion",
    kind.trim(),
    sourceId.trim(),
    customerUid.trim(),
    milestone === undefined ? "single" : String(milestone),
  ].join(":");
};

export const calculateRewardExpiry = (issuedAt, expiryDays = 90) => {
  const issuedDate = issuedAt instanceof Date ? new Date(issuedAt) : new Date(issuedAt);
  if (Number.isNaN(issuedDate.getTime()) || !isPositiveInteger(expiryDays)) {
    throw new PromotionValidationError("La fecha o vigencia de la recompensa es inválida.");
  }
  issuedDate.setUTCDate(issuedDate.getUTCDate() + expiryDays);
  return issuedDate;
};

/**
 * Build the immutable domain payload for a newly earned reward.
 * Persistence must happen on the trusted server in a transaction.
 */
export const buildRewardRecord = ({
  customerUid,
  source,
  sourceId,
  amountCop,
  issuedAt,
  expiryDays = 90,
  idempotencyKey,
}) => {
  if (![customerUid, source, sourceId, idempotencyKey].every(
    (value) => typeof value === "string" && value.trim(),
  )) {
    throw new PromotionValidationError("La recompensa no tiene un origen válido.");
  }
  if (!isPositiveInteger(amountCop)) {
    throw new PromotionValidationError("El importe de la recompensa debe ser mayor que cero.");
  }

  const issuedDate = issuedAt instanceof Date ? new Date(issuedAt) : new Date(issuedAt);
  if (Number.isNaN(issuedDate.getTime())) {
    throw new PromotionValidationError("La fecha de concesión es inválida.");
  }

  return {
    customerUid: customerUid.trim(),
    source: source.trim(),
    sourceId: sourceId.trim(),
    amountCop,
    currency: "COP",
    status: "available",
    idempotencyKey: idempotencyKey.trim(),
    issuedAt: issuedDate,
    expiresAt: calculateRewardExpiry(issuedDate, expiryDays),
  };
};
