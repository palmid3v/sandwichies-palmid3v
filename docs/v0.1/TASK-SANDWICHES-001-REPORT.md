# TASK-SANDWICHES-001 — Implementation Report

**Date:** 2026-09-29  
**Scope:** local implementation only. No Firebase deployment, production-rule publication, data mutation, custom-claim assignment, Git commit, or push was performed.

## 1. TASK STATUS

`COMPLETED WITH PENDING ITEMS`

The trusted order boundary, role-gated rules, centralized pricing model and critical pure-logic tests are implemented and locally verified. Firebase Emulator validation, production rollout, UI-motion scope, dependency remediation and a few product decisions remain pending.

## 2. SUMMARY

- Added a shared domain model so the UI and Cloud Function use the same catalog, portions, costs and price calculation.
- Added a Firebase callable function that rebuilds every financial/order value and allocates the order number in a Firestore transaction.
- Removed direct public Firestore order/counter writes and restricted administration to the `admin` custom claim.
- Reworked the customer checkout request to send only configuration data, not financial values or a counter.
- Made dashboard sales recognition explicit: an order is counted as a sale only when it is both `entregado` and `pagado`.
- Expanded the suite from 3 to 9 tests for pricing, consumption and order-request integrity.

## 3. FILES CHANGED

- `firebase.json`
  - Declares the Node.js 20 Firebase Functions source configuration.
- `firestore.rules`
  - Blocks public direct order/counter access; grants order read/update only to custom-claim admins.
- `package.json`
  - Adds Firebase Admin and Functions runtime dependencies and sets the Functions entry point.
- `package-lock.json`
  - Captures installed dependency changes.
- `functions/index.js`
  - Adds trusted `createOrder` callable function and transactional consecutive allocation.
- `shared/catalog.js`
  - Canonical ingredient, portion, package-cost, size, topping and extra definitions.
- `shared/business.js`
  - Shared operational/business configuration and statuses.
- `shared/pricing.js`
  - Pure configuration normalization, ingredient usage, cost, price and order-total calculation.
- `shared/order-request.js`
  - Strict public order request validation and trusted persisted-order builder.
- `shared/package.json`
  - Marks shared domain files as ESM.
- `src/config/business.js`
  - Becomes the UI facade for shared business configuration.
- `src/data/ingredients.js`
  - Becomes the UI view of the centralized catalog with explicit unit/consumption names.
- `src/data/menu.js`
  - Menu configurations now reference stable ingredient IDs and use shared pricing for display prices.
- `src/utils/pricing.js`
  - UI facade over the shared pricing model; compatibility helpers retained during migration.
- `src/pages/OrderPage.jsx`
  - Builds a bounded configuration request and invokes `createOrder`; no direct Firestore transaction remains.
- `src/App.jsx`
  - Checks the `admin` custom claim before subscribing to/administering orders; inventory capacity uses stored ingredient usage.
- `src/components/Dashboard.jsx`
  - Separates operational orders from completed sales in displayed metrics.
- `test/pricing.test.js`
  - Replaces the 3 basic tests with 9 pricing/consumption/request-integrity tests.

## 4. SECURITY CHANGES

### Trusted order creation and validation

`functions/index.js` exposes `createOrder`. The browser sends customer details, selected configuration, fulfillment, payment method and notes only. `shared/order-request.js` rejects client-supplied totals, costs, profit, status, timestamps and order number. It also validates allowed size, ingredient IDs, duplicate selections, quantity range, item count, payment method, phone, address and string limits.

The function calculates the server-owned item cost, price, ingredient usage, delivery fee, subtotal, total and profit. It then creates the order and increments `counters/orders` within one Firestore transaction.

### Admin roles and Firestore rules

Rules use `request.auth.token.admin == true`, not merely authenticated status. Direct browser `create`/`delete` for `orders` and all client access to `counters/orders` are denied. The Admin SDK used by the Cloud Function bypasses Firestore Rules as intended.

Expected role-assignment procedure (not executed): use a privileged Admin SDK/secure operator script to set `{ admin: true }` as a Firebase custom claim for approved accounts, then have the affected user sign in again or refresh their ID token. There is no role-assignment UI.

## 5. COST/PRICING CHANGES

`shared/catalog.js` is the single obvious maintenance source for ingredients. Every ingredient now has a stable `id`, `unit`, `packageCost`, `packageQuantity`, `portionQuantity` and estimated `stockQuantity`.

The old ambiguous `used`/`usedGrams` values were replaced in the authoritative model by `portionQuantity`: the amount consumed by one 15 cm sandwich portion. The existing local cost/quantity edits were preserved: enabled ordering, 30 cm bread cost of COP 3,500, updated turkey portion/cost, and chorizo/salami package figures.

The model centrally handles:

- Size multiplier and bread cost.
- Protein ID plus portion quantity (1–3 selected portions).
- Double protein multiplier and customer charge.
- Extra cheese consumption and customer charge.
- Toppings as data-driven ingredient consumption.
- Delivery fee from shared business configuration.
- Deterministic rounding to whole COP.

React components no longer contain the final-price formula. The browser calculates a preview, but the function recalculates it authoritatively.

## 6. INVENTORY/DASHBOARD CHANGES

Every calculated item now stores an `ingredientUsage` map. The inventory estimate aggregates those persisted maps from non-cancelled orders and combines them with the catalog's configured estimate; it remains an estimate, not transactional inventory.

The dashboard now labels and calculates “completed sales” from orders that are both delivered and paid. It still shows non-cancelled orders as operational work. This is explicit in code but requires product approval as the accounting policy.

## 7. UI / MOTION CHANGES

No UI-motion patch was completed in this implementation pass. The existing food/product visual identity has not been replaced or given AI-brand styling. Motion, reduced-motion coverage and the recommended-sandwich placeholder remain pending before this task can be marked fully complete.

## 8. TESTS / VALIDATION

Executed locally on 2026-09-29:

```text
npm install firebase-admin@^13.0.0 firebase-functions@^6.0.1 react-router-dom@^7.18.2
  -> PASS (dependencies installed)

npm run lint
  -> PASS

npm test
  -> PASS (9/9)

npm run build
  -> PASS
  -> Vite warning remains: initial JS bundle 613.18 kB (189.65 kB gzip)

npm audit --omit=dev
  -> 11 vulnerabilities: 1 critical, 1 high, 9 moderate
```

The high `@grpc/grpc-js` and critical `websocket-driver` findings remain transitive. The newly introduced Firebase Admin/Functions chain also has moderate findings with a major-version update offered. No `npm audit fix --force` was applied.

Firebase Emulator and production security-rule tests were **not** run. Production access was intentionally not used.

## 9. PENDING ITEMS

- PENDING: Firebase deployment and custom claims.
  - Reason: the approved task explicitly forbids production rule publication, function deployment, production data changes and claim assignment.
  - What is needed: review this implementation, deploy to a non-production/approved target, set approved admin custom claims securely, then run role and callable smoke tests.

- PENDING: Emulator authorization tests.
  - Reason: Firebase Emulator Suite configuration/tests do not yet exist in this repository.
  - What is needed: add emulator dependencies/configuration and test public denial, non-admin denial, admin access, and callable counter allocation.

- PENDING: UI motion and recommended-sandwich placeholder.
  - Reason: implementation was deliberately stopped after the security/cost scope and before final review.
  - What is needed: approve continuation of the UI workstream, then add CSS-only purposeful motion with `prefers-reduced-motion` coverage and a non-functional placeholder.

- PENDING: WhatsApp business semantics.
  - Reason: current behavior persists the order before opening WhatsApp, but neither code nor product policy defines an unsent WhatsApp message as confirmation or cancellation.
  - What is needed: Nexsy/product decision and documented operator flow.

- PENDING: Sales-accounting definition.
  - Reason: `entregado + pagado` was selected as a conservative explicit implementation, but this is a business policy.
  - What is needed: approve it or specify another recognition rule.

- PENDING: Dependency remediation.
  - Reason: production audit still reports 11 vulnerabilities, and available fixes include major upgrades for Firebase runtime packages.
  - What is needed: dependency compatibility review and controlled upgrade in a dedicated pass.

- PENDING: Obsolete/historical files.
  - Reason: `src/utils/whatsapp.js` and `src/src.7z` were reviewed but not deleted; deleting historical material without owner confirmation is not safe.
  - What is needed: confirm retention/removal policy.

- PENDING: Admin-route lazy loading.
  - Reason: Vite still reports a bundle-size warning.
  - What is needed: a performance pass after correctness/release readiness is approved.

## 10. GIT STATUS

At report creation:

- Changed tracked files: `firebase.json`, `firestore.rules`, `package.json`, `package-lock.json`, `src/App.jsx`, `src/components/Dashboard.jsx`, `src/config/business.js`, `src/data/ingredients.js`, `src/data/menu.js`, `src/pages/OrderPage.jsx`, `src/utils/pricing.js`, `test/pricing.test.js`.
- Untracked files/directories: `docs/v0.1/AUDIT_REPORT.md`, `docs/v0.1/TASK-SANDWICHES-001-REPORT.md`, `functions/`, `shared/`.
- Staged files: none.
- Unstaged changes: all listed changes.
- Commit created: no.
- Push performed: no.
