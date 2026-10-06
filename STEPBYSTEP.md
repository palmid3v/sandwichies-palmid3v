# STEPBYSTEP — Sandwichies

## 1. Source of truth

This repository is the source of truth for Sandwichies.

Master documents:

- `README.md` — product map and current public project state.
- `CONTEXT.md` — project memory, business rules, architecture constraints.
- `STEPBYSTEP.md` — engineering operating manual.
- `ROADMAP.md` — current product destination and release priorities.

Historical evidence remains under `app/docs/v0.1/`.

## 2. Repository structure

```text
sandwichies-palmid3v/
├── README.md
├── CONTEXT.md
├── STEPBYSTEP.md
├── ROADMAP.md
├── .github/
│   └── workflows/
├── app/
│   ├── src/              # Browser application
│   ├── shared/           # Authoritative domain/business logic
│   ├── functions/        # Trusted Firebase backend
│   ├── test/             # Automated tests
│   ├── scripts/          # Explicit administrative tooling
│   ├── docs/             # Detailed product/engineering documentation
│   ├── dataconnect/      # Experimental/legacy Data Connect material
│   └── package.json
└── archive/              # Historical material only
```

### Placement rule

Do not create loose files at repository root unless they are repository-level governance, documentation, CI/CD, or configuration.

Application code belongs under `app/`.

Business/domain logic shared by browser and backend belongs under `app/shared/`.

Do not duplicate pricing, catalog, order validation, or business rules in multiple layers.

## 3. Development workflow

From the repository root:

```powershell
cd app
npm install
npm run lint
npm test
npm run build
npm run check
```

During development:

```powershell
cd app
npm run dev
```

A change is not considered complete until the relevant validation passes.

## 4. Domain authority

The following modules are authoritative:

- `app/shared/catalog.js`
- `app/shared/pricing.js`
- `app/shared/business.js`
- `app/shared/recipes.js`
- `app/shared/order-request.js`

Client code may preview and present values, but financial values supplied by a browser must never be trusted.

The Firebase callable function `createOrder` reconstructs the trusted order.

## 5. Security workflow

Customer:

```
Browser
  → Firebase callable createOrder
  → server-side validation/recalculation
  → Firestore Admin SDK
```

Admin:

```
Firebase Auth
  → admin custom claim
  → Firestore rules
  → admin application
```

Never weaken Firestore rules to make a feature work.

Never place service-account credentials or private secrets in browser code.

The Firebase web configuration in `app/src/firebase.js` contains public client configuration only; secrets must remain outside the repository.

## 6. Feature workflow

For every feature:

1. Define the user/business outcome.
2. Check `CONTEXT.md` and `ROADMAP.md`.
3. Locate the existing domain authority.
4. Reuse existing business logic before creating new logic.
5. Implement the smallest coherent change.
6. Add/update tests.
7. Update documentation when behavior, architecture, business rules, or release status changes.
8. Run `npm run check`.
9. Review the diff for accidental files, duplicated logic, secrets, and stale documentation.
10. Only then mark the work complete.

## 7. Data and pricing changes

For any cost, recipe, price, delivery, inventory, or profit change:

- Update the authoritative shared module.
- Update affected tests.
- Verify customer preview.
- Verify trusted server reconstruction.
- Verify admin calculations.
- Update the corresponding task/report documentation.

Never hardcode a second version of a price in a UI component.

## 8. Orders

Order numbers are server-owned.

Totals, costs, profit, status and other trusted financial/order fields are server-owned.

Direct browser writes to `orders` are intentionally denied by Firestore Rules.

Order status/payment semantics must remain consistent between:

- `app/shared/order-request.js`
- `app/shared/business.js`
- `app/functions/index.js`
- `app/firestore.rules`
- admin UI

## 9. Testing standard

Minimum local gate:

```powershell
npm run check
```

This currently runs:

- ESLint
- Node tests
- Vite production build

Security-sensitive changes additionally require Firebase Emulator Rules validation before release approval.

A test that is not actually executed must not be reported as passing.

## 10. Release gate

Before enabling production ordering:

- `BUSINESS.acceptingOrders` must be intentionally enabled.
- Pricing/catalog must be reviewed.
- Admin claim must be provisioned for the intended existing account.
- Firestore rules must be deployed and validated.
- Functions must be deployed and callable.
- Customer checkout must be smoke-tested.
- Admin login/orders/dashboard must be smoke-tested.
- Production build must pass.
- No unresolved high-severity security issue may remain.
- Release documentation must record what was deployed and when.

## 11. Documentation lifecycle

Current documentation belongs in the current documentation paths.

Historical documents under `app/docs/v0.1/` are evidence and must not be silently rewritten to represent the current state.

When a historical decision is superseded, create/update a current document and preserve the historical record.

## 12. Data Connect policy

`app/dataconnect/` is not part of the active Firestore order architecture.

Until explicitly adopted, it is treated as experimental/legacy material and must not be introduced into the production order flow accidentally.

Any decision to activate it requires an architecture decision record and an explicit roadmap item.

## 13. File placement rule

Prefer this order:

1. Existing canonical file.
2. Existing directory for the same concern.
3. New file inside the appropriate existing concern directory.
4. New directory only when a real architectural boundary exists.

Do not create:

- random root Markdown files,
- duplicate utilities,
- duplicate configuration,
- feature files mixed with documentation,
- temporary archives inside source directories.

## 14. Definition of Done

A task is DONE only when:

- implementation exists,
- expected behavior is validated,
- tests/build/lint pass where applicable,
- security implications are checked,
- documentation is synchronized,
- no known blocker remains,
- the repository remains structurally coherent.

If one of these is missing, the status is not DONE.
