# Reglas de negocio vigentes

- Tamaños permitidos: 15 cm y 30 cm; el tamaño aplica su multiplicador y costo de pan configurados.
- Una línea tiene de una a siete proteínas distintas; cada una puede tener de una a tres porciones.
- Toppings y extras se validan por ID de catálogo y no pueden duplicarse.
- Doble proteína duplica el consumo proteico y aplica su cargo configurado.
- Queso extra añade consumo y cargo configurados.
- Domicilio usa la tarifa de `shared/business.js`; retirar no agrega tarifa.
- El precio final se redondea mediante la regla en `shared/pricing.js`.
- Una orden nueva siempre inicia pendiente y con pago pendiente.
- Ventas completadas en el dashboard: `entregado` y `pagado`. Esta política requiere aprobación de producto.
- Inventario es una capacidad estimada: no representa compras, desperdicio, reservas ni existencias reales.
