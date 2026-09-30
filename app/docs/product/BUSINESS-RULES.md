# Reglas de negocio vigentes

- Tamaños permitidos: 15 cm y 30 cm; el tamaño aplica multiplicador y costo de pan configurados.
- Los favoritos usan recetas centralizadas en `shared/recipes.js`.
- Las recetas de favoritos se expresan en unidades físicas por sandwich de 15 cm.
- Una selección personalizada usa de una a siete proteínas distintas y de una a tres unidades por proteína.
- Una selección basada en favorito puede contener hasta 20 unidades por proteína para representar sus recetas actuales y permitir personalización.
- Toppings y extras se validan por ID de catálogo y no pueden duplicarse.
- Doble proteína duplica el consumo proteico y aplica un cargo de $3.000.
- Queso extra consume una unidad adicional de queso tajado y aplica el cargo configurado.
- Domicilio usa la tarifa de `shared/business.js`; recoger no agrega tarifa.
- El precio final conserva el markup 1.75 y el redondeo centralizado.
- Una orden nueva siempre inicia pendiente y con pago pendiente.
- Ventas completadas en el dashboard: `entregado` y `pagado`.
- Inventario es una capacidad estimada: no representa compras, desperdicio, reservas ni existencias reales.
