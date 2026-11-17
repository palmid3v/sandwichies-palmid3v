# Cupboard + Sandwichies execution report — 2026-11-16

## Estado

- Repositorio Sandwichies: `main`, commit local `a9e61bc`, limpio al iniciar.
- Repositorio Cupboard: `main`, commit local `9660f5e`, limpio al iniciar.
- Node local: v24.19.0. En Cupboard se actualizaron dependencias transitivas con `npm audit fix` sin `--force`; Sandwichies conserva 6 vulnerabilidades moderadas transitivas (sin altas/críticas en su check).
- `ORDERS_ENABLED` continúa en `false` en Wrangler; el endpoint LIVE `/health` también reportó `ordersEnabled: false`.
- No se desplegó, no se cambió IAM ni billing y no se hicieron escrituras Firebase/Cloudflare/Vercel LIVE.

## Cambios implementados

- El parser de credenciales Sandwichies ahora distingue JSON/estructura inválida de un `project_id` que no coincide; protege contra JSON válido `null` u otros tipos no objeto.
- El parser Cupboard aplica la misma separación entre estructura inválida y proyecto incorrecto.
- Las claves privadas se validan como PEM PKCS#8 antes de OAuth y los errores de importación se convierten a un código seguro.
- El rechazo OAuth no expone `error_description`; diferencia rechazo de credencial de indisponibilidad del proveedor.
- La validación de claves de firma Firebase ahora clasifica por separado errores/timeout JWKS y token inválido/expirado.
- El manejador global del Worker diferencia permisos, recursos inexistentes, rechazo upstream, indisponibilidad y timeout con HTTP 502/503/504, y no devuelve mensajes internos sin filtrar.
- Las rutas de diagnóstico Cupboard usan el mismo mapeo seguro de errores que las demás rutas.
- Se añadieron pruebas sintéticas de credenciales JSON/estructura/proyecto, clave privada inválida, rechazo OAuth y clasificación HTTP.
- Se documentaron formato de credenciales y códigos operacionales en `app/worker/README.md`.
- IAM requerido por el código: el rol Firestore de datos `roles/datastore.user` para cada identidad en su propio proyecto (`sandwich-pro` y `cupboard-app-ce528`). El permiso es de proyecto y Firestore REST con OAuth de cuenta de servicio omite Security Rules; el binding real no se consultó ni modificó. Referencias: [roles IAM de Firestore](https://cloud.google.com/iam/docs/roles-permissions/firestore), [autenticación de Firestore REST](https://cloud.google.com/firestore/native/docs/use-rest-api).

## Validación local/emulada

La última corrida de `npm run check` en `app/` finalizó con exit code 0:

- npm audit: sin vulnerabilidades altas/críticas; quedan 6 moderadas en dependencias transitivas.
- ESLint: pasó.
- Worker: 90/90 pruebas.
- Dominio: 43/43 pruebas.
- Firestore Rules Sandwichies: 12/12 en `demo-sandwichies`.
- Integración Functions/Firestore: 7/7 en emuladores `demo-sandwichies`/`demo-cupboard`.
- Build, presupuesto de bundle y smoke `/` + `/admin`: pasaron.

La suite de integración emitió avisos de timeout/no resolución al consultar metadata de Application Default Credentials. Los tests continuaron con emuladores demo y terminaron correctamente; esos avisos no prueban acceso a Firebase LIVE.

Cupboard: regresión 19/19; Firestore Rules 8/8 en `demo-cupboard`; ESLint pasó. Auditoría final offline del lockfile con `--omit=dev --audit-level=high`: 0 vulnerabilidades; la consulta online falló por indisponibilidad del endpoint npm. El build en `app/dist` no pudo abrir `sw.js` por `EPERM`; un build temporal sí completó. El código separa Firebase/React/vendor en chunks (máximo observado 315.48 kB) y el lector de códigos queda asíncrono.

## Verificación LIVE de solo lectura

- `GET https://sandwichies-palmid3v.cpalmi0725.workers.dev/health`: HTTP 200; el servicio reportó `status: ok` y `ordersEnabled: false`.
- `HEAD https://sanpalmid3v.vercel.app/`: HTTP 200.
- El proyecto Vercel `cupboard-palmid3v` declara el dominio verificado `cupboard-palmid3v.vercel.app`; `HEAD` a la URL respondió HTTP 200.
- Vercel reporta el último deployment de producción de Cupboard como `READY`. No se creó ni promovió deployment.
- Las credenciales Cloudflare no se leyeron ni se usaron para OAuth/Firestore LIVE. La presencia del nombre de un secreto no demuestra que su contenido sea válido. No se comprobó IAM LIVE.
- No se consultaron ni modificaron Firestore LIVE, reglas, índices ni datos.

## Alcance de integración y bloqueos de activación

El flujo actual mantiene a Cupboard como autoridad de balances/movimientos. La confirmación administrativa del pedido aplica consumo transaccional en Cupboard con clave determinista; las pruebas cubren insuficiencia, reintento idempotente y reversión única. La aplicación Cupboard opera de manera independiente del Worker.

No hay evidencia de validez actual de los secretos remotos, IAM de las dos cuentas, mapeo real verificado contra documentos LIVE, autenticación real en ambos frontends, pruebas de concurrencia multiinstancia en Firestore LIVE ni walkthrough responsive en navegadores/dispositivos. La reserva persistente antes de crear una orden no está implementada como entidad separada; el flujo existente evita aceptar la orden como confirmada y descuenta en la transición administrativa.

Por tanto, los criterios de activación de pedidos no se cumplen. `ORDERS_ENABLED` debe permanecer `false`. Esta decisión respeta los gates del repositorio y evita declarar disponibilidad de inventario no verificada.

## Update 2026-11-17: order reservation hardening

This update supersedes the earlier note above that said there was no separate reservation entity. The Worker now stores idempotent reservations in Cupboard, serializes available-stock checks, consumes a hold once, releases pending holds on cancellation, and attempts release compensation if consumption fails. Cupboard UI stock adjustments and Worker manual movements preserve the reservation floor. Sandwichies Worker tests now pass 95/95; the emulator integration includes concurrent last-stock reservation, release, consume and reversal. The full `npm run check` passed on 2026-11-17 before the last additional unit test; the final Worker-only rerun passed 95/95.

**Remaining order gate:** new customer order creation still persists the pending order before any inventory reservation. A reservation is currently acquired only on admin confirmation. This does not meet the requirement to reject checkout when stock cannot be confirmed and reserved. Keep both `ORDERS_ENABLED=false` and `BUSINESS.acceptingOrders=false`; no production credentials, IAM grants or mappings were verified, and no deployments or LIVE writes were performed.

Reservation release compensation can fail across the two Firebase projects; such a failure is logged with the order ID and safe error code but there is no automated reconciliation/expiry worker. This is another reason orders remain disabled. Cupboard's default output build failed with `EPERM` at `app/dist/sw.js`; a complete PWA build succeeded to `.tmp-release-build`.

Final verification correction: the full `npm run check` was rerun after all Worker reservation changes on 2026-11-17 and passed. Counts: Worker 95/95, domain 43/43, Sandwichies Firestore Rules 12/12, Functions/Firestore integration 8/8; lint, build, performance budget and smoke checks passed. The audit step exits successfully at its configured high-severity threshold but reports 6 moderate transitive advisories.
