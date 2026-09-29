import { BUSINESS, ORDER_STATUSES, PAYMENT_METHODS } from "../../shared/business.js";

export { BUSINESS, ORDER_STATUSES, PAYMENT_METHODS };

export const formatMoney = (value = 0) =>
  new Intl.NumberFormat(BUSINESS.locale, {
    style: "currency",
    currency: BUSINESS.currency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
