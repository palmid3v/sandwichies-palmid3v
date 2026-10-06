# STEPBYSTEP — Sandwichies

## 1. Source of truth

This repository is the source of truth for Sandwichies.

Master documents:

- `README.md` — product map and current public project state.
- `CONTEXT.md` — project memory, business rules, architecture constraints.
- `MASTERPROMPT.md` — product, UX/UI, engineering, security, QA and release contract.
- `STEPBYSTEP.md` — engineering operating manual and current execution sequence.
- `ROADMAP.md` — product destination and priorities.

Historical evidence remains under `app/docs/v0.1/`.

## 2. Current execution phases

The project now follows this sequence:

```
PHASE 0  Governance + Masterprompt
   ↓
PHASE 1  Domain integrity
   ↓
PHASE 2  Security + Emulator
   ↓
PHASE 3  CI + dependency quality
   ↓
PHASE 4  Integration + browser smoke
   ↓
PHASE 5  Release verification
   ↓
PHASE 6  Business/inventory semantics
   ↓
PHASE 7  Sandwichies Visual System
   ↓
PHASE 8  Motion + Interaction System
   ↓
PHASE 9  Customer Discovery + Ordering UX
   ↓
PHASE 10 New Favorites + New Creations
   ↓
PHASE 11 Admin/Product Operations UX
   ↓
PHASE 12 Performance + Measurement
   ↓
PHASE 13 Product Expansion
```

**Important:** security and release blockers remain higher priority than visual/product expansion.

**Current approved execution:** FASE 1–4 and FASE 7–11 are APPROVED ALL. FASE 11 implementation is present on main. Release verification remains a separate gate.

## 3. Repository structure

```text
sandwichies-palmid3v/
├── README.md
├── CONTEXT.md
├── MASTERPROMPT.md
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

## 4. Development workflow

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

## 5. Domain authority

The following modules are authoritative:

- `app/shared/catalog.js`
- `app/shared/pricing.js`
- `app/shared/business.js`
- `app/shared/recipes.js`
- `app/shared/order-request.js`

Client code may preview and present values, but financial values supplied by a browser must never be trusted.

The Firebase callable function `createOrder` reconstructs the trusted order.

## 6. Product/UX workflow

For any customer-facing or admin-facing UX change:

1. Identify the user/business outcome.
2. Check `MASTERPROMPT.md` and current product context.
3. Inspect the current screen/flow before redesigning it.
4. Define the UX problem, not only the visual change.
5. Define hierarchy, states, responsive behavior and interaction behavior.
6. Define motion purpose before adding animation.
7. Reuse the existing design language where it is good.
8. Create a new pattern only when a real product need exists.
9. Validate mobile first.
10. Validate accessibility and reduced-motion implications.
11. Test the implemented flow.
12. Document the resulting product decision when it changes the system.

### UI quality gate

A UI change is incomplete if it only changes appearance but leaves broken states, poor feedback, inconsistent spacing, or mobile problems.

### Motion quality gate

Motion must be:
- intentional,
- fast enough,
- consistent,
- state-aware,
- accessible,
- removable/reduced where appropriate.

Do not add animation simply because the masterprompt requests interactivity.

## 7. Product discovery workflow

For new product/favorite/creation work:

1. Define the product concept.
2. Define the customer value.
3. Determine whether it is production, seasonal, or experimental.
4. Put product data in the canonical domain source.
5. Review pricing/cost implications.
6. Review inventory implications.
7. Design discovery and presentation.
8. Validate order reconstruction.
9. Add tests.
10. Update product documentation.

## 8. Security workflow

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

## 9. Feature workflow

For every feature:

1. Define user/business outcome.
2. Check `MASTERPROMPT.md`, `CONTEXT.md`, and `ROADMAP.md`.
3. Locate the existing domain authority.
4. Reuse existing business logic before creating new logic.
5. Review UX/UI implications.
6. Review security implications.
7. Implement the smallest coherent change.
8. Add/update tests.
9. Update documentation when behavior, architecture, product rules, or release status changes.
10. Run `npm run check`.
11. Review the diff for accidental files, duplicated logic, secrets, and stale documentation.
12. Only then mark the work complete.

## 10. Data and pricing changes

For any cost, recipe, price, delivery, inventory, or profit change:

- Update the authoritative shared module.
- Update affected tests.
- Verify customer preview.
- Verify trusted server reconstruction.
- Verify admin calculations.
- Review UX implications.
- Update the corresponding task/report documentation.

Never hardcode a second version of a price in a UI component.

## 11. Orders

Order numbers are server-owned.

Totals, costs, profit, status and other trusted financial/order fields are server-owned.

Direct browser writes to `orders` are intentionally denied by Firestore Rules.

Order status/payment semantics must remain consistent between:

- `app/shared/order-request.js`
- `app/shared/business.js`
- `app/functions/index.js`
- `app/firestore.rules`
- admin UI

## 12. Testing standard

Minimum local gate:

```powershell
npm run check
```

This currently runs:

- ESLint
- Node tests
- Vite production build

Security-sensitive changes additionally require Firebase Emulator Rules validation before release approval.

Product-facing changes should add browser smoke coverage as the flow becomes stable.

A test that is not actually executed must not be reported as passing.

## 12A. Phase 6 business/inventory semantics

Completed-sale accounting: `delivered + paid = completed sale`.

Order status transitions:
`pendiente → confirmado → preparando → listo → entregado`, with cancellation allowed only before payment is finalized. Delivered and cancelled are terminal.

Payment transition:
`pendiente → pagado`.

WhatsApp semantics:
customer-facing confirmation and order summary after trusted order creation; never the source of financial or operational truth.

Inventory:
- `stockQuantity` is the opening baseline from catalog data.
- `inventoryBalances` stores current transactional balances.
- `inventoryTransactions` stores purchases, automated completed-sale consumption, and explicit adjustments.
- completed-sale consumption is generated by a Firestore trigger and is idempotent per order/ingredient.
- historical orders without physical ingredient usage are not silently consumed.

## 12B. FASE 7–8 visual/interaction workflow

Visual system source:
- `app/src/index.css` — global tokens;
- `app/src/styles/storefront.css` — customer product language;
- `app/src/styles/admin.css` — admin surface language;
- `app/docs/design/DESIGN-SYSTEM.md` — design decisions.

Interaction source:
- `app/src/styles/motion.css` — reusable motion patterns;
- component `aria-pressed` and state classes — semantic selection feedback;
- reduced-motion media query — accessibility fallback.

Do not add animation without a product purpose. Prefer shared tokens/classes over one-off durations.

Before closing the phase, the human reviewer should inspect the branch in a browser at mobile and desktop widths. That visual evidence is intentionally outside GitHub automation.

## 12C. FASE 9–10 discovery/product workflow

Discovery UI is a presentation layer over canonical product data. Product names, descriptions, classifications, recipes and pricing inputs remain in shared/domain sources.

FASE 9 uses discovery segments for featured, popular, new, signature and seasonal products and connects selection directly to the existing trusted configuration flow.

FASE 10 adds production product metadata and new creations without creating a second pricing or order-validation path. New products must pass the same shared pricing and trusted order reconstruction model.

Browser evidence remains pending until the human reviewer inspects mobile, tablet and desktop behavior.

## 13. Release gate

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

## 14. Documentation lifecycle

Current documentation belongs in current documentation paths.

Historical documents under `app/docs/v0.1/` are evidence and must not be silently rewritten to represent the current state.

When a historical decision is superseded, create/update a current document and preserve the historical record.

## 15. Data Connect policy

`app/dataconnect/` is not part of the active Firestore order architecture.

Until explicitly adopted, it is treated as experimental/legacy material and must not be introduced into the production order flow accidentally.

Any decision to activate it requires an architecture decision record and an explicit roadmap item.

## 16. Definition of Done

A task is DONE only when:

- implementation exists,
- expected behavior is validated,
- tests/build/lint pass where applicable,
- security implications are checked,
- UX/UI implications are reviewed where relevant,
- documentation is synchronized,
- no known blocker remains,
- the repository remains structurally coherent.

If one of these is missing, the status is not DONE.


## 12D. FASE 11 Admin/Product Operations UX

FASE 11 is approved and implemented on main.

Operational workflow:
- prioritize active orders and payment attention;
- expose explicit order/payment state in detail;
- provide a safe next-status shortcut using existing transition guards;
- surface low inventory capacity without changing inventory authority;
- provide success/error feedback for operational mutations;
- preserve admin authorization boundaries through Firebase Auth/custom claims and Firestore Rules.

No production deployment, GitHub Actions execution, or release-gate change is included. Browser/Emulator evidence remains pending.
