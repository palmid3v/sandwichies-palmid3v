// Single catalog source for the customer app, order function and admin estimates.
// Costs are COP for the purchase quantity shown below; consumption is per configured recipe unit.
export const CATALOG = {
  sizes: {
    "15": { label: "15 cm", multiplier: 1, breadCost: 1750 },
    "30": { label: "30 cm", multiplier: 2, breadCost: 3500 },
  },
  ingredients: [
    { id: "base", name: "Base (lechuga + cebolla)", unit: "porción", packageCost: 10000, packageQuantity: 10, portionQuantity: 1, stockQuantity: 10, active: true },
    { id: "mozzarella", name: "Queso mozzarella incluido", unit: "unidad", packageCost: 10500, packageQuantity: 18, portionQuantity: 1, stockQuantity: 18, active: true },
    { id: "pimenton-asado", name: "Pimentón asado", unit: "g", packageCost: 6490, packageQuantity: 150, portionQuantity: 30, stockQuantity: 150, active: true },

    { id: "jamon-serrano", name: "Jamón serrano Valdecava", unit: "unidad", packageCost: 8700, packageQuantity: 6, portionQuantity: 1, stockQuantity: 6, type: "protein", active: true },
    { id: "pavo-finas-hierbas", name: "Jamón de Pavo Finas Hierbas White Holland", unit: "unidad", packageCost: 13950, packageQuantity: 20, portionQuantity: 1, stockQuantity: 20, type: "protein", active: true },
    { id: "pechuga-pavo", name: "Jamón pechuga de pavo White Holland", unit: "unidad", packageCost: 12300, packageQuantity: 22, portionQuantity: 1, stockQuantity: 22, type: "protein", active: true },
    { id: "pepperoni", name: "Pepperoni tajado Valdecava", unit: "unidad", packageCost: 4990, packageQuantity: 39, portionQuantity: 1, stockQuantity: 39, type: "protein", active: true },
    { id: "chorizo", name: "Chorizo Vela Valdecava", unit: "unidad", packageCost: 4200, packageQuantity: 9, portionQuantity: 1, stockQuantity: 9, type: "protein", active: true },
    { id: "salami", name: "Chorizo Salami Valdecava", unit: "unidad", packageCost: 4200, packageQuantity: 9, portionQuantity: 1, stockQuantity: 9, type: "protein", active: true },
    { id: "prosciutto", name: "Prosciutto Valdecava", unit: "unidad", packageCost: 8700, packageQuantity: 5, portionQuantity: 1, stockQuantity: 5, type: "protein", active: true },

    // Historical compatibility for persisted orders from earlier versions.
    { id: "jamon-asado", name: "Jamón asado (legacy)", unit: "unidad", packageCost: 9900, packageQuantity: 6, portionQuantity: 1, stockQuantity: 6, type: "protein", active: false },

    { id: "queso-tajado", name: "Queso tajado Vita Latti", unit: "unidad", packageCost: 9300, packageQuantity: 15, portionQuantity: 1, stockQuantity: 15, active: true },
  ],
  toppings: [
    { id: "pimenton", name: "Pimentón", ingredientId: "pimenton-asado", portionMultiplier: 1, customerCharge: 0 },
  ],
  extras: [
    { id: "queso-extra", name: "Queso extra", ingredientId: "queso-tajado", customerCharge: 1000 },
    { id: "doble-proteina", name: "Doble proteína", proteinMultiplier: 2, customerCharge: 3000 },
  ],
  defaultBase: ["Lechuga", "Cebolla"],
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
