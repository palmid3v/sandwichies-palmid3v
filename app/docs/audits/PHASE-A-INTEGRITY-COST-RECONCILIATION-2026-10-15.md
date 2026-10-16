# Fase A — Integridad, seguridad y reconciliación de costos

**Fecha:** 2026-10-15  
**Branch:** main  
**Estado:** implementación en revisión; no se ha desplegado a producción.

## Cambios aplicados en el repositorio

- Las reglas de Firestore limitan las actualizaciones de pedidos desde el navegador a `status`, `payment.status` y `updatedAt`.
- Las transiciones existentes de estado y pago siguen siendo obligatorias.
- Se agregaron pruebas negativas para proteger totales, costos, ganancia estimada, subtotal, datos del cliente, productos, método de pago e instantánea de inventario.
- Las pruebas de costos del Excel ahora se limitan a las seis recetas efectivamente definidas en esa hoja.
- Se actualizó la documentación de costos con la compra vigente y las salvedades para Serrano Verde, Fuego Tropical y pimentón.

## Riesgo y validación

Las escrituras de Functions con Firebase Admin SDK continúan en el backend confiable. Las reglas del navegador no reemplazan la validación de negocio en la función callable.

Pendiente ejecutar: `npm ci`, `npm run audit`, `npm run lint`, `npm test`, `npm run security:test`, `npm run build` y `npm run smoke`. Las reglas nuevas deben validarse en Firebase Emulator antes de considerarse aprobadas. No se ha ejecutado ninguna prueba en esta sesión.

`BUSINESS.acceptingOrders = false` se mantiene. No desplegar reglas o funciones ni habilitar checkout como parte de estas fases.
