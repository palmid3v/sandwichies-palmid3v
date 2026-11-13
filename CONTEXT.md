# CONTEXT — Sandwichies

## Identity

- Product: Sandwichies
- Type: Interactive sandwich configurator + ordering and operations platform
- Developer: PALMI-D3V
- Backend: Firebase
- Current release line: Product Experience Evolution (FASE 7–11 built; release verification remains separate)
- Project operating contract: `MASTERPROMPT.md`

## Product vision

Sandwichies should feel like a real food product, not a generic CRUD ordering application.

The product direction is dark-first, highly interactive, mobile-first, visually distinctive, and strongly connected to food/product identity.

The experience should evolve around discovery, favorites, new creations, meaningful motion, tactile controls, and reduced ordering friction.

## Current operational state

- `BUSINESS.acceptingOrders=false` in `app/shared/business.js` and `ORDERS_ENABLED=false` in Wrangler, local Worker vars and examples. Keep both release guards unchanged.
- No production deployment, production data write or live inventory operation is authorized or evidenced.
- Customer identity uses Firebase Email/Password with verified email. Vite development uses local Auth and Firestore emulators.
- Local browser QA verified catalog discovery, authenticated cart persistence through Worker/Firestore Emulator, profile read/write, closed checkout and non-admin denial.
- Current weighted functional score is 67.5%; see `app/docs/FINALIZATION-AUDIT.md` for evidence and domain scoring.
- `npm run check` passed on 2026-11-12 with 87 Worker, 43 domain, 12 Rules and 7 Functions/Firestore integration tests; six moderate production dependency advisories remain.

## Customer flow

discover curated products
→ add an existing canonical recipe to cart
→ review quantities and total
→ customer, fulfillment, payment and notes
→ Worker order API (currently blocked by both release flags)
→ confirmation / WhatsApp summary
→ private virtual-table tracking where applicable

Search and advanced price/sort filters are available; mobile shows the price/sort controls in a disclosure and a floating cart summary when the cart has items.

## Admin flow

Firebase Auth
→ admin custom claim
→ orders and operational summaries
→ order details, fulfillment and next allowed status
→ dashboard quick filters
→ inventory transactions / estimates, with their distinct semantics

Future admin UX improvements must preserve the existing trust boundary.

## Product/UX principles

- Dark-first visual direction with Sandwichies-specific identity.
- Motion and transitions should communicate state or reinforce identity.
- Microinteractions should be deliberate, not decorative noise.
- Mobile-first customer UX.
- Discovery should help users decide what to eat.
- New products and favorites should be easy to evolve.
- UI improvements must not duplicate business logic.
- UX quality does not override security or data integrity.

## Domain authority

- `app/shared/catalog.js`
- `app/shared/pricing.js`
- `app/shared/business.js`
- `app/shared/recipes.js`
- `app/shared/order-request.js`

Client values are previews. The active storefront order API is the Cloudflare Worker (`POST /v1/orders`); the Worker validates and rebuilds trusted values. The route remains disabled by release gates.

## Security

The storefront submits to Worker `POST /v1/orders`; the Worker order domain is `createOrder`. Firebase callable order functions remain in the repository but are not the active storefront API path.

Firestore Rules:
- deny direct browser order creation/deletion,
- deny direct counter access,
- allow protected order operations only to admins.

Admin authorization uses the Firebase Auth `admin` custom claim.

## Stack

React 19 · Vite 8 · Firebase / Firestore · Firebase Functions/Admin · React Router 7 · Node test runner · ESLint 9.

## Repository control

The master project documents are:

1. `README.md`
2. `CONTEXT.md`
3. `MASTERPROMPT.md`
4. `STEPBYSTEP.md`
5. `ROADMAP.md`

Detailed documentation is under `app/docs/`. Historical material remains under `app/docs/v0.1/`.

## Data Connect

`app/dataconnect/` is experimental/non-production and is not part of the active Firestore order architecture. Do not introduce it into production without an explicit architecture decision and migration plan.

## Business semantics

- A completed sale is recognized only when an order is `entregado` and payment is `pagado`.
- Order statuses follow the formal transition graph in `app/shared/business.js`; delivered and cancelled are terminal.
- Payment status is one-way: `pendiente → pagado`.
- WhatsApp is a customer confirmation and communication channel after a trusted order is accepted; it is not the financial or operational source of truth.
- Inventory uses `inventoryBalances` and `inventoryTransactions`. Catalog `stockQuantity` is the opening baseline; completed sales post consumption automatically.
- Manual purchases and stock adjustments are recorded by the admin callable. Direct browser writes to inventory collections remain denied.
- Historical orders without stored `ingredientUsage` are never silently converted into inventory consumption.

## Current product experience system

- FASE 7 defines the dark-first visual tokens, product-card language, touch targets, focus states and food-driven visual motifs.
- FASE 8 defines reusable interaction patterns in `app/src/styles/motion.css`.
- Reduced-motion behavior is part of the global interaction system.
- Current UI/design decisions are documented in `app/docs/design/DESIGN-SYSTEM.md` and `app/docs/design/MOTION-INTERACTION.md`.
- FASE 9 adds customer discovery segments, featured/product hierarchy and lower-friction selection into the ordering flow.
- FASE 10 adds canonical production product metadata plus first new signature/seasonal creations in `app/shared/recipes.js`.
- A storefront screenshot was captured inline during local browser QA on 2026-11-12; the browser tool denied saving it into the workspace, so no persistent image or trace was retained.

## Development

```bash
cd app
npm install
npm run dev
npm run lint
npm test
npm run build
npm run check
```

## Rule for future work

Maintain parity between client configuration, shared business modules, Worker APIs, retained Firebase Functions, and Firestore security rules.

For product/UI work, also maintain parity between the visual system, interaction system, responsive behavior, and product goals.

A task is not DONE until implementation, validation, security review, UX/UI review where relevant, and documentation are synchronized.


## Current FASE 11 state

FASE 11 Admin/Product Operations UX is implemented on main.

The admin experience prioritizes active orders, confirmation/payment attention, ready orders, explicit payment state, safe next-status progression, inventory low-stock visibility and operational feedback. Current UX work adds order-queue shortcuts, contact/fulfillment details, virtual meeting-point navigation and visible synchronization feedback. The existing Firebase Auth/custom-claim and Firestore Rules authorization model remains unchanged.

Current customer improvements keep category/search controls prominent, collapse advanced price/sort controls on mobile and add a fixed cart summary when items are present. The cart still uses canonical recipe/pricing/order modules.

Current source keeps `BUSINESS.acceptingOrders=false` and `ORDERS_ENABLED=false`; these release protections must remain disabled.

The previous 2026-10-18 documentation checkpoint below is historical. It is not a statement of today's source configuration.


## Documentation checkpoint — 2026-10-18

README.md actualizado para describir producto y estado sin ocultar bloqueos: acceptingOrders=false, checkout deshabilitado hasta aprobación. El Excel vigente es la fuente de verdad de cantidades y costos. La auditoría Fase A–D, reglas Firestore, pruebas, build, Emulator y revisión browser siguen siendo gates según la evidencia disponible.

Public README states the product scope and release limits. Use the source code, tests and latest audit reports to decide whether a milestone is actually complete.

## Maintenance handoff — 2026-11-12

- Current branch: `main`; local uncommitted finalization work is present.
- Local `npm run check` passed: 87 Worker, 43 domain, 12 Rules, 7 integration tests, audit gate, lint, build, bundle budget and smoke.
- `npm audit --omit=dev` reports six moderate production dependency vulnerabilities. The configured gate blocks high/critical findings; keep moderate advisories visible.
- Preserve `BUSINESS.acceptingOrders=false` and `ORDERS_ENABLED=false`. No order intake, deployment or real inventory operation is authorized.
- Current evidence: `app/docs/FINALIZATION-AUDIT.md`, `app/docs/INTEGRATION-MATRIX.md`, and `app/docs/BROWSER-QA-REPORT.md`.
- Node 22 runtime verification, production IAM and Cupboard reconciliation remain open.