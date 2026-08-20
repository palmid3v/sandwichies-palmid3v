export const SIZE_CONFIG = {
  "15": {
    label: "15 cm",
    ingredientMultiplier: 1,
    breadCost: 1750,
  },
  "30": {
    label: "30 cm",
    ingredientMultiplier: 2,
    breadCost: 3000,
  },
};

export const itemCost = (item, multiplier = 1) => {
  let base = 0;

  if (item.grams) {
    base = (item.price / item.grams) * item.usedGrams;
  } else {
    base = (item.price / item.units) * item.used;
  }

  return base * multiplier;
};

export const calculateTotalCost = ({
  size = "15",
  proteins,
  toppings,
  extras,
  ingredients,
}) => {
  const isDouble = extras.some((e) => e.name === "Doble proteína");
  const sizeConfig = SIZE_CONFIG[size] || SIZE_CONFIG["15"];
  const portionMultiplier = sizeConfig.ingredientMultiplier;
  const proteinMultiplier = portionMultiplier * (isDouble ? 2 : 1);

  const proteinsCost = proteins.reduce(
    (sum, p) => sum + itemCost(p, proteinMultiplier),
    0,
  );

  const defaultToppingsCost = itemCost({
    price: 6490,
    grams: 150,
    usedGrams: 30,
  }, portionMultiplier);

  const toppingsCost =
    defaultToppingsCost +
    toppings.reduce((sum, t) => sum + itemCost(t, portionMultiplier), 0);

  const extrasCost = extras.reduce((sum, e) => {
    if (e.name === "Queso extra") {
      return (
        sum +
        itemCost({
          price: e.cost,
          units: e.units,
          used: e.used,
        }, portionMultiplier)
      );
    }
    return sum;
  }, 0);

  return (
    sizeConfig.breadCost +
    ingredients.baseCost * portionMultiplier +
    ingredients.mozzarella * portionMultiplier +
    proteinsCost +
    toppingsCost +
    extrasCost
  );
};

export const calculateSalePrice = ({ totalCost, extras }) => {
  let extraCharges = 0;

  if (extras.some((e) => e.name === "Queso extra")) {
    extraCharges += 1000;
  }

  if (extras.some((e) => e.name === "Doble proteína")) {
    extraCharges += 3000;
  }

  const rawPrice = totalCost * 1.75 + extraCharges;

  const roundedPrice = Math.ceil(rawPrice / 1000) * 1000 - 100;

  return roundedPrice;
};

export const calculateOrderTotals = (items, deliveryFee = 0) => {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const cost = items.reduce((sum, item) => sum + item.cost, 0);
  const total = subtotal + deliveryFee;

  return {
    subtotal: Math.round(subtotal),
    deliveryFee: Math.round(deliveryFee),
    total: Math.round(total),
    cost: Math.round(cost),
    profit: Math.round(total - cost),
  };
};
