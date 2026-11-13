# Sandwichies Worker — backend, orders and Cupboard bridge

Cloudflare Worker backend for Sandwichies, built to keep the mandatory service budget at $0 and remove the production dependency on undeployed Firebase Cloud Functions. The Worker is implemented in source but **is not deployed or production-validated**.

## Runtime status and safety defaults

- Cloudflare Worker source: implemented in `src/`. A Worker named `sandwichies-palmid3v` is present in the connected Cloudflare account (observed 2026-11-12), but its current settings response exposes no runtime bindings; this does not establish a working production backend.
- Firebase ID token verification: implemented (RS256/JWK, issuer, audience, subject, time claims).
- Firestore REST client: implemented with Google service-account OAuth, Firestore transactions and batched transactional reads (`batchGet`), including loopback-only Firestore Emulator transport for local development.
- Orders, delivery zones, virtual tables and Cupboard movement endpoints: implemented in source.
- Frontend adapter: customer and admin actions now call the Worker API.
- Automated Worker tests: the prior local QA run passed 30 tests. The new local-emulator transport and delivery-zone domain tests passed in GitHub Actions commit `ddc8171`; the actual Wrangler + Firestore Emulator UI flow still requires local owner-side verification.
- Local development: Wrangler can run the same Worker against the Firestore Emulator without service-account credentials; see `../docs/development/local-worker.md`.
- Cloudflare deployment: a script and deployment versions exist in the account, but the live version has not been verified against `main`; production configuration and end-to-end validation remain incomplete.
- Service-account secrets, real Cupboard household ID and validated ingredient mapping: **not configured in this repository**.
- `ORDERS_ENABLED`: defaults to `false` in the Wrangler configuration; real order creation stays blocked.
- No Firebase Blaze, billing, production data migration, production write or real order is authorized by this implementation.

## API

All protected routes require `Authorization: Bearer <Firebase ID token>`. Admin routes additionally require the Firebase custom claim `admin: true`. The browser never receives Google service-account credentials.

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Worker health and order-enabled flag |
| GET | `/v1/session` | Signed in | Verify customer/admin session |
| GET | `/v1/customer/cart` | Verified customer | Read the caller's UID-scoped cart and revision |
| POST | `/v1/customer/cart` | Verified customer | Save/clear cart with optimistic revision and idempotent mutation ID |
| GET | `/v1/customer/profile` | Verified customer | Create on first access and read the caller's profile |
| POST | `/v1/customer/profile` | Verified customer | Update own name, phone and delivery preferences |
| GET | `/v1/customer/addresses` | Verified customer | List own saved addresses |
| POST | `/v1/customer/addresses` | Verified customer | Create/update own address (maximum 10) |
| POST | `/v1/customer/addresses/:id/delete` | Verified customer | Delete own saved address |
| GET | `/v1/admin/session` | Admin | Verify admin claim |
| GET | `/v1/admin/delivery-operations` | Verified admin | Read zones, active/expired tables and recent events |
| GET | `/v1/admin/virtual-tables/:id/members` | Verified admin | Read sanitized members for one table |
| POST | `/v1/orders` | Signed in customer | Create trusted, server-priced order |
| GET | `/v1/orders/:id` | Order owner | Read a sanitized customer view |
| POST | `/v1/delivery/coverage` | Signed in | Check a meeting point against active zones |
| POST | `/v1/admin/delivery-zones` | Admin | Create/update a validated delivery polygon |
| POST | `/v1/customer/orders/:id/ready` | Order owner | Mark arrival at a virtual table |
| POST | `/v1/admin/orders/:id/status` | Admin | Transition order and reconcile Cupboard stock |
| POST | `/v1/admin/orders/:id/delivery` | Admin | Advance individual delivery status |
| POST | `/v1/admin/virtual-tables/:id/close` | Admin | Stop a table from accepting new orders |
| POST | `/v1/admin/inventory/movements` | Admin | Record a purchase or adjustment in Cupboard |

CORS is restricted to exact origins listed in `ALLOWED_ORIGINS`; methods are `GET/POST/OPTIONS`; request headers are `Authorization/Content-Type`. The Worker rejects unlisted origins, methods and headers. Do not use wildcard origins.

## Customer cart persistence and conflict policy

- Canonical document: `customers/{verifiedUid}/cart/current`; the Worker derives the UID from the verified Firebase ID token and never accepts a client UID.
- Browser Firestore access is denied by `firestore.rules`; cart reads and writes go only through the authenticated Worker.
- `GET /v1/customer/cart` returns the cart and its integer `revision`. A missing cart is represented as revision 0 with no lines.
- `POST /v1/customer/cart` accepts `expectedRevision`, a UUID-like `mutationId`, up to 20 distinct cart lines and 20 units total. The Worker recalculates/validates each recipe against `app/shared/pricing.js`; it stores configuration and quantity, not client prices or previews.
- A successful write increments the revision. Repeating the same mutation ID is idempotent. A stale revision returns HTTP 409 `CART_CONFLICT`; the client stops autosaving and asks the customer to reload the latest server cart rather than silently overwrite another session.
- The storefront restores the cart after verified sign-in and debounces updates by 700 ms. Signing out clears in-memory cart state; it does not delete the account's saved cart.
- `GET /v1/customer/cart?mutationId=<id>` returns `mutationApplied`, true only when that ID is the cart's last committed mutation. The client uses this after an ambiguous timeout before retrying.
- An ambiguous save is reconciled by reading the cart with the same mutation ID. If already committed, the client adopts the server revision; if not committed and the revision is unchanged, it retries the exact same payload and mutation ID once. A newer revision remains a conflict.
- Firebase signing-key retrieval, Google service-account OAuth and Firestore HTTP requests are each bounded to 5 seconds, including response-body reads. Timeout logs identify the dependency stage (`FIREBASE_JWKS`, `GOOGLE_OAUTH` or `FIRESTORE_REQUEST`) without customer IDs or credentials. Timeouts are tagged by dependency stage (for example `GOOGLE_OAUTH_TIMEOUT` or `FIRESTORE_REQUEST_TIMEOUT`) and logged without customer IDs or credentials. Transaction commit outcomes can still be ambiguous, so mutation reconciliation remains required.
- Cart read/write duration is logged by the Worker for latency diagnosis. These logs contain duration and outcome only, not cart contents or UID.
- Cart synchronization is not order acceptance. `BUSINESS.acceptingOrders=false` and `ORDERS_ENABLED=false` remain unchanged.

The cart uses the same Worker-only data boundary as customer profiles. Service-account access bypasses Firestore Security Rules, so keep Worker credentials private and review project-level IAM before production.

## Delivery zone assignment and service hours

Delivery coverage is resolved by the Worker using active, valid polygons:

1. If the customer point is inside one or more active polygons, a containing polygon wins (stable zone-ID tie-break).
2. Otherwise, the Worker selects the active polygon with the shortest estimated distance to its boundary. There is currently no maximum-distance cap; this is an intentional early-stage policy while coverage zones are sparse.
3. Inactive/invalid zones are excluded. If no active valid zone exists, no delivery assignment is possible.
4. The order stores `zoneId`, `zoneName`, `zoneAssignment.method` (`inside_polygon` or `nearest_polygon`) and `zoneAssignment.distanceMeters`. This is straight-line boundary distance, not road distance or an ETA.
5. Virtual-table grouping remains separate: fixed anchor, 50 m maximum grouping radius and capacity 9.

Each zone may store:

```json
{
  "schedule": {
    "enabled": true,
    "timeZone": "America/Bogota",
    "weekly": {
      "monday": [{ "start": "07:00", "end": "21:00" }],
      "tuesday": [{ "start": "07:00", "end": "21:00" }],
      "wednesday": [{ "start": "07:00", "end": "21:00" }],
      "thursday": [{ "start": "07:00", "end": "21:00" }],
      "friday": [{ "start": "07:00", "end": "21:00" }],
      "saturday": [],
      "sunday": []
    }
  }
}
```

When `schedule.enabled` is false or absent, the zone remains open 24 hours for backward compatibility. When enabled, empty days are closed. The Worker validates the saved schedule and checks it again at order creation using the zone timezone. Out-of-hours creation returns HTTP 422 / `ZONE_OUTSIDE_SERVICE_HOURS`; no order, counter, idempotency record or virtual-table membership is created. The customer-facing frontend should present the returned message and keep the cart intact.

## Order and inventory lifecycle

1. The customer signs in with a verified Firebase Email/Password account and sends its ID token. A legacy anonymous session may be linked to Email/Password before verification; the UID remains unchanged.
2. The Worker verifies the token and validates the order with the shared Sandwichies catalog/pricing domain.
3. The server calculates item prices, totals, costs and ingredient usage; client-supplied totals/status/costs are rejected.
4. A Firestore transaction creates the order, increments the order counter and stores an idempotency record keyed by customer UID + request UUID.
5. When an admin confirms the order, the Worker locks the order transition, rebuilds ingredient consumption from the trusted order snapshot and applies the movement in Cupboard.
6. Cupboard stock and its deterministic movement record are committed in one Cupboard Firestore transaction. Repeated requests do not decrement stock twice.
7. The Worker mirrors the Cupboard balance/revision and movement into Sandwichies for the existing admin realtime views, then commits the order status.
8. Cancelling an unpaid order creates an idempotent reversal. If no consumption was posted, cancellation is recorded as `not-consumed`; partial/inconsistent history fails closed for reconciliation.

The two Firebase projects cannot share one Firestore transaction. This is a retry-safe saga, not a distributed atomic transaction: a successful Cupboard movement can precede the final Sandwichies order update. The transition lock, deterministic movement IDs and retry behavior are designed to reconcile that intermediate state. Do not manually delete movement records or reuse an idempotency key with different data.

## Cupboard security boundary

The Worker uses two independent Google service-account JSON secrets:

- `SANDWICHIES_SERVICE_ACCOUNT_JSON` — identity belonging to `sandwich-pro`.
- `CUPBOARD_SERVICE_ACCOUNT_JSON` — identity belonging to the configured Cupboard Firebase project.

The Worker checks that each credential's `project_id` matches its configured project and rejects using the same Firebase project for both sides. The Cupboard adapter only constructs paths under:

```text
households/{CUPBOARD_HOUSEHOLD_ID}/workspaces/sandwichies/inventory/{productId}
households/{CUPBOARD_HOUSEHOLD_ID}/workspaces/sandwichies/movements/{movementId}
```

The ingredient mapping must cover every active ingredient in `shared/catalog.js`, map to distinct Cupboard product document IDs, and contain no path separators. Missing mappings, duplicate product mappings, invalid stock, insufficient stock and idempotency conflicts fail closed.

**IAM limitation:** Firestore REST calls made with service-account OAuth bypass Firestore Security Rules. Firestore IAM permissions are project-scoped, not collection-scoped. The service identities therefore have powerful project-level data access even though this Worker only addresses the Sandwichies business-inventory paths. Keep the two identities separate, grant only the required Firestore data role in their respective projects, do not use project Owner/Editor, protect and rotate the keys, and review this project-wide IAM limitation before issuing secrets. This is not equivalent to collection-level IAM isolation.

## Required Cloudflare configuration

Public/non-secret configuration in `wrangler.toml`:

- `FIREBASE_PROJECT_ID = "sandwich-pro"`
- `ALLOWED_ORIGINS` — exact Vercel and local origins.
- `ORDERS_ENABLED = "false"` — leave false until explicit release approval.
- Cron trigger every five minutes for virtual-table expiry.

Configure the following in Cloudflare secrets/settings, never in Git or frontend `.env` files:

- `SANDWICHIES_SERVICE_ACCOUNT_JSON`
- `CUPBOARD_SERVICE_ACCOUNT_JSON`
- `CUPBOARD_PROJECT_ID`
- `CUPBOARD_HOUSEHOLD_ID`
- `CUPBOARD_INGREDIENT_MAP_JSON`

The two JSON credentials must be valid service-account JSON for their corresponding projects. The real household ID and complete ingredient mapping must be verified against Cupboard before setting these values.

After an explicitly approved deployment, set `VITE_SANDWICHIES_WORKER_URL` in the frontend hosting environment and local `.env` to the actual Worker URL. `.env.example` intentionally leaves it blank. Do not invent a Worker hostname.

## IAM and release checklist

1. Confirm both Firebase project IDs and the actual Cupboard household ID.
2. Complete the 11 active ingredient mappings and compare each product ID with the business inventory documents.
3. Create one dedicated service identity in each Firebase project; do not reuse personal credentials.
4. Enable the required Firestore API and grant the minimum available Firestore data role to each identity in its own project. Review the project-wide IAM limitation above.
5. Store the JSON credentials and Cupboard configuration as Cloudflare secrets.
6. Run the Worker test suite and full Sandwichies `npm run check`.
7. Run isolated Firestore Emulator integration tests for create/retry order, stock available/insufficient, repeated confirmation, cancellation/reversal, manual purchase/adjustment, duplicate operation IDs, table assignment, expiry and authorization.
8. Verify the frontend Vercel origin in the exact CORS allowlist.
9. Review Worker quotas and Cron Trigger availability under the Cloudflare Free plan.
10. Review the actual IAM grants, secrets and runtime logs.
11. Obtain explicit approval before deployment, enabling `ORDERS_ENABLED`, changing frontend production configuration or processing real orders.

No production deployment, data mutation, billing change or real-order test has been performed.

## Local development — Firestore Emulator

For the complete three-terminal setup, PowerShell commands, local auth boundary and migration path to Cloudflare, see [Local Worker development](../docs/development/local-worker.md).

The Worker accepts `FIRESTORE_EMULATOR_HOST` only when `LOCAL_DEV=true`, the host is `localhost` or `127.0.0.1`, and the emulator project matches `FIREBASE_PROJECT_ID`. Local mode without an emulator host fails closed instead of falling through to remote Firestore. In emulator mode it uses the emulator owner token and does not request Google OAuth. These settings are supplied through the ignored `worker/.dev.vars` file; they are not part of the deployed Wrangler configuration. Vite development connects both Auth and Firestore SDKs to local emulators. The Worker local Auth verifier talks only to the loopback Auth Emulator and confirms token state there; production config continues to use Firebase signing-key verification.

## Local tests

From `app/worker/`:

```bash
npm test
```

From `app/`:

```bash
npm run worker:test
npm run check
```

The Worker suite covers Firebase token verification, Firestore REST request/transaction encoding, CORS, trusted order creation, idempotency, Cupboard stock decrement/reversal and virtual delivery behavior. These tests must still be executed locally/CI; source files existing is not evidence of a passing run.

## Deploy command — do not run without approval

From the repository root:

```bash
npx wrangler deploy --config app/worker/wrangler.toml
```

Cloudflare Git builds remain disabled until their root directory and build/deploy configuration are explicitly reviewed. Do not enable Firebase Blaze or add paid services to solve backend hosting.


## Historial privado de pedidos — Fase E

- `GET /v1/customer/orders?limit=100` autentica con Firebase ID token verificado y consulta únicamente documentos con `customerUid === claims.sub`.
- El límite solicitado se acota entre 1 y 100; la respuesta se normaliza con el mismo contrato cliente de detalle.
- `GET /v1/orders/:id` devuelve 404 tanto para pedido inexistente como para pedido ajeno, evitando revelar su existencia.
- Para pedidos con mesa virtual, el Worker incorpora `deliveryStatus` y `tableStatus` desde `customerOrderTracking/{uid}/orders/{orderId}`.
- La normalización elimina `cost` e `ingredientUsage`; los datos internos de inventario nunca forman parte de la respuesta cliente.
- El frontend consulta el historial y el detalle mediante Worker; Firestore Rules continúa bloqueando lectura directa de pedidos y limita tracking al UID propietario/admin.

## QA especializado — Fase F

El coordinador `npm run qa` ejecuta secuencialmente los agentes Worker, cliente/sesión, dominio, seguridad Firestore, integración Cupboard y frontend. Cada agente se ejecuta en proceso separado, conserva el código de salida y el coordinador se detiene en el primer fallo.

La prueba de navegador de dos sesiones, logout/login, pérdida de red, recuperación y responsive requiere evidencia manual con entorno demo. Checklist: `app/docs/qa/browser-recovery.md`. Ningún agente despliega, cambia billing, escribe en Firebase real ni habilita pedidos.
