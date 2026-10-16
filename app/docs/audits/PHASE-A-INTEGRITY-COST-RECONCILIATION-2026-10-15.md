# Fase A — Integridad y reconciliación de costos

Fecha: 2026-10-15
Rama: audit/phase-a-integrity-cost-reconciliation

Estado: en curso; no desplegar ni habilitar pedidos.

## Fuente comercial
La hoja Excel suministrada es la referencia para costos unitarios y cantidades de las seis recetas definidas en ella. El catálogo y las recetas compartidos siguen siendo la fuente canónica para cliente, funciones e inventario.

## Costos unitarios confirmados por la hoja

| Ingrediente | Costo paquete COP | Unidades | Costo unitario COP |
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

La fórmula de precio es `ceil(costo × 1,75 / 1.000) × 1.000 − 100`; el tamaño de 30 cm duplica las cantidades de la receta de 15 cm antes de calcular el precio.

## Recetas cubiertas por la hoja

- Turkey Finas Hierbas: pavo FH ×4, pechuga de pavo ×4, base ×1.
- Explosivo: chorizo ×2, salami ×2, pepperoni ×9, queso tajado ×2, base ×1.
- Doble Jamón: pechuga de pavo ×4, jamón serrano ×2, queso tajado ×2, base ×1.
- Spicy Mix: chorizo ×3, pepperoni ×6, queso tajado ×2, base ×1.
- Triple Stack: pechuga de pavo ×4, jamón serrano ×2, pepperoni ×6, queso tajado ×2, base ×1.
- Full House: pavo FH ×4, pechuga de pavo ×4, jamón serrano ×2, chorizo ×2, salami ×2, pepperoni ×6, prosciutto ×1, queso tajado ×2, base ×1.

Serrano Verde y Fuego Tropical existen en la aplicación, pero no en esta hoja; no se inventan cantidades nuevas para ellos. El costo del pimentón tampoco aparece en la hoja y debe verificarse antes de certificar el costo de Fuego Tropical. La mozzarella aparece en compras pero no en las seis recetas predefinidas; el configurador personalizado sí la incluye por defecto, decisión que debe mantenerse diferenciada.

## Hallazgos de seguridad

Las reglas anteriores validaban las transiciones de estado y pago, pero no limitaban explícitamente todos los campos modificables desde una sesión administrativa. La Fase A debe limitar la edición del navegador a estado de pedido, estado de pago y marca temporal de actualización; costos, totales, datos del cliente, productos e instantánea de inventario deben ser inmutables desde el cliente.

## Validación pendiente

- `npm ci`
- `npm run audit`
- `npm run lint`
- `npm test`
- `npm run security:test` con Firebase Emulator
- `npm run build`
- `npm run smoke`
- revisión de CI, prueba visual móvil/escritorio y confirmación del proyecto de Firebase

No se declaran pruebas como aprobadas sin ejecución. `acceptingOrders = false` permanece sin cambios. No desplegar Rules/Functions ni integrar a `main` hasta revisar los resultados y aprobar la rama.