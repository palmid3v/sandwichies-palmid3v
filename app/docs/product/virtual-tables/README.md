# Sandwichies — Mesas virtuales y dirección UX

Esta carpeta reúne la especificación vigente de producto, las referencias visuales de Canva y el prompt operativo que debe seguir cualquier agente de IA antes de analizar o modificar Sandwichies.

## Prioridad de producto

1. Cliente mobile-first (prioridad principal).
2. Admin mobile para operación y entregas en campo.
3. Admin desktop para supervisión y gestión integral del negocio.
4. Preparación arquitectónica para futuras aplicaciones iOS y Android, sin migrar de framework antes de una decisión técnica.

## Contenido

- `PROMPT-MAESTRO.md`: instrucciones completas para analizar, diseñar, implementar, probar y documentar tareas.
- `FLUJO-Y-REGLAS.md`: roles, flujos, reglas de mesas virtuales y estados.
- `mockups/README.md`: referencias visuales y enlaces editables de Canva.

## Reglas resumidas

- El cliente no selecciona mesa; el backend asigna automáticamente.
- Agrupación por proximidad de 50 m respecto al ancla de la mesa.
- Máximo 9 pedidos activos por mesa.
- La entrega/cancelación libera solo el cupo del pedido correspondiente.
- Zona de servicio definida por polígono y administrada por admin.
- Inactividad inicial de 60 minutos, configurable.
- Pedidos siguen siendo independientes.
- Pagos y Cupboard no se modifican por esta funcionalidad.
- `BUSINESS.acceptingOrders = false` permanece como barrera de release.

## Cómo usar esta carpeta

Antes de implementar mesas virtuales o cambios relevantes de UX:

1. Leer este README.
2. Leer `PROMPT-MAESTRO.md` completo.
3. Revisar los mockups de `mockups/README.md`.
4. Auditar el código y la documentación vigentes.
5. Registrar cualquier discrepancia antes de modificar el comportamiento.

Los mockups son referencia de diseño, no evidencia de que la funcionalidad esté implementada.
