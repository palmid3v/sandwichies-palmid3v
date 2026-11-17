# CONTEXT — Sandwichies

**Document review:** 2026-11-17  
**Repository:** `palmid3v/sandwichies-palmid3v`  
**Primary branch:** `main`  
**Owner:** PALMI-D3V

## Product identity

Sandwichies is a web platform for a sandwich business. It brings together customer discovery and configuration of products, authenticated cart and profile, order lifecycle, and administrative operations. Customer experience is mobile-first; administration supports mobile and desktop.

## Domain ownership

- Sandwichies owns commercial catalog, recipes, pricing, promotions, customer-facing orders, payment/order states and delivery operations.
- Cupboard owns stock quantities and inventory movements. Sandwichies requests inventory operations through an explicit integration and must not become a second stock authority.
- DayFlow owns personal planning and reminders.
- Financial-D3V owns private financial records. Decrypted personal financial data must not enter Sandwichies.

## Current architecture

- React 19, Vite 8, JavaScript ES modules and React Router 7.
- Shared commercial domain under `app/shared/`.
- Firebase Authentication for customer/admin identity; privileged administration requires the `admin: true` custom claim.
- Cloud Firestore and Firebase Emulator Suite for application persistence and isolated testing.
- Cloudflare Worker source under `app/worker/` provides the intended API boundary, Firebase ID token verification, CORS allowlist, Firestore REST operations and idempotent business operations.
- Leaflet/React-Leaflet for map interactions.
- Node test runner, Firestore Rules tests, ESLint and project validation scripts.

Firebase Functions code remains in the repository but must not be described as a deployed production service without current endpoint evidence. The Worker is implemented in source; a healthy deployed runtime must be verified separately.

## Release status and evidence

The main-branch audit dated 2026-11-12 documents `BUSINESS.acceptingOrders=false` and `ORDERS_ENABLED=false`, keeping order intake closed. Customer catalog discovery, authenticated cart/profile behavior and non-admin denial were verified locally using emulators. `npm run check` passed locally on that date with 87 Worker, 43 domain, 12 Firestore Rules and 7 Functions/Firestore integration tests, plus lint, build, bundle budget and smoke checks. Six moderate production dependency advisories remained; the weighted functional evidence score was 67.5%.

These are dated results, not a fresh validation on 2026-11-17. They do not imply production order intake, a production deployment, real inventory writes or release approval.

## Main flows

Customer: discover catalog → configure canonical recipe → maintain authenticated cart → review fulfillment/contact details → submit to the trusted API only when release guards permit → receive trusted confirmation and follow delivery status where supported.

Administration: authenticate → verify admin claim → inspect orders and operational queues → transition allowed order/payment states → manage delivery zones, virtual tables and inventory-related actions through trusted backend operations.

The browser is untrusted. Prices, costs, totals, profit, sequence numbers and privileged state must be validated or rebuilt by trusted domain/backend logic.

## Cupboard integration

The Worker contains a cross-project bridge using separate service identities, deterministic movement identifiers and transactional operations. This is a code-level capability, not proof that production credentials, IAM, ingredient mappings or remote runtime are configured. Keep Home and Business inventory contexts isolated. No real inventory writes without explicit authorization and controlled verification.

## Development and canonical documentation

The runnable application is in `app/`. Read `app/README.md`, `app/worker/README.md` and `app/docs/development/local-worker.md` for implementation details. Use Firebase emulators for data/integration tests. Inspect current package scripts and `AGENT.md` before running commands.

Key evidence: `app/docs/FINALIZATION-AUDIT.md`, `app/docs/INTEGRATION-MATRIX.md`, `app/docs/RELEASE-CHECKLIST.md`, `app/docs/BROWSER-QA-REPORT.md` and `ROADMAP.md`.

Keep dated checkpoints immutable; append new dated evidence rather than rewriting historical results to appear current. No deployment, billing change, destructive migration, real order or real inventory operation without explicit authorization.

---
**Sandwichies · PALMI-D3V**
