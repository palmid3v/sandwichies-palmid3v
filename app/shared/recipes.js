// Authoritative favorite recipes.
// Quantities are physical product units consumed by one 15 cm sandwich.
// The 30 cm size multiplies every recipe quantity by 2 in the pricing engine.
export const FAVORITES = [
  {
    id: "turkey-finas-hierbas",
    name: "🌿 Turkey Finas Hierbas",
    proteins: [
      { id: "pavo-finas-hierbas", quantity: 4 },
      { id: "pechuga-pavo", quantity: 4 },
    ],
    includedIngredients: [
      { id: "base", quantity: 1 },
    ],
  },
  {
    id: "explosivo",
    name: "🔥 Explosivo",
    proteins: [
      { id: "chorizo", quantity: 2 },
      { id: "salami", quantity: 2 },
      { id: "pepperoni", quantity: 9 },
    ],
    includedIngredients: [
      { id: "queso-tajado", quantity: 2 },
      { id: "base", quantity: 1 },
    ],
  },
  {
    id: "doble-jamon",
    name: "🥓 Doble Jamón",
    proteins: [
      { id: "pechuga-pavo", quantity: 4 },
      { id: "jamon-serrano", quantity: 2 },
    ],
    includedIngredients: [
      { id: "queso-tajado", quantity: 2 },
      { id: "base", quantity: 1 },
    ],
  },
  {
    id: "spicy-mix",
    name: "🌶️ Spicy Mix",
    proteins: [
      { id: "chorizo", quantity: 3 },
      { id: "pepperoni", quantity: 6 },
    ],
    includedIngredients: [
      { id: "queso-tajado", quantity: 2 },
      { id: "base", quantity: 1 },
    ],
  },
  {
    id: "triple-stack",
    name: "💪 Triple Stack",
    proteins: [
      { id: "pechuga-pavo", quantity: 4 },
      { id: "jamon-serrano", quantity: 2 },
      { id: "pepperoni", quantity: 6 },
    ],
    includedIngredients: [
      { id: "queso-tajado", quantity: 2 },
      { id: "base", quantity: 1 },
    ],
  },
  {
    id: "full-house",
    name: "👑 Full House",
    proteins: [
      { id: "pavo-finas-hierbas", quantity: 4 },
      { id: "pechuga-pavo", quantity: 4 },
      { id: "jamon-serrano", quantity: 2 },
      { id: "chorizo", quantity: 2 },
      { id: "salami", quantity: 2 },
      { id: "pepperoni", quantity: 6 },
      { id: "prosciutto", quantity: 1 },
    ],
    includedIngredients: [
      { id: "queso-tajado", quantity: 2 },
      { id: "base", quantity: 1 },
    ],
  },
];

export const getFavorite = (id) => FAVORITES.find((item) => item.id === id);
