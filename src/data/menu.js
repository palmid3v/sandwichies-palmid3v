import { calculateSalePrice, calculateTotalCost } from "../utils/pricing";
import { INGREDIENTS } from "./ingredients";

const MENU_ITEMS = [
  {
    name: "🌿 Turkey Finas Hierbas",
    proteins: [{ name: "Jamón de pavo finas hierbas", used: 2 }],
  },
  {
    name: "🔥 Explosivo",
    proteins: [
      { name: "Chorizo", used: 1 },
      { name: "Salami", used: 1 },
      { name: "Pepperoni", used: 3 },
    ],
  },
  {
    name: "🥓 Doble Jamón",
    proteins: [
      { name: "Jamón asado", used: 1 },
      { name: "Jamón serrano", used: 1 },
    ],
  },
  {
    name: "🌶️ Spicy Mix",
    proteins: [
      { name: "Chorizo", used: 1 },
      { name: "Pepperoni", used: 3 },
    ],
  },
  {
    name: "💪 Triple Stack",
    proteins: [
      { name: "Jamón asado", used: 1 },
      { name: "Jamón serrano", used: 1 },
      { name: "Pepperoni", used: 3 },
    ],
  },
  {
  name: "👑 Full House",
  proteins: [
    { name: "Jamón asado", used: 1 },
    { name: "Jamón serrano", used: 1 },
    { name: "Chorizo", used: 1 },
    { name: "Salami", used: 1 },
    { name: "Jamón de pavo finas hierbas", used: 1 },
    { name: "Jamón pechuga de pavo", used: 1 }, // 🔥 ESTE FALTABA
    { name: "Pepperoni", used: 3 }
  ]
},
];

export const MENU = MENU_ITEMS.map((item) => {
  const proteins = item.proteins
    .map((protein) => {
      const ingredient = INGREDIENTS.proteins.find(
        (candidate) => candidate.name === protein.name,
      );
      return ingredient ? { ...ingredient, used: protein.used } : null;
    })
    .filter(Boolean);
  const cost = calculateTotalCost({
    size: "15",
    proteins,
    toppings: [],
    extras: [],
    ingredients: INGREDIENTS,
  });

  return {
    ...item,
    startingPrice: calculateSalePrice({ totalCost: cost, extras: [] }),
  };
});
