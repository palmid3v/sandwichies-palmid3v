# TASK-SANDWICHES-003 — Cost Catalog & Favorite Recipes Update

**Date:** 2026-09-30

## Scope

Actualización del catálogo de costos y de las recetas de favoritos usando la información de compra más reciente proporcionada para Sandwichies.

## Updated purchase data

- Bread 30 cm: $3.500 / 2 = $1.750.
- Jamón Pavo F. Hierbas: $13.950 / 20.
- Jamón pechuga de pavo: $12.300 / 22.
- Jamón serrano: $8.700 / 6.
- Chorizo Vela: $4.200 / 9.
- Salami: $4.200 / 9.
- Pepperoni: $4.990 / 39.
- Queso tajado Vita Latti: $9.300 / 15.
- Mozzarella Latti: $10.500 / 18.
- Prosciutto Valdecava: $8.700 / 5.
- Base (lechuga + cebolla): $10.000 / 10.

`pimenton-asado` remains at its previous configured value because no updated purchase value was supplied.

## Recipe changes

15 cm favorite quantities now follow the supplied formulas:

- Turkey Finas Hierbas: pavo FH x4, pechuga de pavo x4, base x1.
- Explosivo: chorizo x2, salami x2, pepperoni x9, queso tajado x2, base x1.
- Doble Jamón: pechuga de pavo x4, serrano x2, queso tajado x2, base x1.
- Spicy Mix: chorizo x3, pepperoni x6, queso tajado x2, base x1.
- Triple Stack: pechuga de pavo x4, serrano x2, pepperoni x6, queso tajado x2, base x1.
- Full House: pavo FH x4, pechuga de pavo x4, serrano x2, chorizo x2, salami x2, pepperoni x6, prosciutto x1, queso tajado x2, base x1.

30 cm applies the existing multiplier of 2.

## Margin preservation

The pricing policy remains unchanged:

- Markup: 1.75x.
- Rounding: next $1.000 minus $100.
- Double protein: protein consumption x2 plus $3.000 charge.
- Extra cheese: one additional queso tajado plus $1.000 charge.

## Compatibility

`jamon-asado` remains as an inactive legacy catalog entry so older persisted orders can still resolve their historical identifier. New recipes use `prosciutto`.

## Pending cost data

The only ingredient with no new purchase value in this update is `pimenton-asado`; its previous configured value remains until a current purchase price is supplied.
