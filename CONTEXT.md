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

The current `main` contains commit `270303d` with `BUSINESS.acceptingOrders = true`. This conflicts with `MASTERPROMPT.md`, the storefront requirements and release checklist, which require `false` until release approval. The user previously asked to preserve the change; do not silently overwrite it. No production deployment or release approval is evidenced. Resolve this gate before publishing a build that could serve ordering, deploying, or accepting real orders.

## Customer flow

discover curated products
→ add an existing canonical recipe to cart
→ review quantities and total
→ customer, fulfillment, payment and notes
→ trusted callable order submission (release-gated)
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

Client values are previews. Financial/order values are rebuilt by the trusted Firebase callable function.

## Security

Customer order creation goes through `createOrder`.

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
- Screenshot/browser evidence is intentionally not fabricated; it remains an execution task.

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

Maintain parity between client configuration, shared business modules, Firebase callable functions, and Firestore security rules.

For product/UI work, also maintain parity between the visual system, interaction system, responsive behavior, and product goals.

A task is not DONE until implementation, validation, security review, UX/UI review where relevant, and documentation are synchronized.


## Current FASE 11 state

FASE 11 Admin/Product Operations UX is implemented on main.

The admin experience prioritizes active orders, confirmation/payment attention, ready orders, explicit payment state, safe next-status progression, inventory low-stock visibility and operational feedback. Current UX work adds order-queue shortcuts, contact/fulfillment details, virtual meeting-point navigation and visible synchronization feedback. The existing Firebase Auth/custom-claim and Firestore Rules authorization model remains unchanged.

Current customer improvements keep category/search controls prominent, collapse advanced price/sort controls on mobile and add a fixed cart summary when items are present. The cart still uses canonical recipe/pricing/order modules.

The source currently has `BUSINESS.acceptingOrders = true` in `main` commit `270303d`, conflicting with the strict release requirements in `MASTERPROMPT.md` and the release checklist. The user previously asked to preserve this change; do not silently overwrite it. No production deployment/release approval is evidenced. Resolve before publishing an ordering-enabled build or accepting orders. Never perform production orders as a test.

The previous 2026-10-18 documentation checkpoint below is historical. It is not a statement of today's source configuration.


## Documentation checkpoint — 2026-10-18

README.md actualizado para describir producto y estado sin ocultar bloqueos: acceptingOrders=false, checkout deshabilitado hasta aprobación. El Excel vigente es la fuente de verdad de cantidades y costos. La auditoría Fase A–D, reglas Firestore, pruebas, build, Emulator y revisión browser siguen siendo gates según la evidencia disponible.

Public README states the product scope and release limits. Use the source code, tests and latest audit reports to decide whether a milestone is actually complete.

## Maintenance handoff — 2026-11-12

- Current branch: maintenance/ci-recovery-2026-11.
- Documentation PR: https://github.com/palmid3v/sandwichies-palmid3v/pull/15.
- CI passed on 2026-11-13: 43 domain tests, 84 Worker tests, 12 Firestore Rules tests, 7 integration tests, dependency audit gate, lint, production build and storefront/admin smoke.
- npm audit reports 7 vulnerabilities (1 low, 6 moderate); the current audit gate is high severity. Keep these findings visible and review dependency paths before changing versions.
- Preserve BUSINESS.acceptingOrders=false and ORDERS_ENABLED=false. No order intake, deployment or real inventory operation is authorized.
- Latest evidence: QUALITY-CHECKPOINT-2026-11-12.md.
- Dependency risk: npm audit --omit=dev reports 7 production dependency vulnerabilities (1 low, 6 moderate). CI now prints package-level advisory titles and available fixes. Review before changing versions; do not hide these findings behind the high-severity-only exit threshold.
