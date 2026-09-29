# Sandwiches — Informe de auditoría v0.1

**Fecha:** 28 de septiembre de 2026  
**Alcance:** revisión estática del repositorio, configuración, reglas de Firestore, dependencias y validación local. No se modificó código de producto ni se inspeccionaron datos de producción.

## Resumen ejecutivo

La aplicación es un MVP funcional para tomar pedidos personalizados y gestionarlos desde un panel administrativo. Compila correctamente y sus pruebas existentes pasan. No está lista para operación pública sostenida: la integridad de pedidos, métricas e inventario depende de datos que el navegador puede manipular y las reglas actuales no diferencian administradores de cualquier usuario autenticado.

**Decisión recomendada:** no ampliar funcionalidades hasta cerrar los bloqueantes de seguridad e integridad (P0). Después, congelar el alcance del MVP y completar el flujo operativo de pedidos antes de inventario o analítica avanzada.

## Evidencia de calidad actual

| Control | Resultado |
| --- | --- |
| `npm run lint` | Correcto |
| `npm test` | 3/3 pruebas correctas |
| `npm run build` | Correcto; bundle principal de 605.49 kB (186.70 kB gzip), supera el umbral de aviso de Vite |
| `npm audit --omit=dev` | 6 vulnerabilidades: 2 críticas, 3 altas y 1 moderada |

Las pruebas sólo cubren parte del cálculo de precios. No hay pruebas de reglas Firestore, creación de pedido, estados, autenticación, panel, ni flujo WhatsApp.

## Qué existe hoy

- Tienda pública en `/`: construcción de sandwich de 15/30 cm, favoritos, proteínas, extras, carrito, retiro/domicilio, pago y envío de resumen a WhatsApp.
- Panel en `/admin`: inicio de sesión por Firebase Auth, lectura en tiempo real de pedidos, detalle, cambio de estado y pago, tablero acumulado e inventario estimado.
- Persistencia en Cloud Firestore: colección `orders` y contador `counters/orders`.
- Precios, menú, ingredientes y datos del negocio definidos en el código cliente.

## Hallazgos

### P0 — Seguridad e integridad

1. **Un pedido público puede llevar valores manipulados.** La regla de creación sólo exige presencia y tipo de algunos campos. No valida la estructura de cada ítem, límites de tamaño, dirección, método de pago, `updatedAt`, ni que `total`, `cost` y `profit` correspondan al menú. Un actor puede crear pedidos con importes artificiales y contaminar las ventas, costos y utilidad.

2. **Todo usuario autenticado tiene privilegios administrativos completos.** `isSignedIn()` autoriza leer, actualizar y borrar cualquier pedido. Firebase Auth por sí solo no define el rol administrador; cualquier cuenta autenticada que llegue al proyecto podría acceder a datos personales y modificar o eliminar órdenes.

3. **El contador público se puede consumir y alterar operativamente.** Cualquiera puede leerlo y aumentar el valor de uno en uno. Esto permite agotar o inflar la numeración de órdenes aun sin crear un pedido válido. Además, la numeración y la escritura de la orden se hacen en el cliente.

**Acción P0:** mover la creación de órdenes y la asignación de consecutivo a un backend confiable (Cloud Function/Cloud Run) que reconstruya precio y costo desde un catálogo controlado. Permitir al cliente sólo enviar una solicitud limitada. Aplicar roles administrativos con custom claims y reglas de Firestore que rechacen toda lectura/escritura administrativa fuera de ese rol.

### P1 — Dependencias y despliegue

4. **Dependencias de producción con vulnerabilidades conocidas.** El lockfile resuelve `react-router-dom` 7.13.2, `protobufjs` 7.5.4, `@grpc/grpc-js` 1.9.15 y `websocket-driver` 0.7.4. El auditor reporta dos vulnerabilidades críticas, incluidas `protobufjs` y `websocket-driver`, y tres altas. La actualización debe hacerse de forma controlada, ejecutar el suite y revisar el lockfile resultante.

5. **Despliegue sin verificación documentada.** Hay configuración para Vercel y Firebase, pero el checklist de despliegue sigue pendiente. No hay evidencia en el repositorio de entorno productivo, publicación de reglas, rollback ni prueba de humo post-despliegue.

6. **Configuración comercial en el bundle.** Horarios/apertura, WhatsApp, tarifa de domicilio, precios, ingredientes y costos se publican con el frontend. La clave pública de Firebase es normal, pero los costos y reglas de negocio no deben considerarse secretos ni fuente de verdad si permanecen aquí.

### P1 — Operación y producto

7. **Inventario no es inventario real.** El panel muestra una capacidad calculada desde cantidades fijas en `ingredients.js`; no registra existencias, compras, mermas, reservas ni consumo por orden. Mostrarlo como estimación es correcto, pero no debe usarse para decisiones de abastecimiento.

8. **Analítica mezcla estados que no equivalen a venta realizada.** El dashboard descuenta sólo pedidos cancelados: incluye pendientes, confirmados y no pagados en ventas y ganancia. Para operación real se requieren definiciones explícitas de "pedido", "venta", "pago" y "entrega".

9. **El cierre de pedido no confirma recepción comercial.** Se guarda primero en Firestore y luego abre WhatsApp. Si el cliente cierra o no envía el mensaje, el negocio recibe una orden persistida que puede no haber sido confirmada por ese canal. Definir si WhatsApp es confirmación, canal auxiliar o si el pedido web es la fuente definitiva.

### P2 — Mantenibilidad y experiencia

10. **Cobertura insuficiente y lógica crítica sólo en cliente.** Hay tres tests unitarios de precios. Faltan casos límite (valores vacíos, toppings, dobles, domicilio, redondeo, órdenes heredadas), pruebas de UI y emulador Firestore.

11. **Bundle inicial por encima del objetivo de Vite.** La compilación advierte un JS principal de 605.49 kB sin comprimir. No bloquea el MVP, pero conviene dividir `/admin` mediante carga diferida tras estabilizar P0/P1.

12. **Deuda de limpieza.** `src/utils/whatsapp.js` usa el formato antiguo de pedido y no se importa; `src/src.7z` está versionado; la documentación de requisitos, reglas de negocio, base de datos y despliegue sigue como plantilla. Evaluar y retirar/ubicar archivos obsoletos sólo después de confirmar que no se requieren como histórico.

## Estado del árbol de trabajo

Hay cambios locales sin confirmar, respetados durante esta auditoría:

- Se habilitó `acceptingOrders`.
- Se ajustaron costos/cantidades de ingredientes y pan de 30 cm.
- Se actualizó la porción de "Turkey Finas Hierbas" en el menú.

Antes de desplegar, validar estos cambios contra costos reales y registrar fecha/fuente de cada precio.

## Plan de continuación propuesto

1. **Sprint 1 — Asegurar pedidos (P0):** diseño de roles, endpoint confiable de creación, reglas restrictivas, validación de payload y pruebas con emulador.
2. **Sprint 2 — Operación mínima (P1):** definir máquina de estados, pago/venta/entrega, política de WhatsApp y tablero basado en esas definiciones.
3. **Sprint 3 — Base de producto (P1):** catálogo administrable y versionado de precios/costos; inventario transaccional sólo si se confirma dentro del MVP.
4. **Release gate:** actualizar dependencias, ampliar pruebas críticas, publicar reglas, ejecutar smoke test en producción y documentar rollback.

## Decisiones pendientes de Nexsy

- Confirmar el MVP: ¿venta y seguimiento de pedidos, o también inventario y gestión de recetas?
- Confirmar quiénes administran el panel y cómo se les asigna el rol.
- Definir cuándo una orden cuenta como venta y quién puede cancelarla/modificarla.
- Definir el papel de WhatsApp en la confirmación del pedido.
- Validar el catálogo, márgenes, costo de domicilio y horarios antes de abrir pedidos públicamente.
