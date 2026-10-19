export const normalizeColombianPhone = (value = "") => {
  const digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith("3")) return `+57${digits}`;
  return null;
};

export const isColombianMobile = (value = "") =>
  normalizeColombianPhone(value) !== null;
