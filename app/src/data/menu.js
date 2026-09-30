import { calculateLineItem } from "../../shared/pricing.js";
import { FAVORITES } from "../../shared/recipes.js";

export const MENU = FAVORITES.map((item) => {
  const preview = calculateLineItem({
    size: "15",
    favoriteId: item.id,
    proteins: item.proteins,
    toppings: [],
    extras: [],
  });

  return {
    ...item,
    startingPrice: preview.price,
  };
});
