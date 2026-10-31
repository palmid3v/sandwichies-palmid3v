# Flujos y reglas de producto — Mesas virtuales

**Estado:** especificación UX/funcional de referencia; no implica implementación.

## Roles

### Cliente
1. Explora catálogo.
2. Configura productos y revisa carrito.
3. Completa el checkout actualmente soportado.
4. Si elige punto de encuentro (cuando esté habilitado), permite GPS o marca un punto manual en el mapa.
5. Confirma el punto y envía el pedido.
6. El backend valida zona y asigna mesa virtual automáticamente.
7. El cliente recibe identificador de mesa y tracking de su pedido.
8. Al llegar, marca “Ya estoy aquí”.
9. Consulta únicamente su propio pedido.

### Admin — mobile
1. Abre la cola operativa.
2. Ve pedidos y mesas con capacidad, zona y ubicación de referencia.
3. Abre un pedido individual y lo marca listo.
4. Navega al punto de la mesa.
5. Confirma la entrega de ese pedido.
6. El pedido sale del conteo activo; los demás integrantes permanecen sin cambios.
7. Si la mesa sigue abierta y vigente, el cupo queda disponible.

### Admin — desktop
1. Abre centro de operaciones.
2. Supervisa mapa, zonas, mesas, pedidos y capacidad.
3. Filtra por estado, zona y mesa.
4. Administra polígonos de cobertura.
5. Gestiona pedidos y consulta las áreas de negocio disponibles: catálogo, ventas, cuentas, costos e inventario.
6. Revisa eventos y trazabilidad.

## Asignación automática

- Zona: el punto debe estar dentro de un polígono activo.
- Agrupación: distancia Haversine desde el punto del pedido al ancla de una mesa elegible.
- Radio: 50 m.
- No encadenar proximidad entre pedidos; siempre comparar con el ancla.
- Capacidad: máximo 9 pedidos activos.
- Si el grupo está lleno, buscar otro grupo elegible o crear uno nuevo conforme a las reglas de backend.
- El servidor valida y persiste asignación con transacción e idempotencia.

## Independencia de pedidos

Agrupar pedidos no los convierte en una sola orden. Cada uno conserva cliente, artículos, precio, pago, estados, eventos y vínculo de inventario.

La confirmación de entrega de un pedido no debe modificar el resto de la mesa.

## Ciclo de vida

- Mesa abierta: admite pedidos mientras esté vigente y tenga cupo.
- Mesa llena: 9/9 pedidos activos; no admite más.
- Entrega/cancelación: libera un único cupo.
- Inactividad: 60 minutos iniciales, configurable.
- Mesa vencida: deja de aceptar pedidos; no cancela pedidos pendientes ni borra el historial. Admin conserva visibilidad operativa y debe poder resolver pendientes.

**Decisión pendiente antes de backend:** definir exactamente qué eventos reinician el temporizador de inactividad y cómo se representa una mesa vencida con pedidos pendientes.

## Privacidad y permisos

- Cliente: únicamente su tracking y sus datos permitidos.
- Admin autorizado: vista global y herramientas de gestión.
- Ningún cliente ve coordenadas, identidad, teléfono ni pedido de otros clientes.
- Las escrituras privilegiadas ocurren en backend; el cliente no escribe mesas ni eventos administrativos.

## Fuera de alcance de esta especificación

- Cambiar proveedores o métodos de pago.
- Tap to Pay.
- Cambios de política de cobro o reembolsos.
- Cambios al modelo de inventario Cupboard.
- Habilitar pedidos reales o desplegar a producción.
- Migrar el frontend a React Native/Expo sin ADR y aprobación específica.
