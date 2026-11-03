# ROADMAP — Sandwichies

## Delivery phases approved — 2026-11-03

### Delivery Phase 1 — Automatic nearest active zone
**Implementation:** published to `main`; local QA pending.
- [x] Prefer an active polygon containing the customer point.
- [x] If the point is outside all active polygons, select the active polygon with the shortest edge distance.
- [x] No maximum distance cap at this initial rollout stage.
- [x] Exclude inactive/invalid polygons and return no assignment when there are no active valid zones.
- [x] Persist assignment method and estimated edge distance with the delivery record.
- [x] Keep virtual-table grouping independent: 50 m fixed-anchor radius and maximum capacity 9.
- [ ] Run Worker tests, integration tests and manual customer coverage checks locally.

### Delivery Phase 2 — Zone service schedules
**Implementation:** published to `main`; local QA pending.
- [x] Store a per-zone weekly schedule in the delivery-zone document.
- [x] Configure timezone explicitly; default is `America/Bogota`.
- [x] Admin can enable/disable schedule enforcement and configure each weekday's opening/closing time.
- [x] A day with no interval is closed when schedule enforcement is enabled.
- [x] Validate schedule on the Worker before saving.
- [x] Validate selected-zone hours again during order creation; reject out-of-hours orders with `ZONE_OUTSIDE_SERVICE_HOURS`.
- [x] Preserve backward compatibility: zones without schedule enforcement remain open 24 hours until the administrator configures a schedule.
- [ ] Run automated tests and verify customer-facing error messaging in local browser.
- [ ] Verify daylight/timezone boundaries and operational exceptions before release.

**Release note:** source implementation is not QA approval, deployment, or permission to accept production orders. Do not deploy or enable real orders without explicit owner approval.

## Customer phone verification — implemented behind an explicit feature flag

- [x] Normalize valid Colombian mobile numbers to E.164 (+57XXXXXXXXXX)
- [x] Reject landlines, malformed lengths and non-mobile Colombian prefixes in checkout validation
- [x] Add Firebase Phone Auth SMS request/code confirmation UI with invisible reCAPTCHA
- [x] Require a confirmed Firebase phone number to match the checkout number when verification is enabled
- [x] Clear verified state when the customer edits the phone field
- [x] Add tests for phone normalization and invalid formats
- [x] Keep SMS verification disabled unless `VITE_PHONE_VERIFICATION_ENABLED=true`
- [ ] Before enabling, confirm Firebase Phone provider settings, authorized domains, reCAPTCHA behavior and current SMS billing/quotas
- [ ] Test SMS verification end-to-end in a controlled Firebase project
- [ ] Decide whether SMS is acceptable or an approved WhatsApp Business verification provider is required
- [x] Keep SMS verification out of the customer flow; use Firebase Anonymous Auth for customer sessions
- [x] Implement the customer order-submission flow for controlled testing; keep `BUSINESS.acceptingOrders = false` until explicit release approval and do not deploy Firebase as part of this change

**Cost/safety note:** SMS verification is intentionally feature-flagged off by default. Enabling it can incur SMS charges depending on Firebase configuration and usage. A WhatsApp click-to-chat link is not phone verification.

## Storefront typography refinement — implemented

- [x] Load DM Sans for product controls, body UI, filter/search controls and cart
- [x] Load Fraunces for editorial storefront headings
- [x] Apply the same font family to native filter/sort selects and their option list
- [ ] Owner to verify typography visually on desktop/mobile; external Google Fonts availability may affect fallback
- [x] Keep ordering disabled in source until explicit release approval; no Firebase deployment

## Cart presentation polish — implemented

- [x] Increase cart width for a less cramped desktop summary
- [x] Give each line item a clear dark surface, readable ingredient details and visual separation
- [x] Align line total, quantity controls and remove action into a consistent hierarchy
- [x] Improve empty/clear-cart controls and subtotal/total contrast
- [x] Add a stacked mobile layout and reduced-motion support
- [ ] Owner to verify visual result in desktop and mobile browser after pull
- [ ] Do not activate checkout or deploy Firebase as part of visual polish

## Delivery coverage policy — implemented, manual only

- [x] Set the operational origin label to `Cra 96a #49-110`
- [x] Configure a 10 km reference radius
- [x] Add Haversine distance assessment when verified coordinates are supplied
- [x] Keep all coverage decisions in manual review; no address is automatically approved or rejected
- [x] Explain the radius and manual confirmation in the customer delivery form
- [x] Add automated tests for radius configuration, missing/invalid coordinates, inside/outside radius
- [x] Keep `BUSINESS.acceptingOrders = false`; no Firebase deploy or order activation
- [ ] Confirm the city/country and geocoded coordinates for the operational origin before using distance estimates operationally
- [ ] Add a trusted address-geocoding source only if approved; current map link is for customer lookup, not a verified geocode

## Customer delivery details — implementation started

- [x] Add visible customer name and WhatsApp fields outside the retired sandwich builder
- [x] Add pickup vs. delivery selection with the configured delivery fee
- [x] Capture street/number, neighborhood and optional delivery reference
- [x] Add a map lookup link for the composed address
- [x] Validate required delivery address parts and keep the existing trusted server address contract
- [ ] Confirm official delivery zones/radius and the operational address used as the delivery origin
- [x] Browser-test mobile/desktop form, map link and pickup/delivery totals (owner-confirmed)
- [x] Automated lint, domain tests, build and smoke pass (owner-confirmed)
- [x] Implement checkout form and callable integration for testing; source remains `BUSINESS.acceptingOrders = false`; no Functions/Rules deployment performed

## Storefront catalog-only redesign — implementation started

- [x] Remove the visible custom sandwich builder from the customer journey
- [x] Make existing menu cards add the existing recipe directly to the cart at its 15 cm base price
- [x] Reorganize catalog into a responsive multi-column product grid
- [x] Shift visual system to dark, appetizing surfaces with warm food accents
- [x] Add subtle card entrance, hover, and image transitions with reduced-motion support
- [ ] Run lint, domain tests, build, and smoke against this commit
- [ ] Visually inspect product imagery and responsive layout in browser
- [x] Add cart quantity increment/decrement, per-line totals, remove, and clear actions
- [x] Merge repeated additions of the same recipe configuration into a quantity
- [x] Recalculate totals from quantities and expand quantities into separate trusted order line configurations
- [ ] Verify cart contents, quantities, trusted order request, and closed-checkout behavior end-to-end

# ROADMAP — Sandwichies

## Mesas virtuales — implementación base en validación

- [x] Cliente captura punto GPS o manual, valida cobertura y consulta su propio tracking.
- [x] Backend valida polígonos, asigna desde el ancla a 50 m, limita a 9 activos e implementa idempotencia.
- [x] Admin consulta mapa/cola, configura zonas y opera pedidos individualmente.
- [x] Pedido nuevo, llegada del cliente y cambio logístico admin reinician el umbral de 60 minutos.
- [x] Al expirar, cerrar nuevas asignaciones y conservar historial/pedidos pendientes para coordinación individual.
- [ ] Revisar UX visualmente en móvil y escritorio; verificar polígonos reales en proyecto de pruebas.
- [ ] Ejecutar gate completo y cerrar validación de seguridad/operación antes de considerar release.

No desplegar ni habilitar recepción de pedidos reales como parte de esta entrega.

## UX cliente y operaciones — actualizaciones actuales

- [x] Mantener búsqueda y categorías visibles y plegar filtros secundarios de precio/orden en móvil.
- [x] Mostrar acceso fijo al carrito con cantidad y total cuando tiene productos.
- [x] Hacer visible el conteo agregado al volver a agregar una receta canónica.
- [x] Mostrar contacto, modalidad logística y siguiente transición en tarjetas de pedidos.
- [x] Dar navegación del dashboard hacia pedidos activos, pagos pendientes y listos.
- [x] Mostrar estados de sincronización y de error de la cola con semántica accesible.
- [x] Mostrar punto de encuentro y enlace a Maps en el detalle admin; impedir cerrar el modal mientras se guarda.
- [ ] Validar pantallas admin autenticadas con datos de prueba en navegador y revisar 320–430 px, tablet y desktop.

No se ejecutaron pedidos reales ni se hizo despliegue. Resolver antes de push el estado `acceptingOrders = true` de `270303d`, incompatible con el release gate de este roadmap.

**Current release line:** MVP hardening → Product Experience Evolution  
**Operational state:** `main` includes commit `270303d` with `acceptingOrders = true`. This is not release approval and conflicts with the release gate below. No production deployment is evidenced.
**Status:** Fases A–D have implementation baselines on main. The owner confirmed local `npm run check` and browser functionality on 2026-10-22; CI confirmation and production release gates remain pending.

## Fase activa — Fase 3: Conectar Sandwichies con Cupboard

**Estado:** implementación Cupboard en validación; checkout y release dependen de configuración e instrucciones del propietario.

- [x] Añadir adaptador seguro entre los dos proyectos de Firebase usando Admin SDK y configuración explícita.
- [x] Reservar existencias en Cupboard al confirmar un pedido, con una transacción que cubre todos sus ingredientes.
- [x] Evitar descuentos y reversiones duplicados mediante IDs deterministas.
- [x] Rechazar una clave de idempotencia reutilizada con cantidades o datos distintos; añadir prueba de regresión para proteger el stock ante conflictos.
- [x] Reponer stock al cancelar después de confirmar; cancelar mientras está pendiente no mueve inventario.
- [x] Bloquear cambios directos de estado desde el navegador y dirigirlos por una callable protegida.
- [x] Mantener separado el consumo físico del criterio contable de venta completada (entregado + pagado).
- [x] Sincronizar compras y ajustes manuales del panel de Sandwichies con Cupboard; exigir un ID idempotente por operación.
- [x] Documentar configuración, mapeo y permisos entre proyectos.
- [x] Añadir `npm run cupboard:preflight` para detectar configuración incompleta antes de ejecutar pruebas; no conecta ni modifica Firebase.
- [ ] Sustituir el ID de hogar de ejemplo por el hogar real de Cupboard y revisar el mapeo de cada ingrediente.
- [ ] Ejecutar el preflight con las variables reales y corregir todos los errores reportados.
- [ ] Conceder `roles/datastore.user` a la identidad real del runtime de Functions sobre el proyecto Cupboard.
- [ ] Ejecutar `npm run check` y la integración en emuladores; revisar resultados de ambas aplicaciones en local.
- [ ] Verificar flujos de confirmar, cancelar y falta de stock en entorno de pruebas antes de cualquier release.

**Límite operativo:** no desplegar Functions/Rules ni activar pedidos como parte de esta fase. La conexión no se considera terminada hasta completar la configuración real y las pruebas.

## North star

Build a trustworthy sandwich ordering product that feels distinctive, interactive, mobile-first and intentionally designed.

Customers should be able to discover, configure and submit sandwiches reliably. Pricing and financial values must remain trusted. Administrators must operate safely. The visual and interaction system should make Sandwichies feel like a real food product rather than a generic CRUD application.

---

## Execution track A–D — current work

This track is the current hands-on sequence alongside the numbered historical/product phases.

### Fase A — Integridad y release
- [x] Reconcile the six Excel-defined recipes and current unit purchase costs in documentation.
- [x] Restrict browser-admin order updates to operational status/payment status and update timestamp.
- [x] Add regression cases for protected order, customer, financial and inventory fields.
- [x] Run dependency audit, lint, domain tests, Firestore Emulator rules tests, build and smoke locally (owner-confirmed 2026-10-19).
- [ ] Validate rules and error/retry behavior in a non-production environment.
- [x] Add an emulator integration test that completes a sale, verifies inventory consumption, then updates the completed order again to assert no duplicate deduction.
- [x] Run the Functions + Firestore emulator integration test locally; completed-sale inventory was posted once and a later order update did not duplicate the deduction (owner-confirmed 2026-10-19).
- [ ] Confirm the GitHub Actions CI result for the integration test before marking recovery/idempotency validated for CI.

### Fase B — Diseño y prototipo
- [x] Add a standalone responsive storefront prototype outside the production app bundle.
- [x] Document desktop/mobile hierarchy and loading, empty, error and checkout-disabled states.
- [ ] Human visual review at mobile and desktop widths.
- [ ] Approve prototype before implementing its patterns in the functional storefront.

### Fase C — Storefront
- [x] Add menu search across product names/descriptions alongside discovery segments.
- [x] Improve empty search results and reset actions.
- [x] Add an explicit submit-handler guard while `acceptingOrders = false`, preserving the cart.
- [x] Preserve shared catalog, pricing and trusted order contracts.
- [ ] Browser-test discovery, configurator, cart and disabled-checkout behavior.

### Fase D — Administración
- [x] Add payment-status filtering and resettable search/status/payment filters to order history.
- [x] Make the payment-pending summary shortcut open orders with pending payments.
- [x] Add responsive styling for the new admin filter controls.
- [ ] Validate permission failures, duplicate events, inventory recovery and responsive layouts.
- [ ] Evaluate pagination only against observed order volume.

**Release boundary:** no production deploy, no rules/functions deployment, and no enabling checkout during this work. `BUSINESS.acceptingOrders` stays false.

---

## Phase 0 — Governance + Masterprompt

- [x] Root README
- [x] Root CONTEXT
- [x] Root STEPBYSTEP
- [x] Root ROADMAP
- [x] Root MASTERPROMPT
- [x] Historical documentation preserved
- [x] Repository placement rules
- [x] Current architecture identified
- [x] Data Connect classified as non-production/experimental
- [x] Product/UX operating contract defined

## Phase 1 — Domain integrity

- [x] Shared catalog
- [x] Shared pricing
- [x] Shared recipes
- [x] Shared business configuration
- [x] Trusted order request validation
- [x] Server-side order reconstruction
- [x] Transactional order numbering
- [x] Financial tampering tests

## Phase 2 — Security hardening

- [x] Firebase Auth for admin
- [x] Admin custom claim
- [x] Firestore admin authorization
- [x] Direct browser order creation denied
- [x] Direct counter access denied
- [x] Admin-only order reads/updates
- [x] Firebase Emulator Rules tests
- [x] Security regression suite in CI

## Phase 3 — Quality and CI

- [x] ESLint
- [x] Automated domain tests
- [x] Production build validation
- [x] Single local `check` gate
- [x] GitHub Actions CI gate
- [x] Dependency audit gate
- [x] Browser smoke test
- [ ] Production smoke test

## Phase 4 — Integration and browser validation

- [x] Customer ordering integration coverage (entrypoint smoke baseline)
- [x] Admin authentication smoke coverage (entrypoint smoke baseline)
- [x] Customer responsive/mobile smoke baseline
- [x] Admin responsive smoke baseline
- [ ] Critical error/empty/loading states
- [ ] Browser regression baseline

## Phase 5 — Release verification

- [ ] Production Firebase configuration verified
- [ ] Firebase Rules deployed and verified
- [ ] Functions deployed and verified
- [ ] Admin account provisioned and verified
- [ ] Customer checkout smoke test
- [ ] Admin smoke test
- [ ] Mobile/responsive smoke test
- [x] Monitoring/rollback procedure
- [ ] Release checklist completed
- [ ] Explicit approval to set `acceptingOrders = true`

## Phase 6 — Business and inventory semantics

- [x] Centralized pricing policy
- [x] Delivery charge
- [x] Cost and estimated profit calculations
- [x] Completed-sale accounting rule implemented
- [x] Product-owner approval of completed-sale accounting policy
- [x] Formal payment-status transitions
- [x] Formal order-status transitions
- [x] Decide WhatsApp confirmation vs notification semantics
- [x] Real inventory transactions
- [x] Inventory purchase/consumption history
- [x] Explicit stock adjustments
- [x] Operational reporting period filters

---

# Product Experience Evolution

These phases begin after release/security blockers are under control and may proceed in parallel with lower-risk hardening.

## Phase 7 — Sandwichies Visual System

**Execution:** APPROVED ALL — implementation baseline built.

Goal: establish a recognizable dark-first Sandwichies design language.

- [x] Audit current customer visual hierarchy
- [x] Define color/token system
- [x] Define typography system
- [x] Define spacing/radius/elevation system
- [x] Define product-card language
- [x] Define button/input/control language
- [x] Define food/product visual motifs
- [x] Define light/dark behavior where needed
- [x] Document accessibility contrast rules
- [ ] Create current UI baseline screenshots/evidence

## Phase 8 — Motion + Interaction System

**Execution:** APPROVED ALL — implementation baseline built.

Goal: make Sandwichies feel responsive and alive without becoming distracting.

- [x] Define transition durations/easing
- [x] Define hover/focus/pressed states
- [x] Define product selection feedback
- [x] Define quantity/cart feedback
- [x] Define favorite interaction
- [x] Define modal/navigation transitions
- [x] Define loading/skeleton behavior
- [x] Define success/error feedback
- [x] Add reduced-motion behavior
- [x] Document reusable motion patterns

## Phase 9 — Customer Discovery + Ordering UX

Goal: move the customer experience toward a responsive product catalog while preserving the current trusted domain and ordering flow.

- [x] Audit current landing/catalog experience
- [x] Improve hero/entry experience
- [x] Reuse existing recipe catalog and category metadata
- [x] Add product-name/description search
- [x] Add price filter and sorting by featured, price, and name
- [x] Display recipe ingredients with readable ingredient names
- [x] Keep existing shared price calculation and customization flow
- [ ] Browser-smoke the complete customer journey at desktop and mobile widths
- [ ] Verify product cards against the actual asset set and review visual consistency
- [ ] Validate address search, address confirmation, and delivery coverage
- [ ] Choose a $0-compatible address lookup approach after reviewing provider limits/privacy

## Phase 10 — Phone identity + order readiness

- [ ] Evaluate Firebase Phone Auth against current Firebase configuration and $0 budget
- [ ] Evaluate WhatsApp verification alternatives without introducing unapproved paid services
- [ ] Implement real phone ownership verification before customer checkout
- [ ] Keep customer auth separate from admin custom claims
- [ ] Test OTP abuse/rate limiting, errors, resend, and mobile behavior
- [ ] Verify trusted order creation and inventory idempotency end-to-end
- [ ] Preserve `BUSINESS.acceptingOrders = false` until explicit release approval

Requirements: `app/docs/product/CUSTOMER-STOREFRONT.md`.

## Phase 10 — New Favorites + New Creations

Goal: establish a sustainable product-content system.

- [x] Define product/favorite data model needs
- [x] Define featured/new/popular concepts
- [x] Create first new favorites
- [x] Create first new signature/seasonal creations
- [x] Review pricing/cost implications
- [x] Review inventory implications
- [x] Add discovery UI
- [x] Validate trusted server reconstruction through shared pricing/order model
- [x] Document production vs experimental products

## Phase 11 — Admin/Product Operations UX

**Execution:** APPROVED ALL — implementation baseline built.

Goal: make operations clearer and more efficient without weakening the security model.

- [x] Audit admin information hierarchy
- [x] Improve order status visibility
- [x] Improve payment status visibility
- [x] Improve inventory visibility
- [x] Improve operational feedback
- [x] Improve responsive admin experience
- [x] Add safe operational shortcuts where justified
- [x] Validate admin authorization boundaries

Implementation notes:
- Orders now surface active, confirmation, payment and readiness priorities before the detailed list.
- Order detail exposes explicit payment state and a single safe next-status shortcut while preserving canonical transition checks.
- Inventory highlights low serving capacity and confirms successful/failed movement recording.
- Admin responsive behavior is consolidated through existing mobile breakpoints.
- Authorization remains admin-claim based for reads and callable inventory writes, while Firestore Rules continue to validate order/payment transitions.
- Browser and emulator evidence remains pending because this phase was implemented without executing GitHub Actions or production deployment.

## Phase 12 — Performance + Measurement

Goal: ensure richer UX remains fast and measurable.

- [ ] Measure production bundle
- [ ] Measure critical customer path
- [ ] Review client payload
- [ ] Review image/assets strategy
- [ ] Review render performance
- [ ] Define product UX metrics
- [ ] Define ordering funnel metrics
- [ ] Measure discovery/selection/checkout behavior where instrumentation exists
- [ ] Remove unnecessary complexity

## Phase 13 — Product Expansion

Only after the foundation and release path are stable.

Candidate work:

- richer inventory management
- customer order history
- repeat orders
- recommendations
- business analytics
- reporting/export
- richer operational workflows
- additional product discovery experiences

---

## Priority order

1. Security regression validation
2. CI/dependency quality gates
3. Integration/browser validation
4. Production/release verification
5. Business and inventory semantics
6. Visual system
7. Motion/interaction system
8. Customer discovery and ordering UX
9. New favorites and creations
10. Admin/product operations UX
11. Performance and measurement
12. Product expansion

A future feature must not silently outrank an unresolved security or production blocker.

## Master product loop

```
OBSERVE
↓
AUDIT
↓
UNDERSTAND
↓
DESIGN
↓
IMPLEMENT
↓
TEST
↓
MEASURE
↓
IMPROVE
```


## Documentation checkpoint — 2026-10-18

- Operational safety: `acceptingOrders = false`; checkout stays disabled until explicit release approval.
- Spreadsheet-defined recipes, quantities and current unit purchase costs remain the business source of truth.
- Fases A–D have implementation commits on main, but implementation is not equivalent to release validation.
- Remaining gates include dependency audit, lint, domain tests, Firestore Emulator rules tests, production build and browser review. Re-check the latest phase audit and CI before marking anything validated.
- Preserve separation between customer-facing product experience and admin operational permissions.


## Anonymous customer identity — approved implementation

- [x] Create Firebase anonymous sessions automatically in the storefront
- [x] Load a saved display name into the checkout when available
- [x] Require a customer name and persist it to the anonymous Firebase Auth profile
- [x] Remove Phone Auth verification from the customer checkout; retain phone as order contact data
- [x] Keep email/password authentication and admin custom-claim authorization unchanged
- [ ] Run lint, tests, build, smoke and browser test after pulling
- [ ] Deploy Functions only after explicitly deciding which environment should accept real callable orders


## Current checkpoint — 2026-10-22

- [x] Owner-confirmed local quality gate after the route split and Functions discovery-timeout fix: dependency audit, lint, 27 domain tests, 8 Firestore rules tests, inventory integration test, build and entrypoint smoke.
- [x] Owner-confirmed manual browser review: storefront and admin are working.
- [x] Keep `BUSINESS.acceptingOrders = false` in source; this is not production release approval.
- [x] Add explicit Vite/Rolldown code-splitting groups for React/router, Firebase SDK and remaining vendor dependencies to address the 549 kB minified chunk reported by the previous local build.
- [ ] Re-run `npm run check` after the new chunking configuration and inspect emitted chunk sizes plus `/` and `/admin`.
- [ ] Confirm the latest GitHub Actions CI result. The available commit-status lookup has not returned published checks.
- [ ] Align the local emulator runtime with the declared Node.js 22 runtime; the last run fell back to global Node.js 24.
- [ ] Complete production-release verification separately; no Functions/Rules deployment or real-order activation is part of this performance task.


## Performance follow-up — 2026-10-22

- [x] Configure explicit Rolldown chunks for React/router, Firebase SDK and remaining vendor modules.
- [x] Separate the storefront's anonymous Firebase Auth client from the admin client that imports Firestore.
- [x] Defer loading the Firebase Functions SDK until the customer order-submit handler runs.
- [ ] Validate the latest code-splitting changes with `npm run check` and confirm the produced chunk sizes.
- [ ] Re-test `/` and `/admin` after the Firebase client split.
- [ ] Measure the critical customer path before and after; do not claim a performance improvement until build/browser measurements confirm it.


## Bundle performance guard — 2026-10-22

- [x] Add `npm run performance:check` to report raw and gzip-estimated JavaScript bundle sizes after build.
- [x] Enforce a 500 kB maximum for each minified JavaScript chunk; override with `MAX_JS_CHUNK_KB` only for intentional, reviewed exceptions.
- [x] Add the bundle budget gate to `npm run check` after `vite build` and before smoke tests.
- [x] Keep the storefront Firebase Auth client separate from the admin Firestore client.
- [x] Bind the order callable to the storefront Firebase app and defer importing Firebase Functions until submission.
- [ ] Run the full quality gate after these latest changes, confirm bundle budget output, and repeat the storefront/admin browser check.


## CI execution status — 2026-10-22

- [ ] Restore/verify GitHub Actions execution: recent `main` workflow runs ended within a few seconds with no runner assigned, no steps reported and no downloadable job logs. This is currently inconclusive about code correctness; do not mark CI green or infer a code-level cause from these runs.
- [ ] Check repository Actions settings, quota/billing availability and rerun the workflow once a runner can start.
