# Sandwichies — Contexto técnico de la aplicación

**Actualizado:** 3 de noviembre de 2026  
**Rama principal:** `main`  
**Estado:** desarrollo activo; release no aprobado. `main` tiene `BUSINESS.acceptingOrders = false`; la recepción y creación de pedidos están desactivadas.
**Fases activas:** entrega Phase 1 (zona activa más cercana) y Phase 2 (horarios semanales por zona) implementadas en código; QA local pendiente. La integración Sandwichies ↔ Cupboard conserva sus gates propios.

> Fuente de verdad: código y configuración actuales del repositorio. Las especificaciones, mockups y roadmaps describen objetivos; no prueban que una función esté implementada.

## Estado de entrega — fases aprobadas 1 y 2 (2026-11-03)

- La asignación geográfica prioriza el polígono activo que contiene el punto; si ninguno lo contiene, selecciona la zona activa válida con menor distancia estimada al borde. No existe límite máximo de distancia en esta etapa.
- El pedido guarda `zoneId`, nombre de zona, método de asignación y distancia estimada.
- La configuración administrativa de cada zona incluye horario semanal por día y zona horaria. La zona sin control de horario habilitado permanece abierta 24 horas para compatibilidad.
- El Worker valida el horario al crear el pedido y rechaza fuera de horario con `ZONE_OUTSIDE_SERVICE_HOURS`.
- El radio de mesa sigue siendo independiente: 50 m desde el ancla; capacidad máxima 9.
- Los cambios de código y pruebas se publicaron en `main`; todavía requieren ejecución de QA local y revisión visual. No se declara CI/producción aprobado.

## 1. Propósito y superficies del producto

Sandwichies es una aplicación para descubrir y configurar sándwiches, gestionar el carrito y preparar pedidos, junto con herramientas administrativas para operar pedidos, pagos e inventario.

La prioridad de UX es:
1. Cliente mobile-first.
2. Operación administrativa mobile.
3. Administración desktop para gestión integral del negocio.
4. Preparación progresiva para aplicaciones iOS y Android.

La web actual usa React y Vite. No existe todavía una aplicación nativa iOS/Android implementada en este repositorio.

## 2. Capacidades presentes en el código

### Cliente
- Catálogo y descubrimiento de recetas existentes.
- Búsqueda y filtros del catálogo.
- Carrito persistente por UID autenticado, restauración al iniciar sesión, sincronización con debounce y control optimista de conflictos entre sesiones.
- El Worker valida las configuraciones contra el catálogo compartido; el navegador no escribe el carrito directamente en Firestore.
- Selección de recogida o domicilio y captura de datos de contacto.
- Identidad de cliente con Firebase Email/Password, verificación de correo y recuperación de contraseña.
- Compatibilidad de vinculación de una sesión anónima heredada mediante `linkWithCredential`, conservando el UID; no crea nuevas sesiones anónimas.
- Perfil persistente `customers/{uid}` con nombre, teléfono, correo derivado del token y preferencias de entrega.
- Gestión de hasta 10 direcciones propias en `customers/{uid}/addresses/{addressId}`, con dirección predeterminada única.
- Ruta `/perfil` para consultar y editar datos personales y direcciones.
- Validación de solicitudes y reconstrucción confiable de pedidos en backend.
- El flujo está sujeto a `BUSINESS.acceptingOrders = false`; el storefront muestra los pedidos como cerrados y el dominio rechaza nuevas órdenes.

### Carrito — fase D

- Documento canónico: `customers/{uid}/cart/current`.
- API Worker: `GET/POST /v1/customer/cart`; requiere ID token Firebase válido y correo verificado.
- Cada escritura requiere `expectedRevision` y `mutationId`; la revisión aumenta transaccionalmente y los reintentos del mismo mutation ID son idempotentes.
- Una revisión desactualizada produce `409 CART_CONFLICT`. La UI detiene el autosave y ofrece recargar la versión remota; no hace merge automático ni sobrescritura silenciosa.
- Se almacenan configuración, nombre, identificador de línea y cantidad. Precio/costo/preview se recalculan desde el catálogo compartido al restaurar; nunca se confía en precios enviados por el cliente.
- Firestore Rules niega acceso directo del navegador a `customers/{uid}/cart/{cartId}`; solo el Worker accede con identidad de servicio.
- Después de un timeout o error interno ambiguo, la UI consulta `GET /v1/customer/cart?mutationId=<id>`. Si el servidor ya aplicó esa mutación, adopta su revisión; si no y la revisión no cambió, reintenta una sola vez el mismo payload con el mismo ID idempotente. Si hay otra revisión, conserva el conflicto y exige recarga.
- El Worker limita a 5 segundos la descarga de claves públicas de Firebase, OAuth de Google y cada petición REST de Firestore (incluida lectura del cuerpo); registra la etapa del timeout. Ante un timeout de commit no bloquea la respuesta intentando rollback: la UI reconcilia el resultado mediante el ID idempotente. El Worker registra duración/resultado de lecturas y escrituras del carrito sin incluir UID ni contenido.
- QA local de esta fase todavía pendiente; no declarar pruebas aprobadas por el hecho de que el código esté en `main`.

### Administración
- Firebase Authentication y custom claim `admin: true`.
- Lectura y operación administrativa de pedidos.
- Estados de pedido y de pago diferenciados.
- Consulta y gestión de inventario, compras y ajustes.
- Acciones privilegiadas protegidas por backend y reglas de Firestore.

### Backend e inventario
- `createOrder`: callable para validar y reconstruir la solicitud con valores confiables del servidor.
- `transitionOrderStatus`: transición de estados a través del backend autorizado.
- Funciones de inventario con operaciones idempotentes.
- Integración con Cupboard para reservas, movimientos y reversiones de inventario.
- La sincronización de consumo físico y el criterio contable de venta completada permanecen separados.

## 3. Arquitectura

- `src/`: interfaz React/Vite, rutas, páginas y componentes.
- `shared/`: catálogo, precios, negocio, recetas, pedidos e inventario compartidos.
- `functions/index.js`: Cloud Functions y operaciones confiables.
- `firestore.rules`: permisos de lectura y escritura.
- `test/`: pruebas unitarias y de seguridad.
- `scripts/`: validaciones, smoke, integración y utilidades de operación.
- `docs/`: decisiones, auditorías, producto y documentación técnica.

Flujo arquitectónico esperado:

```
Cliente / Administración
        ↓
Adaptadores de interfaz
        ↓
Dominio compartido (shared/)
        ↓
Backend confiable (Functions en código; alternativa $0 pendiente de decisión)
        ↓
Firestore / integración Cupboard
```

El navegador es un entorno no confiable. No aceptar desde el cliente precios, totales, costos, utilidad, consecutivos ni estados privilegiados como fuente de verdad.

**Estado de despliegue verificado (31-oct-2026):** el código de `functions/` existe, pero `firebase functions:list --project sandwich-pro` y `gcloud functions list` devolvieron cero funciones; las URLs de Cloud Functions respondieron 404. Las Functions no son endpoints productivos disponibles. No habilitar Firebase Blaze para resolverlo.

### Migración backend a Cloudflare Workers — implementación en código

Se implementó `app/worker/` como backend alternativo bajo el objetivo de presupuesto $0. El Worker aún no está desplegado ni conectado a credenciales reales.

**Backend implementado en el repositorio:**
- Verificación Firebase ID token RS256 con JWK oficial; valida firma, issuer, audience, subject, `iat`, `auth_time` y `exp`.
- Cliente Firestore REST con OAuth firmado por service account y transacciones Firestore.
- Identidades separadas para Firestore de Sandwichies y Cupboard.
- CORS con allowlist de orígenes, métodos y cabeceras.
- Creación de pedidos con precios, costos y consumo de ingredientes calculados desde `shared/`; request UUID idempotente y consecutivo transaccional.
- Transiciones administrativas de pedido con bloqueo temporal.
- Consumo de inventario Cupboard al confirmar y reversión al cancelar pedidos no pagados.
- Compras y ajustes manuales de inventario desde el administrador.
- Zonas de entrega, asignación de mesas virtuales por proximidad, llegada de cliente, estados logísticos individuales y cierre/expiración programada.
- Vistas de cliente sanitizadas: no devuelven costos internos ni desglose de consumo.
- Frontend de cliente y administración migrado en código al adaptador `src/api/worker.js`.
- La consola de Entregas obtiene zonas, mesas, miembros y actividad desde rutas administrativas del Worker; evita leer esas colecciones directamente desde el navegador.

**Rutas principales:** `POST /v1/orders`, `GET /v1/orders/:id`, `POST /v1/admin/orders/:id/status`, `POST /v1/admin/inventory/movements`, `POST /v1/admin/delivery-zones`, `POST /v1/admin/orders/:id/delivery`, `POST /v1/customer/orders/:id/ready` y `POST /v1/admin/virtual-tables/:id/close`. El detalle completo está en `app/worker/README.md`.

**Conexión segura con Cupboard:** el Worker exige dos credenciales de servicio independientes y verifica que sus `project_id` correspondan a proyectos distintos. Los movimientos comerciales se limitan desde el código a `households/{householdId}/workspaces/sandwichies/`. Consumos, reversos y movimientos manuales usan IDs deterministas y transacciones para soportar reintentos sin duplicar descuentos.

**Límite de seguridad IAM:** el acceso Firestore con service account omite Firestore Security Rules y los permisos IAM de Firestore son de alcance de proyecto, no de colección. Por eso las dos identidades deben mantenerse separadas, con permisos de datos mínimos en sus proyectos respectivos, secretos protegidos y revisión explícita de ese alcance antes de configurar credenciales. El código no sustituye una política IAM por colección.

**Estado operativo y gates pendientes:**
- `ORDERS_ENABLED=false` en Wrangler y `BUSINESS.acceptingOrders=false` en el dominio compartido; ambos controles mantienen desactivada la recepción de pedidos.
- En Vite development, Firestore Web SDK y Worker usan el emulador local; Firebase Auth conserva el proyecto configurado para emitir tokens. El emulador exporta/importa datos desde `app/.emulator-data` al reiniciar.
- `SANDWICHIES_SERVICE_ACCOUNT_JSON`, `CUPBOARD_SERVICE_ACCOUNT_JSON`, `CUPBOARD_PROJECT_ID`, `CUPBOARD_HOUSEHOLD_ID` y el mapeo completo de ingredientes aún no están configurados con valores reales.
- El frontend espera `VITE_SANDWICHIES_WORKER_URL`; `.env.example` lo deja vacío deliberadamente.
- Se añadieron pruebas Worker para autenticación, CORS, Firestore REST, idempotencia, consumo, insuficiencia de stock y reversión. **Todavía deben ejecutarse** en local/CI; no afirmar que pasan hasta tener resultados.
- El cron de expiración está declarado en Wrangler, pero no está validado en un Worker desplegado.
- No se ha desplegado el Worker, habilitado Cloudflare Builds, cambiado la configuración productiva de Vercel, creado credenciales ni modificado datos reales.

La configuración y los gates se documentan en `app/worker/README.md`. Comandos desde `app/`:

```bash
npm run worker:test
npm run check
```

La publicación manual futura sería:

```bash
npx wrangler deploy --config app/worker/wrangler.toml
```

No ejecutar sin revisión de IAM, secretos, mapeo, cuotas y autorización explícita. No habilitar Firebase Blaze ni facturación.

## 4. Stack tecnológico y herramientas

Esta sección distingue dependencias que aparecen en el repositorio, servicios configurados y alternativas todavía evaluadas. Las versiones indicadas corresponden a los rangos declarados en `package.json`, no necesariamente a la versión exacta instalada en cada equipo.

### Lenguajes y plataforma
- **JavaScript (ES modules):** lenguaje principal de frontend, dominio compartido y funciones backend.
- **HTML y CSS:** estructura, estilos y diseño responsive de la interfaz.
- **Node.js 22:** runtime declarado para Firebase Functions.
- **npm:** instalación de dependencias y ejecución de scripts.

### Frontend
- **React 19:** interfaz basada en componentes.
- **React DOM 19:** renderizado web.
- **React Router 7:** navegación y rutas.
- **Vite 8 + plugin React:** servidor de desarrollo y build.
- **Rolldown (configuración de build de Vite):** división de bundles y optimización de salida.
- **CSS propio:** estilos de storefront, administración y experiencia mobile-first.

### Backend y datos — implementación en el código
- **Firebase Authentication:** autenticación administrativa y sesiones anónimas de clientes.
- **Cloud Firestore:** pedidos, catálogo operativo, zonas, mesas virtuales, seguimiento e inventario sincronizado.
- **Firebase Cloud Functions v2:** código callable, trigger de Firestore y tarea programada para operaciones confiables.
- **Firebase Admin SDK:** acceso privilegiado a Firestore desde funciones.
- **Firestore Security Rules:** límites de lectura y escritura por identidad y rol.
- **Firebase Emulator Suite:** ejecución local de Firestore y Functions para pruebas.
- **Firebase CLI:** selección de proyecto, emuladores, diagnóstico y despliegue.

**Limitación de producción:** el proyecto Firebase `sandwich-pro` está en el plan Spark y no tiene Cloud Functions desplegadas. Las funciones están implementadas en el repositorio y se prueban con emuladores, pero no se deben considerar endpoints productivos disponibles. Cloud Functions requiere asociar facturación y plan Blaze para desplegar; eso contradice el presupuesto $0 vigente. No activar Blaze ni vincular una cuenta de facturación como parte de esta etapa.

### Mapas y geolocalización
- **Leaflet 1.9 + React-Leaflet 5:** renderizado de mapas en la interfaz.
- **OpenStreetMap:** cartografía base prevista; el uso de tiles debe respetar la política y capacidad del proveedor.
- **geofire-common:** utilidades geoespaciales para consultas por proximidad.
- **Lógica compartida propia:** validación de polígonos, cobertura y agrupación de puntos de encuentro.

### Integraciones del producto
- **Cupboard:** integración entre proyectos Firebase para catálogo, balances y movimientos de inventario; adaptadores y sincronización idempotente están en el código. La configuración real, permisos cruzados y pruebas operativas siguen siendo gates pendientes.
- **Vercel:** plataforma de hosting/despliegue web observada en el proyecto. El estado de un deployment no demuestra por sí solo que los endpoints backend estén disponibles.
- **WhatsApp / enlaces de mapas:** generación de mensajes de pedido y enlaces externos desde el cliente; no equivalen a una API transaccional de WhatsApp ni a un proveedor de mapas contratado.

### Calidad, pruebas y herramientas de desarrollo
- **ESLint 9:** análisis estático y lint.
- **Node.js Test Runner (`node:test`):** pruebas unitarias y de integración.
- **@firebase/rules-unit-testing:** pruebas de reglas Firestore.
- **Firebase Emulator Suite:** pruebas aisladas sin escribir en los proyectos reales.
- **Scripts propios:** auditoría npm, pruebas de dominio, reglas, integración, preflight de Cupboard, smoke test, build y control de tamaño de bundle.
- **Git + GitHub:** control de versiones, revisión y trazabilidad de cambios.
- **PowerShell:** comandos y operación local en el entorno Windows utilizado para el desarrollo.

Comandos principales desde `app/`:
```bash
npm install
npm run dev
npm run lint
npm test
npm run security:test
npm run integration:test
npm run build
npm run performance:check
npm run smoke
npm run check
```

### Presupuesto $0 y tecnologías evaluadas

- **Firebase Spark:** plan vigente objetivo para Authentication y Firestore dentro de sus cuotas y límites gratuitos.
- **Cloudflare Workers Free:** alternativa candidata para alojar endpoints backend sin Blaze. A 31-oct-2026, la documentación oficial indica 100.000 solicitudes/día y 10 ms de CPU por invocación en Free. Antes de adoptarlo hay que validar autenticación Firebase, acceso seguro a Firestore, transacciones, integración Cupboard, límites, cron y comportamiento al agotar cuota. No está añadido al repositorio ni desplegado.
- **Vercel Free:** mantener el frontend dentro de las condiciones y cuotas del plan gratuito.
- No se autoriza facturación automática, upgrade a planes pagos, ni servicios que puedan generar cargos sin una decisión explícita del propietario.

Referencias oficiales:
- [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

## 5. Estado de avance

Los porcentajes son estimaciones de avance documental/funcional por área, no métricas de líneas de código ni de release.

| Área | Avance estimado | Observación |
|---|---:|---|
| Dominio, catálogo, precios y contratos de pedido | 100% | Base centralizada y pruebas existentes |
| Seguridad y reglas de acceso | 100% | Base implementada; mantener regresiones |
| Calidad automatizada local | 80% | Scripts disponibles; falta repetir el gate sobre el estado actual |
| UX cliente web | 70% | Flujos base; validación completa pendiente |
| UX administración | 85% | Herramientas principales; validación operativa pendiente |
| Integración con Cupboard | 65% | Falta configuración real y pruebas cruzadas |
| Recepción de pedidos | Desactivada | `BUSINESS.acceptingOrders=false` y `ORDERS_ENABLED=false`; no se aceptan nuevas órdenes |
| Mesas virtuales | Implementación base | Cliente, funciones, consola admin y reglas; validación/release pendientes |
| iOS y Android nativos | 0% código | Plan de crecimiento, sin app nativa |

No se calcula un promedio general porque las áreas tienen pesos y criterios de finalización distintos.

## 6. Fase activa: cerrar la integración con Cupboard

### Implementado/documentado
- Adaptador entre proyectos Firebase con Admin SDK.
- Reserva de existencias al confirmar un pedido.
- IDs deterministas para idempotencia.
- Protección ante reutilización conflictiva de claves idempotentes.
- Reversión de existencias al cancelar después de confirmar.
- Sincronización de compras y ajustes manuales desde Sandwichies.
- Preflight de configuración y mapeo.

### Pendiente
1. Configurar el ID real del hogar de Cupboard.
2. Completar y validar el mapeo de ingredientes.
3. Ejecutar `npm run cupboard:preflight` con variables reales.
4. Conceder a la identidad real de Functions los permisos mínimos necesarios en Cupboard.
5. Probar confirmar, cancelar, falta de stock, reintentos y duplicados en emuladores/entorno controlado.
6. Ejecutar la suite de ambos proyectos y revisar los movimientos resultantes.

No ejecutar importaciones ni sincronizaciones contra datos reales sin revisar primero el modo dry-run, las variables y el destino.

## 7. Mesas virtuales — implementación base

La referencia vigente está en `docs/product/virtual-tables/`.

Reglas definidas:
- Asignación automática por backend; el cliente no elige mesa.
- Agrupación dentro de 50 m desde el punto ancla de la mesa.
- Máximo 9 pedidos activos por mesa.
- Cada pedido conserva su identidad, cliente, artículos, pago y estados.
- Zonas de servicio mediante polígonos administrables.
- Inactividad inicial de 60 minutos, configurable.
- El cliente solo puede consultar su propio pedido.
- El administrador puede operar desde móvil y desktop.
- No alterar pagos ni duplicar movimientos de inventario por agrupar pedidos.

El backend, las reglas Firestore y la consola admin están implementados. Pedido nuevo, llegada del cliente y cambios logísticos admin reinician los 60 minutos. Al vencer, una mesa deja de aceptar pedidos y conserva pedidos activos e historial para coordinación individual. Validar configuración, operación y diseño en proyecto no productivo antes de release.

Los enlaces de Canva son referencias de diseño. Los archivos binarios exportados de los mockups aún no están archivados dentro del repositorio.

## 8. Crecimiento hacia iOS y Android

La ruta propuesta es incremental:

1. **Preparación mobile-first:** terminar y validar UX web móvil, estados, accesibilidad y navegación.
2. **Separación de dominio y backend:** asegurar contratos estables para catálogo, precios, autenticación, pedidos, seguimiento y operaciones.
3. **ADR tecnológico:** comparar React Native/Expo, PWA y alternativas según capacidades nativas, costos, mantenimiento y experiencia.
4. **Android MVP:** catálogo, carrito, identidad/sesión, pedido y seguimiento; distribución interna y pruebas en dispositivos.
5. **iOS MVP:** paridad funcional adaptada a iPhone, pruebas en dispositivos y distribución interna.
6. **Publicación y evolución:** notificaciones, enlaces profundos, analítica, privacidad, observabilidad, soporte y releases.

No migrar el frontend actual ni duplicar reglas de negocio antes de una decisión arquitectónica documentada. Las aplicaciones móviles deben consumir el backend confiable; nunca deben convertirse en autoridad de precios, pagos o inventario.

## 9. Firebase, seguridad y release

- `app/shared/business.js` tiene `BUSINESS.acceptingOrders = true` en `main` desde `270303d`, tras instrucción previa del propietario de conservar ese cambio.
- `MASTERPROMPT.md`, los requisitos de storefront y la checklist de release requieren `false` hasta completar el release. La configuración local y la política documentada están en conflicto. No sobreescribir el commit del propietario sin instrucción directa; no hacer push/despliegue ni aceptar pedidos hasta resolverlo.
- La autenticación administrativa usa Firebase Auth y custom claim `admin: true`.
- El cliente usa una instancia Firebase separada para sesiones anónimas.
- Firestore Rules deben continuar restrictivas y negar cualquier operación no declarada.
- Las escrituras privilegiadas deben pasar por Cloud Functions con validación y autorización.
- No desplegar Functions/Rules, activar facturación ni procesar pedidos reales sin autorización explícita.
- No cambiar proveedores, métodos, comisiones o políticas de pago; Tap to Pay está fuera de alcance.

La configuración local del proyecto Firebase se define en `.firebaserc`. Verificar el proyecto destino antes de ejecutar cualquier comando Firebase. Priorizar emuladores y proyectos demo para pruebas.

## 10. Calidad y verificación

Scripts definidos en `package.json`:

| Comando | Propósito |
|---|---|
| `npm run lint` | ESLint |
| `npm test` | Pruebas unitarias de dominio |
| `npm run security:test` | Reglas Firestore en Emulator Suite |
| `npm run integration:test` | Integración Functions/Firestore e inventario |
| `npm run build` | Build de Vite |
| `npm run performance:check` | Presupuesto de bundle |
| `npm run smoke` | Smoke de entrada |
| `npm run check` | Gate combinado |
| `npm run release:verify` | Verificaciones previas de release |
| `npm run cupboard:preflight` | Revisión de configuración de integración |
| `npm run cupboard:catalog-sync` | Sincronización del catálogo compartido |

Desde esta carpeta:

```bash
npm install
npm run dev
npm run check
```

Para pruebas de reglas, se requiere Java disponible en `PATH`. Usa exclusivamente el proyecto demo/emuladores durante pruebas automatizadas.

### Evidencia de calidad conocida
- El **30 de octubre de 2026**, `npm run check` pasó lint, 40 pruebas unitarias, 9 pruebas de reglas, 7 pruebas de integración, build, presupuesto de bundle y smoke para `/` y `/admin`.
- La auditoría no encontró vulnerabilidades altas/críticas; reportó 6 moderadas transitivas en `glob` y `minimatch`.
- `expireVirtualTables` no se ejecutó durante el gate porque Pub/Sub Emulator no estaba iniciado; su programación requiere validación separada.
- Se revisó visualmente el storefront local en móvil y escritorio, incluido búsqueda, filtros, detalle de ingredientes y navegación del carrito. No se envió pedido. `/admin` llegó al login, sin revisión autenticada del dashboard.
- Esta validación es local; los cambios no se han verificado en CI.
- Los workflows recientes de GitHub Actions reportan fallo sin pasos ejecutados; la causa no queda demostrada por esa evidencia. No marcar CI como aprobado.
- El estado Vercel del commit documental más reciente consultado fue exitoso; no demuestra el funcionamiento de checkout ni la disponibilidad de Functions.

## 11. Orden recomendado de trabajo

1. Cerrar la configuración y las pruebas cruzadas de Cupboard.
2. Ejecutar `npm run check` en el estado actual y recuperar CI verificable.
3. Auditar el flujo cliente completo en mobile y desktop; no desplegar ni procesar pedidos reales.
4. Validar la operación administrativa, permisos, inventario y recuperación de errores.
5. Validar visual y operativamente las mesas virtuales implementadas en entorno no productivo.
6. Preparar contratos de dominio/API y un ADR para la estrategia iOS/Android.
7. Ejecutar release verification y solicitar autorización separada antes de cualquier lanzamiento.

---

**Regla permanente:** implementación, pruebas, despliegue y lanzamiento son etapas distintas. Ninguna documentación o mockup habilita por sí sola pedidos reales.

## AI handoff checkpoint — 2026-11-02

Sandwichies remains one of the four separate PALMI-D3V workspace repositories. The active Worker implementation is in `app/worker/`; Cloudflare deployment remains intentionally disabled.

### Local Worker delivery flow

- The Worker now persists delivery zones using `POST /v1/admin/delivery-zones`.
- The admin console reads zones, active/expired tables, sanitized members and recent activity through protected Worker routes:
  - `GET /v1/admin/delivery-operations`
  - `GET /v1/admin/virtual-tables/:id/members`
- `VirtualTables.jsx` no longer reads those operational collections directly from the browser; it refreshes through the Worker API.
- Local mode uses Wrangler on `127.0.0.1:8787` and Firestore Emulator on `127.0.0.1:8080`, with project ID `sandwich-pro`.
- Firestore Emulator transport requires `LOCAL_DEV=true` and a loopback host. It uses the emulator-only owner token; production service-account OAuth remains unchanged.
- Firebase Authentication still issues the administrator ID token for Worker verification. The local Worker sends zone/table/event persistence to the emulator, not the production Firestore database.
- Local environment examples are `.env.local.example` and `worker/.dev.vars.example`; the copied real files are gitignored.

### Validation and boundaries

The user's last full local QA run before this change passed 30 Worker tests, 40 domain tests, 9 Firestore rules tests, 7 Functions/Firestore integration tests, build, bundle budget and smoke. New Worker tests cover the local emulator transport guard, zone create/update validation, admin listing and member-data sanitization. GitHub Actions for commit `ddc8171` passed lint, domain tests, Worker tests, Firestore security regression, Functions/Firestore integration, production build and smoke. The actual three-process local UI + Wrangler + Firestore Emulator flow still requires owner-side verification.

`ORDERS_ENABLED=false` remains the safety default. No Cloudflare deployment, Firebase Blaze upgrade, production Firestore write, production secret configuration or real order is authorized or performed. Cupboard's separate service-account boundary remains required for stock movements and is not configured by the local zone workflow.

**Next gate:** pull the current `main`, run the documented three-terminal local setup, create/edit a test polygon and confirm it persists only in the emulator. After that, validate the full Worker + Cupboard integration and separately review Cloudflare secrets/IAM before any deployment. Keep Cloudflare Builds disabled and do not enable billing.


## Desarrollo local del Worker — actualizado 2026-11-02

Se preparó un modo local de la API Worker con Wrangler + Firestore Emulator para desarrollar zonas y mesas sin service accounts ni escrituras en Firebase remoto.

- API local: `http://127.0.0.1:8787`.
- Firestore Emulator: `127.0.0.1:8080`, proyecto local `sandwich-pro`.
- Frontend: `http://127.0.0.1:5182`, con `VITE_SANDWICHIES_WORKER_URL` apuntando al Worker local.
- `LOCAL_DEV=true` y host loopback son obligatorios para habilitar el adaptador del emulador; el Worker usa el token especial de emulador únicamente en ese modo.
- La pantalla Entregas ahora lee zonas, mesas, integrantes y actividad mediante endpoints protegidos del Worker, con refresco periódico y después de acciones.
- Los endpoints nuevos son `GET /v1/admin/delivery-operations` y `GET /v1/admin/virtual-tables/:id/members`.
- El endpoint de miembros omite `customerUid`; los eventos omiten `actorUid`.
- `ORDERS_ENABLED=false` permanece intacto. Este modo no configura Cupboard, pedidos reales, Cloudflare remoto ni credenciales productivas.

Guía de arranque: [docs/development/local-worker.md](docs/development/local-worker.md). Variables de ejemplo: `.env.local.example` y `worker/.dev.vars.example`; los archivos reales quedan ignorados por Git.


## Fase E — Historial privado, seguimiento y recuperación

- Endpoint `GET /v1/customer/orders?limit=100`: el Worker deriva el propietario desde el `sub` del ID token verificado; no acepta UID del navegador.
- El historial queda limitado a los pedidos de `customerUid` del usuario autenticado y devuelve una vista cliente sanitizada.
- Endpoint `GET /v1/orders/:id` mantiene el control de propiedad y combina el pedido con el tracking privado `customerOrderTracking/{uid}/orders/{orderId}`.
- El storefront incorpora «Mis pedidos», listado, detalle y recuperación del seguimiento al volver a iniciar sesión o usar otro navegador.
- Recuperar un pedido no crea otro pedido ni altera el carrito o el inventario.
- Las reglas mantienen lectura del tracking limitada al propietario y administración; el historial de pedidos no se consulta directamente desde el navegador.

## Fase F — QA integral con agentes especializados

`npm run qa` ejecuta un coordinador secuencial que detiene el proceso ante el primer agente fallido:

| Agente | Responsabilidad |
|---|---|
| Worker/API | autenticación, CORS, endpoints, idempotencia y lógica de pedidos |
| Cliente/sesión | historial privado, aislamiento UID, sanitización y recuperación |
| Dominio | catálogo, precios, promociones e inventario |
| Seguridad | Firestore Rules con Emulator Suite |
| Integración | Cupboard, inventario, saga y mesas virtuales en proyectos demo |
| Frontend | lint, build, bundle budget y smoke HTTP |

El recorrido real de navegador, cierre de sesión, dos perfiles de navegador, recuperación y responsive se registra por separado en `docs/qa/browser-recovery.md`. El runner automatizado no sustituye esta evidencia manual ni declara el QA de navegador aprobado.

**Estado de validación de E/F:** implementación en `main`; pruebas locales, CI y recorrido de navegador deben ejecutarse contra el commit actual antes de declarar QA aprobado. No se ha desplegado ni habilitado recepción de pedidos.
