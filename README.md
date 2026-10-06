# 🥪 Sandwichies

A product-oriented sandwich configurator and operations platform evolving toward an interactive, distinctive food product covering customer ordering, trusted pricing, order management, inventory estimation, and admin workflows.

> **Current status:** MVP hardening → Product Experience Evolution. `acceptingOrders = false`; checkout remains disabled until release approval.

## Product direction

Sandwichies is intentionally moving beyond a functional ordering CRUD experience.

The next evolution focuses on:

- Dark-first visual identity connected to the food product.
- Strong UI/UX and product-design ownership.
- Motion, transitions, microinteractions, and meaningful feedback.
- Better product discovery.
- New favorites and new creations.
- Mobile-first customer experience.
- Admin operations focused on order priorities, payment visibility, inventory signals and safe status actions.
- Stronger product identity without weakening security or architecture.

The project-specific operating contract is **`MASTERPROMPT.md`**.

## Product scope

### Customer
- 15 cm / 30 cm products
- Protein, toppings, extras, and base customization
- Cart and order submission
- Pickup/delivery information
- Customer and payment-method data
- WhatsApp order summary
- Order confirmation
- Future discovery, favorites, recommendations, and new creations

### Admin
- Firebase Authentication
- Admin custom-claim authorization
- Orders history and details
- Dashboard
- Inventory-capacity estimation
- Payment status
- Live Firestore synchronization
- New-order notification sound
- Operational order priority summary
- Explicit payment-state visibility
- Safe next-status operational shortcut
- Low-stock inventory visibility and movement feedback

## Domain authority

The authoritative business modules live under `app/shared/`:

- `catalog.js`
- `pricing.js`
- `business.js`
- `recipes.js`
- `order-request.js`

The browser previews configuration and pricing, but trusted order values are reconstructed by the Firebase callable backend.

## Security boundary

Customer order creation goes through `createOrder`.

Firestore Rules deny direct browser order creation/deletion and protect admin operations with the `admin` custom claim.

## Technology

| Technology | Role |
| --- | --- |
| React 19 | UI |
| Vite 8 | Tooling |
| Firebase / Firestore | Persistence |
| Firebase Functions / Admin SDK | Trusted backend |
| React Router 7 | Routing |
| Node test runner | Tests |
| ESLint 9 | Code quality |

## Repository structure

```text
sandwichies-palmid3v/
├── README.md
├── CONTEXT.md
├── MASTERPROMPT.md
├── STEPBYSTEP.md
├── ROADMAP.md
├── .github/workflows/     # CI
├── app/
│   ├── src/               # Browser application
│   ├── shared/            # Authoritative business/domain logic
│   ├── functions/         # Trusted Firebase backend
│   ├── test/              # Automated tests
│   ├── scripts/           # Administrative tooling
│   ├── docs/              # Detailed current + historical documentation
│   └── dataconnect/       # Experimental/non-production material
└── archive/               # Historical material
```

## Documentation control plane

- `README.md` — product/project map
- `CONTEXT.md` — current project memory and constraints
- `MASTERPROMPT.md` — Sandwichies product/engineering operating contract
- `STEPBYSTEP.md` — execution manual and current phase sequence
- `ROADMAP.md` — destination, priorities, and release path

Detailed documentation lives under `app/docs/`. Historical `v0.1` documents remain preserved for traceability.

## Validation

From `app/`:

```bash
npm install
npm run lint
npm test
npm run build
npm run check
```

CI runs lint, tests and production build on pushes to `main` and pull requests.

## Business and inventory semantics

- Completed sales require both `entregado` status and `pagado` payment.
- Order and payment transitions are centralized and tested.
- Inventory balances and transaction history are server-maintained.
- Completed sales generate automatic consumption transactions; purchases and adjustments are recorded through the admin flow.
- Dashboard reporting supports operational period filters.

## Visual + interaction system

FASE 7–8 introduces the current dark-first product visual language and reusable motion system:

- intentional color/spacing/radius/elevation tokens;
- food/product-oriented favorite cards;
- tactile selection and quantity states;
- consistent focus/pressed feedback;
- responsive mobile-first treatment;
- reusable entry, toast, cart, selection and shimmer patterns;
- `prefers-reduced-motion` support.

Detailed design decisions live under `app/docs/design/`.


## Customer discovery + product content

FASE 9–10 extends the storefront from a simple configurator into a product-discovery experience:

- canonical discovery segments: featured, popular, new, signature and seasonal;
- curated product cards with descriptions, badges and starting-price anchors;
- direct selection from discovery into the existing configurator;
- mobile-first category navigation and empty-state feedback;
- canonical production product metadata in `app/shared/recipes.js`;
- first new creations: Serrano Verde and Fuego Tropical;
- new creations use the same trusted pricing and order reconstruction path as existing products.

Detailed execution evidence lives in `app/docs/tasks/PHASE-09-10-REPORT.md`.

## Admin operations UX

FASE 11 improves the daily admin workflow without changing the security boundary:

- operational priority summaries for active, confirmation, payment and ready states;
- clearer order/payment state in order detail;
- safe next-status action using canonical transition guards;
- low-stock inventory signaling and mutation feedback;
- responsive admin behavior across mobile, tablet and desktop layouts.

Detailed evidence is recorded in app/docs/tasks/PHASE-11-REPORT.md.

## Operational state

`acceptingOrders = false`.

Do not enable customer checkout without completing the release gates in `ROADMAP.md`.

## Project boundary

This repository is the application, backend/domain, product documentation, and project operating source of truth for Sandwichies.

**Execution status:** FASE 1–11 implementation baseline is present on main. FASE 11 admin/product operations UX is implemented and documented. Production verification remains environment-dependent; acceptingOrders stays false.

**PALMI-D3V · Sandwichies · 2026**
