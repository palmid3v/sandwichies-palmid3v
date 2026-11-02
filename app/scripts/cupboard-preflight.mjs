import { CATALOG } from "../shared/catalog.js";

const projectId = String(process.env.CUPBOARD_PROJECT_ID || "").trim();
const householdId = String(process.env.CUPBOARD_HOUSEHOLD_ID || "").trim();
const runtimeProjectId = String(
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  process.env.FUNCTIONS_PROJECT_ID ||
  "",
).trim();
const rawMapping = String(process.env.CUPBOARD_INGREDIENT_MAP_JSON || "").trim();
const errors = [];
let mapping = Object.fromEntries(CATALOG.ingredients
  .filter((ingredient) => ingredient.active !== false && ingredient.cupboardProductId)
  .map((ingredient) => [ingredient.id, ingredient.cupboardProductId]));

if (!projectId) errors.push("Falta CUPBOARD_PROJECT_ID.");
if (!householdId || householdId.includes("/")) {
  errors.push("Falta CUPBOARD_HOUSEHOLD_ID o contiene un carácter inválido (/).");
}
if (runtimeProjectId && projectId && runtimeProjectId === projectId) {
  errors.push("CUPBOARD_PROJECT_ID debe ser distinto del proyecto de Sandwichies/Functions.");
}

if (rawMapping) {
  try {
    const overrides = JSON.parse(rawMapping);
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
      errors.push("CUPBOARD_INGREDIENT_MAP_JSON debe ser un objeto JSON { ingredienteId: productoId }.");
    } else {
      mapping = { ...mapping, ...overrides };
    }
  } catch {
    errors.push("CUPBOARD_INGREDIENT_MAP_JSON no contiene JSON válido.");
  }
}

const requiredIngredients = CATALOG.ingredients.filter(
  (ingredient) => ingredient.active !== false,
);
const missing = requiredIngredients.filter(
  (ingredient) => typeof mapping[ingredient.id] !== "string" || !mapping[ingredient.id].trim(),
);
const invalid = Object.entries(mapping).filter(
  ([ingredientId, productId]) =>
    !ingredientId.trim() ||
    typeof productId !== "string" ||
    !productId.trim() ||
    productId.includes("/"),
);
const mappedProductIds = requiredIngredients
  .map((ingredient) => mapping[ingredient.id])
  .filter((productId) => typeof productId === "string" && productId.trim());
const duplicateProductIds = [...new Set(
  mappedProductIds.filter((productId, index) => mappedProductIds.indexOf(productId) !== index),
)];
const invalidProductIds = requiredIngredients
  .filter((ingredient) => !/^N-[0-9]{7}$/.test(mapping[ingredient.id] || ""))
  .map((ingredient) => ingredient.id);

if (missing.length) {
  errors.push("Faltan " + missing.length + " ingredientes por mapear: " + missing.map((item) => item.id).join(", ") + ".");
}
if (invalid.length) {
  errors.push("Hay " + invalid.length + " asociaciones inválidas en el mapeo.");
}
if (duplicateProductIds.length) {
  errors.push("Hay productos de Cupboard asignados a más de un ingrediente: " + duplicateProductIds.join(", ") + ".");
}
if (invalidProductIds.length) {
  errors.push("Los ingredientes deben apuntar a IDs N- de siete dígitos: " + invalidProductIds.join(", ") + ".");
}

console.log("Sandwichies ↔ Cupboard — preflight de configuración");
console.log("Proyecto Cupboard: " + (projectId || "(sin configurar)"));
console.log("Hogar Cupboard: " + (householdId || "(sin configurar)"));
console.log("Ingredientes activos: " + requiredIngredients.length);
console.log("Asociaciones válidas detectadas: " + (requiredIngredients.length - missing.length - invalidProductIds.length));
console.log("Mapeo integrado en código: " + (rawMapping ? "con overrides de entorno" : "sí"));
console.log("Este chequeo no conecta con Firebase ni despliega servicios.");

if (errors.length) {
  console.error("\nConfiguración pendiente:");
  for (const error of errors) console.error("- " + error);
  process.exitCode = 1;
} else {
  console.log("\nPreflight correcto. Aún faltan las pruebas operativas contra los emuladores y la concesión de permisos IAM.");
}
