// Single catalog source for the customer app, order function and admin estimates.
// Costs are COP for the purchase quantity shown below; consumption is per 15 cm portion.
export const CATALOG = {
  sizes: {
    "15": { label: "15 cm", multiplier: 1, breadCost: 1750 },
    "30": { label: "30 cm", multiplier: 2, breadCost: 3500 },
  },
  ingredients: [
    { id: "base", name: "Base y salsas", unit: "porción", packageCost: 1000, packageQuantity: 1, portionQuantity: 1, stockQuantity: 1 },
    { id: "mozzarella", name: "Mozzarella incluida", unit: "porción", packageCost: 555, packageQuantity: 1, portionQuantity: 1, stockQuantity: 1 },
    { id: "pimenton-asado", name: "Pimentón asado", unit: "g", packageCost: 6490, packageQuantity: 150, portionQuantity: 30, stockQuantity: 150 },
    { id: "jamon-serrano", name: "Jamón serrano", unit: "unidad", packageCost: 8700, packageQuantity: 5, portionQuantity: 1, stockQuantity: 5, type: "protein" },
    { id: "pavo-finas-hierbas", name: "Jamón de Pavo Finas Hierbas", unit: "unidad", packageCost: 13150, packageQuantity: 20, portionQuantity: 10, stockQuantity: 20, type: "protein" },
    { id: "jamon-asado", name: "Jamón asado", unit: "unidad", packageCost: 9900, packageQuantity: 6, portionQuantity: 1, stockQuantity: 6, type: "protein" },
    { id: "pechuga-pavo", name: "Jamón pechuga de pavo", unit: "unidad", packageCost: 12300, packageQuantity: 22, portionQuantity: 2, stockQuantity: 22, type: "protein" },
    { id: "pepperoni", name: "Pepperoni", unit: "unidad", packageCost: 4990, packageQuantity: 39, portionQuantity: 3, stockQuantity: 39, type: "protein" },
    { id: "chorizo", name: "Chorizo", unit: "unidad", packageCost: 4200, packageQuantity: 9, portionQuantity: 1, stockQuantity: 9, type: "protein" },
    { id: "salami", name: "Salami", unit: "unidad", packageCost: 4200, packageQuantity: 9, portionQuantity: 1, stockQuantity: 9, type: "protein" },
    { id: "queso-extra", name: "Queso extra", unit: "porción", packageCost: 9990, packageQuantity: 18, portionQuantity: 1, stockQuantity: 18, type: "extra" },
  ],
  toppings: [
    { id: "pimenton", name: "Pimentón", ingredientId: "pimenton-asado", portionMultiplier: 1, customerCharge: 0 },
  ],
  extras: [
    { id: "queso-extra", name: "Queso extra", ingredientId: "queso-extra", customerCharge: 1000 },
    { id: "doble-proteina", name: "Doble proteína", proteinMultiplier: 2, customerCharge: 3000 },
  ],
  defaultBase: ["Lechuga", "Pimentón Asado", "Cebolla", "Salsa tomate", "Mayonesa", "Mostaza"],
  priceMarkup: 1.75,
  roundingIncrement: 1000,
  roundingOffset: 100,
};

export const getIngredient = (id) => CATALOG.ingredients.find((item) => item.id === id);
export const getProtein = (id) => {
  const ingredient = getIngredient(id);
  return ingredient?.type === "protein" ? ingredient : undefined;
};
export const getTopping = (id) => CATALOG.toppings.find((item) => item.id === id);
export const getExtra = (id) => CATALOG.extras.find((item) => item.id === id);
