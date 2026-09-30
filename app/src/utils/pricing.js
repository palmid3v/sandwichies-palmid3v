// Intentional UI import boundary: calculations remain authoritative in shared/.
export {
  calculateInventoryConsumption,
  calculateLineItem,
  calculateOrderTotals,
  normalizeLineSelection,
  OrderValidationError,
} from "../../shared/pricing.js";
