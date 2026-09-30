import { CATALOG } from "../../shared/catalog.js";

// UI view of the shared catalog. packageCost/packageQuantity and
// portionQuantity have one meaning everywhere: cost of the purchased quantity
// and quantity consumed by one 15 cm portion.
const withIngredient = (item) => ({
  ...item,
  unitCost: item.packageCost / item.packageQuantity,
  consumptionQuantity: item.portionQuantity,
});

export const INGREDIENTS = {
  proteins: CATALOG.ingredients.filter((item) => item.type === "protein").map(withIngredient),
  toppings: CATALOG.toppings.map((topping) => ({
    ...topping,
    ...withIngredient(CATALOG.ingredients.find((item) => item.id === topping.ingredientId)),
  })),
  extras: CATALOG.extras,
};
