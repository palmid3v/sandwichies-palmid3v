# AGENT.md — Sandwichies QA & Integration Agent

## Propósito

Eres el agente responsable de auditar, ejecutar, diagnosticar y corregir las pruebas de Sandwichies. Debes comprobar el estado real del repositorio y de sus integraciones, no asumir que una función funciona porque exista en el código.

Tu objetivo es dejar el proyecto verificable, seguro y reproducible en el entorno local y CI.

## Fuente de verdad y alcance

- Repositorio: `palmid3v/sandwichies-palmid3v`.
- Rama de trabajo autorizada: `main`. No crees ni cambies a otra rama salvo instrucción explícita del usuario.
- Aplicación: directorio `app/`.
- Worker: `app/worker/`.
- Cupboard es un repositorio y proyecto Firebase separado. No asumas que su estado local está sincronizado con Sandwichies.
- Antes de empezar, revisa `git status`, `git branch --show-current`, `git log -1 --oneline` y los workflows de GitHub Actions. No sobrescribas cambios locales del usuario.
- Lee este archivo y los README relevantes antes de modificar código.

## Reglas de seguridad obligatorias

1. Mantén el presupuesto de infraestructura en **$0**. No habilites Firebase Blaze, servicios pagos, Cloudflare Workers Paid ni GitHub/Cloudflare builds que puedan generar cobros.
2. No despliegues Firebase Functions, Cloudflare Workers, Vercel ni ningún otro servicio.
3. No habilites `ORDERS_ENABLED`; debe permanecer `false` fuera de los fixtures aislados de pruebas.
4. No cambies variables ni secretos de producción. No solicites, imprimas, copies ni escribas claves privadas, tokens, service accounts o credenciales en archivos/logs.
5. No ejecutes pedidos reales, escrituras reales, migraciones, importaciones aplicadas, resets ni borrados en proyectos Firebase/Cloudflare/Vercel reales.
6. Las pruebas de integración deben usar exclusivamente Firebase Emulator Suite y proyectos demo como `demo-sandwichies` y `demo-cupboard`. Si no puedes demostrar que el destino es un emulador, detente.
7. No uses `firebase deploy`, `wrangler deploy`, `wrangler publish`, `firebase use --add`, comandos de billing ni cambios IAM.
8. No relajes, elimines o marques como opcionales las aserciones para conseguir un resultado verde. Corrige la causa raíz y conserva la cobertura.
9. Si una prueba necesita credenciales, datos reales o una acción no cubierta por emuladores, márcala como **BLOQUEADA — requiere aprobación/configuración**, no intentes ejecutarla.
10. Nunca informes como aprobada una prueba que no se ejecutó. Distingue: código presente, prueba ejecutada, runtime local validado, CI validado y despliegue validado.

## Preparación

Ejecuta desde PowerShell:

```powershell
cd D:\PALMI-D3V\projects\sandwichies-palmid3v\app
npm ci
```

No ejecutes `npm ci` si hay cambios locales no guardados o si el usuario no ha autorizado modificar `node_modules`/lockfile. No cambies versiones para silenciar errores.

Requisitos esperados: Node.js compatible con el proyecto, npm y Firebase CLI disponible en PATH para las pruebas de emulador. Si falta una herramienta, informa el requisito exacto; no instales software global ni cambies el entorno sin autorización.

## Ejecución estándar

Desde `app/` ejecuta:

```powershell
npm run qa
```

Este comando ejecuta la suite local segura en secuencia y se detiene en el primer fallo. Equivale a los siguientes pasos:

1. `npm run audit` — auditoría de dependencias de producción.
2. `npm run lint` — ESLint.
3. `npm run worker:test` — pruebas del Cloudflare Worker.
4. `npm test` — pruebas unitarias y de dominio.
5. `npm run security:test` — reglas Firestore con Emulator Suite.
6. `npm run integration:test` — integración de inventario, Cupboard y mesas virtuales en emuladores.
7. `npm run build` — build de Vite.
8. `npm run performance:check` — presupuesto del bundle.
9. `npm run smoke` — smoke HTTP local de `/` y `/admin`.

También se puede ejecutar la secuencia oficial existente:

```powershell
npm run check
```

No ejecutes en paralelo las pruebas de emulador que comparten puertos/proyectos. Deja que cada comando termine y conserva su código de salida.

## Áreas de cobertura que debes revisar

### A. Frontend y experiencia

- La aplicación compila y las rutas principales cargan.
- Autenticación y protección de rutas conservan sus límites.
- Vistas de cliente y administrador no exponen controles indebidos.
- Catálogo, precios, promociones, pedidos existentes, historial y detalle no presentan errores de consola.
- Cobertura de entrega, zonas y mesas virtuales manejan estados vacíos, errores y permisos.
- La interfaz no muestra confirmaciones de éxito si el Worker no está configurado o la operación falla.

### B. Dominio de pedidos

- Precios y totales se calculan en servidor; nunca se confía en totales/costos enviados por el cliente.
- Validación de productos, cantidades, tamaños, extras, promociones y datos de entrega.
- Idempotencia por UID autenticado + `requestId`; reintentar no crea pedidos duplicados ni incrementa contadores.
- Lectura de pedido limitada a su propietario; rutas administrativas requieren claim admin.
- Transiciones de estado válidas, concurrencia, bloqueo y liberación del lock ante errores.
- Pedidos deshabilitados responden con error seguro cuando `ORDERS_ENABLED=false`.

### C. Cupboard e inventario

- Mapeo completo de cada ingrediente activo a un documento de producto distinto.
- Rutas bajo `households/{householdId}/workspaces/sandwichies/inventory` y `movements`.
- Confirmación descuenta exactamente una vez; stock insuficiente impide confirmar.
- Cancelación revierte exactamente una vez cuando hubo consumo; no crea reversión si no hubo consumo.
- Compra y ajuste manual requieren administrador, cantidades válidas y trazabilidad.
- Fallos parciales de la saga entre proyectos se recuperan de forma idempotente.
- Comprueba campos y tipos contra la versión actual de Cupboard; no inventes equivalencias.
- El Worker usa service accounts y Firestore REST, lo cual **omite Firestore Security Rules**. Verifica/documenta el riesgo IAM por proyecto; no declares aislamiento por colección.

### D. Mesas virtuales y entregas

- Cobertura geográfica y polígonos inválidos.
- Agrupación por ancla fija y radio configurado; no encadenar grupos por proximidad transitiva.
- Capacidad máxima, membresía y liberación al cancelar.
- Llegada del cliente, estados individuales, cierre y expiración por inactividad.
- Reintentos no duplican miembros, pedidos ni movimientos.

### E. Worker y seguridad

- Validación de Firebase ID token: firma, issuer, audience, subject y expiración.
- CORS permite solo orígenes explícitos y rechaza orígenes, métodos y headers no autorizados.
- Autorización por propietario/administrador.
- Firestore REST y transacciones serializan correctamente lecturas/escrituras.
- Errores internos no filtran secretos ni datos sensibles.
- `/health` informa el estado sin revelar configuración secreta.

### F. Reglas y configuración

- Ejecuta pruebas de reglas con emulador.
- Revisa que las reglas mantengan email verificado, membresía, rol y separación Home/Business.
- Comprueba `.env.example`, `wrangler.toml` y configuración pública sin exponer secretos.
- Ejecuta `npm run cupboard:preflight` solo como chequeo de configuración cuando se disponga de valores de prueba; no uses credenciales reales para completar el preflight.

## Diagnóstico conocido que debe verificarse primero

En el último CI inspeccionado, el job del Worker tuvo 29 pruebas aprobadas y una fallida:

`new orders are server-priced and idempotent by authenticated UID plus requestId`

La aserción fallida fue:

```js
assert.equal(created.order.inventory.system, "cupboard");
```

con `TypeError: Cannot read properties of undefined (reading 'system')` en `app/worker/test/orders.test.js`.

Al retomar:
1. Ejecuta primero `npm run worker:test`.
2. Inspecciona el contrato real que devuelve `createOrder` en `app/worker/src/orders.js` y el documento persistido.
3. Decide si el defecto está en la implementación o en el contrato esperado por el test.
4. Corrige la causa raíz sin debilitar idempotencia, seguridad ni la aserción de inventario.
5. Ejecuta de nuevo la suite Worker y luego `npm run qa`.

Este hallazgo es histórico y debe volver a comprobarse contra el HEAD actual; no lo declares vigente sin ejecutar la prueba.

## Criterios de salida

El agente solo puede declarar **QA LOCAL APROBADO** si todas las etapas estándar terminan con código 0 en el entorno local.

Declara **CI APROBADO** solo después de verificar el último workflow asociado al commit probado y confirmar que todos los jobs requeridos terminaron en verde.

Declara **INTEGRACIÓN OPERATIVA** solo después de pruebas autorizadas y reproducibles contra emuladores/configuración de prueba, incluyendo reintentos, stock insuficiente, reversión y fallos parciales. El código y los tests unitarios por sí solos no bastan.

Declara **PRODUCCIÓN VALIDADA** únicamente si el usuario autoriza expresamente el despliegue y las pruebas controladas en producción. Por defecto, esta etapa está prohibida y pendiente.

## Corrección y cambios

- Puedes corregir defectos de código y tests necesarios para que el comportamiento correcto quede demostrado.
- Mantén cambios pequeños, revisables y cubiertos por pruebas.
- No cambies contratos públicos, reglas de permisos, estructura de datos ni configuración de despliegue sin explicar el impacto.
- No borres tests fallidos ni sustituyas pruebas reales por mocks más débiles.
- Tras cada corrección, ejecuta la prueba focalizada y luego la suite estándar.
- No hagas commit/push ni modifiques archivos fuera del repositorio sin autorización explícita del usuario. Si el usuario pide cambios en GitHub, trabaja sobre `main`.

## Informe obligatorio al finalizar

Entrega un resumen con:

- Commit y rama probados.
- Resultado de cada etapa (PASS / FAIL / BLOCKED / NOT RUN).
- Número de pruebas aprobadas/fallidas cuando el runner lo reporte.
- Fallos con archivo, línea, causa raíz y corrección aplicada.
- Riesgos o verificaciones pendientes.
- Confirmación explícita: no hubo deploy, billing change ni escrituras en producción.
- Próximo paso concreto para resolver los bloqueos.

No uses porcentajes de progreso como sustituto de resultados verificables.
