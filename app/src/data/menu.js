import { calculateLineItem } from "../../shared/pricing.js";

const MENU_ITEMS = [
  { id: "turkey-finas-hierbas", name: "🌿 Turkey Finas Hierbas", proteins: [{ id: "pavo-finas-hierbas", quantity: 1 }] },
  { id: "explosivo", name: "🔥 Explosivo", proteins: [{ id: "chorizo", quantity: 1 }, { id: "salami", quantity: 1 }, { id: "pepperoni", quantity: 1 }] },
  { id: "doble-jamon", name: "🥓 Doble Jamón", proteins: [{ id: "jamon-asado", quantity: 1 }, { id: "jamon-serrano", quantity: 1 }] },
  { id: "spicy-mix", name: "🌶️ Spicy Mix", proteins: [{ id: "chorizo", quantity: 1 }, { id: "pepperoni", quantity: 1 }] },
  { id: "triple-stack", name: "💪 Triple Stack", proteins: [{ id: "jamon-asado", quantity: 1 }, { id: "jamon-serrano", quantity: 1 }, { id: "pepperoni", quantity: 1 }] },
  { id: "full-house", name: "👑 Full House", proteins: [{ id: "jamon-asado", quantity: 1 }, { id: "jamon-serrano", quantity: 1 }, { id: "chorizo", quantity: 1 }, { id: "salami", quantity: 1 }, { id: "pavo-finas-hierbas", quantity: 1 }, { id: "pechuga-pavo", quantity: 1 }, { id: "pepperoni", quantity: 1 }] },
];

export const MENU = MENU_ITEMS.map((item) => ({
  ...item,
  startingPrice: calculateLineItem({ size: "15", proteins: item.proteins, toppings: [], extras: [] }).price,
}));
