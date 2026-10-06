import { calculateLineItem } from "../../shared/pricing.js";
import {
  DISCOVERY_SEGMENTS,
  FAVORITES,
  getFavoritesByDiscovery,
} from "../../shared/recipes.js";

const toMenuItem = (item) => {
  const preview = calculateLineItem({
    size: "15",
    favoriteId: item.id,
    proteins: item.proteins,
    toppings: item.toppings || [],
    extras: [],
  });

  return {
    ...item,
    startingPrice: preview.price,
  };
};

export const MENU = FAVORITES.map(toMenuItem);
export const MENU_SEGMENTS = DISCOVERY_SEGMENTS;

export const getMenuBySegment = (segment = "all") =>
  getFavoritesByDiscovery(segment).map(toMenuItem);
