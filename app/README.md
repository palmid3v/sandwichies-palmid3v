# Sandwichies — Application technical guide

**Last reviewed:** 2026-11-17  
**Application directory:** `app/`  
**Runtime status:** active development; release not approved.

## Purpose

This directory contains the customer storefront and administrative web application, shared commercial domain, Firebase integration, Worker API and tests.

## Product surfaces

### Customer
- Product and recipe discovery, search and catalog filters.
- Canonical recipe configuration and authenticated persistent cart.
- Customer profile and owned delivery addresses.
- Pickup/delivery selection, order history and status surfaces.
- Checkout remains subject to release guards and backend availability.

### Administration
- Firebase Authentication and `admin: true` custom claim.
- Order/payment queues and allowed status transitions.
- Inventory-related operations, delivery zones, virtual tables and delivery workflows.
- Privileged writes go through the trusted backend boundary.

## Architecture

- `src/`: React/Vite application, routes, pages and components.
- `shared/`: catalog, recipes, pricing, business rules and order request domain.
- `worker/`: Cloudflare Worker API, Firebase ID token verification, Firestore REST adapter and order/cart/profile/admin routes.
- `functions/`: retained Firebase Cloud Functions code; deployment is not assumed.
- `firestore.rules`: browser access policy.
- `test/` and Worker tests: domain, API, integration and security coverage.
- `scripts/`: preflight, smoke, validation and operational helpers.
- `docs/`: product, architecture, security, audits and release evidence.

The backend rebuilds monetary/order values using shared domain data and authorizes privileged operations. The browser is not a trusted source for price, cost, totals or administrative state.

## Backend and release state

The Worker is implemented in source and is the intended API path. The 2026-11-12 audit reported successful local checks and browser/emulator verification, but did not establish a healthy deployed Worker or configured production bindings/service credentials. Order intake stays closed until runtime and release gates are explicitly verified. Keep `BUSINESS.acceptingOrders` and `ORDERS_ENABLED` aligned; a Git commit does not deploy the Worker.

Firebase Functions are retained code; the documented project state showed no deployed Functions endpoints. Do not enable Firebase Blaze or add paid infrastructure under the current $0 operating constraint.

## Local development

Inspect `package.json` for current scripts. Typical workflow from this directory:

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
npm run check
```

For Worker/emulator development, follow `docs/development/local-worker.md` and `worker/README.md`. Confirm write-oriented tests target the intended emulator. Never commit service-account keys or expose secrets through Vite variables.

## Operational safety

- No production deployment, order creation, inventory write, IAM or billing change without explicit authorization.
- Do not use real customer or inventory data for local integration tests.
- Keep Sandwichies and Cupboard service identities separate.
- Firestore service-account access bypasses Firestore Rules; review project-level IAM scope before configuring credentials.
- Worker/API source is not evidence of production availability.

## Related documentation

- [Worker API and Cupboard bridge](worker/README.md)
- [Local Worker development](docs/development/local-worker.md)
- [Finalization audit](docs/FINALIZATION-AUDIT.md)
- [Integration matrix](docs/INTEGRATION-MATRIX.md)
- [Release checklist](docs/RELEASE-CHECKLIST.md)
- [Repository instructions](../AGENT.md)

---
**Sandwichies · PALMI-D3V**
