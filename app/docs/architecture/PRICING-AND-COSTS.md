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


## Reconciliación con Excel — 2026-10-15

La hoja de costos del negocio es la fuente comercial para las seis recetas base. Los costos unitarios confirmados por compra son:

| Ingrediente | Costo paquete COP | Cantidad comprada | Unitario COP |
|---|---:|---:|---:|
| Pan 15 cm | 3.500 | 2 | 1.750 |
| Pavo finas hierbas | 13.950 | 20 | 697,50 |
| Pechuga de pavo | 12.300 | 22 | 559,09 |
| Jamón serrano | 8.700 | 6 | 1.450 |
| Chorizo | 4.200 | 9 | 466,67 |
| Salami | 4.200 | 9 | 466,67 |
| Pepperoni | 4.990 | 39 | 127,95 |
| Queso tajado | 9.300 | 15 | 620 |
| Mozzarella tajada | 10.500 | 18 | 583,33 |
| Prosciutto | 8.700 | 5 | 1.740 |
| Base (lechuga + cebolla) | 10.000 | 10 | 1.000 |

Las cantidades de las recetas de 15 cm se conservan en `shared/recipes.js`; el tamaño de 30 cm multiplica cantidades por dos. El motor conserva precisión durante el cálculo y redondea el costo final a pesos enteros. La fórmula de venta vigente no cambia: markup 1,75 y redondeo al siguiente millar menos $100.

Serrano Verde y Fuego Tropical no están incluidos en la hoja recibida. No deben considerarse reconciliados por ella. El costo de pimentón asado sigue pendiente de confirmación con una compra actual. La mozzarella se conserva como ingrediente predeterminado del configurador personalizado y no sustituye al queso tajado usado por las seis recetas de la hoja.
