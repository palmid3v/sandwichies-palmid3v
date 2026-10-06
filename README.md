# 🥪 Sandwichies

A product-oriented sandwich configurator and operations platform covering customer ordering, trusted pricing, order management, inventory estimation, and admin workflows.

> **Current status:** Active MVP hardening. `acceptingOrders = false`; checkout is intentionally disabled until release approval.

## Product scope

### Customer
- 15 cm / 30 cm products
- Protein, toppings, extras, and base customization
- Cart and order submission
- Pickup/delivery information
- Customer and payment-method data
- WhatsApp order summary
- Order confirmation

### Admin
- Firebase Authentication
- Admin custom-claim authorization
- Orders history and details
- Dashboard
- Inventory-capacity estimation
- Payment status
- Live Firestore synchronization
- New-order notification sound

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

## Documentation

Use the four repository-level documents as the master control plane:

- `README.md` — product map
- `CONTEXT.md` — project memory and constraints
- `STEPBYSTEP.md` — engineering manual
- `ROADMAP.md` — current destination and priorities

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

## Operational state

`acceptingOrders = false`.

Do not enable customer checkout without completing the release gates in `ROADMAP.md`.

## Project boundary

This repository is the application, backend/domain, and documentation source of truth for Sandwichies. Shared business modules must remain aligned with client behavior, trusted server reconstruction, and Firestore security rules.

**PALMI-D3V · Sandwichies · 2026**
