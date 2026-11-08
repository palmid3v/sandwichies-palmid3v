# Despliegue

## Arquitectura de publicación

- **Frontend:** Vercel (build de Vite).
- **API:** Cloudflare Worker definido por `app/worker/wrangler.toml`.
- **Identidad:** Firebase Authentication, proyecto `sandwich-pro`.
- **Datos:** Firestore; durante desarrollo y QA local se usa Firestore Emulator.

La presencia de un registro de deployment en el dashboard no demuestra que la API esté operativa. El Worker debe responder correctamente en `GET /health` y `GET /v1/session` sin token debe responder HTTP 401.

## Estado verificado — 2026-11-08

- GitHub `main` mantiene `BUSINESS.acceptingOrders=false` y `ORDERS_ENABLED=false`.
- Cloudflare muestra un registro de deployment del Worker, pero el hostname probado respondió HTTP 404 en `/health`.
- La configuración consultada del Worker reportó `bindings: []` y una fecha de compatibilidad distinta de la configuración local.
- Por lo tanto, el backend remoto no se considera validado ni listo para pedidos.
- El flujo de desarrollo local está documentado en [local-worker.md](../development/local-worker.md).

## Gates obligatorios antes de producción

1. Ejecutar `npm ci`, `npm run local:preflight`, `npm run qa` y completar el recorrido manual de navegador.
2. Validar Worker + Firestore Emulator sin apuntar escrituras a proyectos reales.
3. Revisar el proyecto destino, CORS, dominios y configuración de Firebase Authentication.
4. Configurar las credenciales de servicio de Sandwichies y Cupboard como secretos de Cloudflare; nunca versionarlas ni exponerlas al frontend.
5. Revisar los permisos IAM mínimos y la separación de identidades entre proyectos.
6. Ejecutar `npm run build` y `npm run release:verify` con `RELEASE_BASE_URL`, `RELEASE_WORKER_URL` y `RELEASE_FIREBASE_PROJECT_ID`.
7. Obtener aprobación explícita para desplegar frontend o Worker.

## Seguridad de pedidos

Mantener ambos controles en `false`:

- `app/shared/business.js`: `BUSINESS.acceptingOrders = false`.
- `app/worker/wrangler.toml`: `ORDERS_ENABLED = "false"`.

No cambiar estos valores como parte de una prueba técnica. Habilitar pedidos reales requiere una aprobación separada después de validar inventario, autenticación, permisos, checkout, pagos, entrega, observabilidad y recuperación.

## Prohibiciones durante desarrollo

- No ejecutar `firebase deploy`, `wrangler deploy` ni despliegues de Vercel sin aprobación explícita.
- No habilitar Firebase Blaze ni servicios pagos.
- No ejecutar pedidos de prueba contra inventario real.
- No usar `POST /v1/orders` como smoke test de producción.
- No copiar service accounts, tokens ni archivos `.dev.vars` al repositorio.
