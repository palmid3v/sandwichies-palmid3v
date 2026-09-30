# Costos y precios

Actualiza valores solamente en `shared/catalog.js` (ingredientes/tamaños/extras) o `shared/business.js` (domicilio). Cada ingrediente declara `packageCost`, `packageQuantity`, `unit`, `portionQuantity` y `stockQuantity` estimado.

`packageCost / packageQuantity` produce costo unitario. La porción multiplicada por tamaño, cantidad y extras produce consumo. El costo de línea más cargos de extras usa el margen y redondeo configurados en `shared/pricing.js`. La misma salida `ingredientUsage` alimenta la estimación de inventario.

No copies precios a componentes React ni a pruebas como fuente de verdad.
