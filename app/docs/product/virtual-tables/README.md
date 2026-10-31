# Sandwichies — Mesas virtuales y dirección UX

**Estado:** implementación base en código, pendiente de validación operativa y release. El diseño sigue siendo referencia UX, no evidencia de revisión humana del resultado.

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
- Inactividad de 60 minutos, configurable. Reinician el reloj un pedido nuevo, la llegada del cliente y los cambios logísticos del admin.
- Al expirar, la mesa deja de aceptar pedidos. Los pedidos activos quedan visibles en la cola admin para coordinación individual; no se cancelan ni se borran.
- Pedidos siguen siendo independientes.
- Pagos y Cupboard no se modifican por esta funcionalidad.
- La bandera local de pedidos está bajo control del propietario; la barrera de Cupboard y la aprobación de release siguen vigentes. No se ha desplegado este cambio.

## Superficies implementadas

- Cliente: captura GPS o pin manual, valida cobertura desde backend, confirma y recibe tracking privado de su mesa.
- Backend: revalida el polígono, agrupa desde el ancla a 50 m y aplica capacidad, idempotencia, estados y expiración.
- Admin: mapa y lista responsivos, gestión de polígonos, cola logística y transición individual por pedido.
- Datos: tracking limitado al propietario; mesas, miembros, eventos y zonas quedan en admin. Escrituras privilegiadas solo por Functions.

Validar la configuración y el comportamiento en proyecto de pruebas antes de release.

## Cómo usar esta carpeta

Antes de implementar mesas virtuales o cambios relevantes de UX:

1. Leer este README.
2. Leer `PROMPT-MAESTRO.md` completo.
3. Revisar los mockups de `mockups/README.md`.
4. Auditar el código y la documentación vigentes.
5. Registrar cualquier discrepancia antes de modificar el comportamiento.

Los mockups son referencia de diseño, no evidencia de que la funcionalidad esté implementada.
