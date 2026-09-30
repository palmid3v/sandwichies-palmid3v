# Costos y precios

Los costos de compra y las unidades disponibles viven en `shared/catalog.js`. Las recetas de favoritos viven en `shared/recipes.js`. `shared/pricing.js` es la fuente de verdad para el cálculo que usan la vista, la función de pedido y el inventario estimado.

## Catálogo

Cada ingrediente declara:

- `packageCost`: costo de compra.
- `packageQuantity`: cantidad comprada.
- `unit`: unidad del producto comprado.
- `portionQuantity`: unidades físicas consumidas por una cantidad de receta.
- `stockQuantity`: stock estimado comprado.
- `active`: si se ofrece actualmente en el selector.

La relación base es:

`packageCost / packageQuantity = costo unitario`

Los costos vigentes se basan en la última tabla de compra:

- Pan 30 cm: $3.500 / 2 = $1.750.
- Pavo finas hierbas: $13.950 / 20.
- Pechuga de pavo: $12.300 / 22.
- Jamón serrano: $8.700 / 6.
- Chorizo: $4.200 / 9.
- Salami: $4.200 / 9.
- Pepperoni: $4.990 / 39.
- Queso tajado: $9.300 / 15.
- Mozzarella: $10.500 / 18.
- Prosciutto: $8.700 / 5.
- Base: $10.000 / 10.

`pimenton-asado` mantiene temporalmente el costo previamente configurado porque no fue incluido en la nueva lista de compra.

## Recetas de favoritos

Las cantidades actuales de 15 cm están centralizadas en `shared/recipes.js`:

- Turkey Finas Hierbas: pavo FH x4, pechuga de pavo x4, base x1.
- Explosivo: chorizo x2, salami x2, pepperoni x9, queso tajado x2, base x1.
- Doble Jamón: pechuga de pavo x4, serrano x2, queso tajado x2, base x1.
- Spicy Mix: chorizo x3, pepperoni x6, queso tajado x2, base x1.
- Triple Stack: pechuga de pavo x4, serrano x2, pepperoni x6, queso tajado x2, base x1.
- Full House: pavo FH x4, pechuga de pavo x4, serrano x2, chorizo x2, salami x2, pepperoni x6, prosciutto x1, queso tajado x2, base x1.

El 30 cm usa multiplicador 2, por lo que duplica el pan y todas las cantidades de ingredientes/proteínas de la receta.

## Extras

- `queso-extra`: consume una unidad adicional de `queso-tajado` y cobra $1.000.
- `doble-proteina`: duplica el consumo de las proteínas seleccionadas y cobra $3.000.

## Precio y ganancia

Se mantiene sin cambios:

- `priceMarkup = 1.75`.
- Redondeo al siguiente múltiplo de $1.000 menos $100.
- Ganancia de la orden = total cobrado - costo estimado.

La ganancia calculada por este motor es ganancia bruta de producto. No incluye empaque, mano de obra, merma, servicios, impuestos u otros gastos que todavía no estén modelados.

No copies precios o fórmulas a componentes React ni a pruebas como fuente alternativa de verdad.
