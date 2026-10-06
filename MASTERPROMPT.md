# MASTERPROMPT — Sandwichies

**Version:** 2.0  
**Effective:** 2026-10-05  
**Project:** Sandwichies  
**Owner:** PALMI-D3V  
**Mode:** Approved execution — FASE 1–11  
**Status:** BUILD / HARDEN / VERIFY

---

## 1. Mission

Build Sandwichies as a trustworthy, distinctive, mobile-first sandwich ordering and operations product.

The product must be:

**Functional + secure + financially trustworthy + interactive + visually distinctive + responsive + testable + evolvable.**

Do not optimize for code volume. Optimize for product value and evidence.

---

## 2. Source of truth

The GitHub repository is the source of truth:

`palmid3v/sandwichies-palmid3v`

Current branch:

`main`

The project control plane is:

1. `README.md`
2. `CONTEXT.md`
3. `MASTERPROMPT.md`
4. `STEPBYSTEP.md`
5. `ROADMAP.md`

Detailed current documentation lives under `app/docs/`. Historical material is preserved under `app/docs/v0.1/`.

Never rewrite historical material to impersonate current behavior.

---

## 3. Approval contract

**FASE 1 — Domain Integrity: APPROVED**  
**FASE 2 — Security Hardening: APPROVED**  
**FASE 3 — Quality + CI: APPROVED**  
**FASE 4 — Integration + Browser Validation: APPROVED**  
**FASE 7 — Visual System: APPROVED**  
**FASE 8 — Motion + Interaction System: APPROVED**  
**FASE 9 — Customer Discovery + Ordering UX: APPROVED**  
**FASE 10 — New Favorites + New Creations: APPROVED**  
**FASE 11 — Admin/Product Operations UX: APPROVED ALL**

The implementation agent is authorized to execute all approved work without waiting for another approval between these phases.

**FASE 7–11: APPROVED ALL**

For FASE 7–11, visual, interaction, discovery and product-content improvements are authorized within the existing architecture. Do not expand into unrelated product features or release deployment.

Do not interpret approval as permission to weaken security, fabricate test evidence, or enable production ordering without the separate release gate.

---

## 4. Product rules

Sandwichies is not a generic CRUD application.

Customer experience should emphasize:

- appetite
- discovery
- confidence
- speed
- product identity
- food-driven visual language
- low-friction ordering

Customer UX is mobile-first.

Admin UX is operationally focused and must remain secure.

---

## 5. Architecture contract

Preserve the existing architecture unless a real architectural reason requires change.

Canonical boundaries:

```
Customer/Admin UI
      ↓
browser adapters
      ↓
app/shared domain logic
      ↓
trusted Firebase callable functions
      ↓
Firestore
```

Authoritative shared modules:

- `app/shared/catalog.js`
- `app/shared/pricing.js`
- `app/shared/business.js`
- `app/shared/recipes.js`
- `app/shared/order-request.js`

Do not duplicate catalog, pricing, recipe, order validation, or business rules in the UI.

Do not mass-restructure stable folders merely for aesthetics.

---

## 6. Security contract

The browser is untrusted.

Never trust browser-submitted:

- prices
- totals
- costs
- profit
- order numbers
- trusted statuses
- trusted financial fields
- catalog definitions

Customer order creation must continue through `createOrder`.

The server must reconstruct and validate trusted order values.

Firestore rules must remain restrictive.

Expected authorization model:

```
Customer
  → callable createOrder
  → trusted backend
  → Firestore Admin SDK

Admin
  → Firebase Auth
  → custom claim admin=true
  → Firestore Rules
```

Direct browser order creation/deletion remains denied.

Direct browser counter access remains denied.

Never weaken rules to make tests or features pass.

---

## 7. FASE 1 — Domain Integrity

Maintain and verify:

- centralized catalog authority
- centralized pricing authority
- centralized recipe authority
- centralized business configuration
- trusted order request validation
- server-side order reconstruction
- server-owned order numbering
- server-owned financial values
- financial tampering resistance
- consistency between customer preview and trusted backend reconstruction

Any domain change must update affected tests.

Definition of done for FASE 1:

- domain behavior is represented by authoritative shared modules;
- tests cover important business invariants;
- no duplicate financial/business source exists;
- customer and backend agree on the same semantic model.

---

## 8. FASE 2 — Security Hardening

Implement and maintain:

- Firebase Auth admin boundary
- admin custom claim authorization
- restrictive Firestore Rules
- Emulator-based Rules regression tests
- security regression coverage for orders
- security regression coverage for counters
- non-admin denial coverage
- direct-write denial coverage

Minimum Rules regression expectations:

- unauthenticated read of orders: denied
- unauthenticated order create/delete: denied
- authenticated non-admin order read: denied
- authenticated non-admin order update: denied
- admin order read/update: allowed
- admin direct order create: denied
- admin direct order delete: denied
- browser counter read/write: denied
- unspecified collections: denied

Security tests must run against Firebase Emulator Suite.

Do not claim security validation without actual execution.

---

## 9. FASE 3 — Quality + CI

The quality pipeline is:

```
install
↓
dependency audit
↓
lint
↓
unit/domain tests
↓
Firebase Rules regression
↓
production build
↓
browser smoke
```

Required commands from `app/`:

```bash
npm ci
npm run audit
npm run lint
npm test
npm run security:test
npm run build
npm run smoke
```

The local convenience gate:

```bash
npm run check
```

CI must enforce the quality gates on pushes to `main` and pull requests.

Dependency audit policy:

- high severity and critical vulnerabilities fail CI;
- do not silently suppress vulnerabilities;
- document accepted exceptions explicitly when unavoidable.

---

## 10. FASE 4 — Integration + Browser Validation

Establish a practical regression baseline for:

### Customer

- root page boots
- catalog/configuration UI boots
- responsive layout remains structurally valid
- cart flow remains available
- checkout-disabled state remains respected while `acceptingOrders=false`
- loading/empty/error states do not crash the app

### Admin

- `/admin` boots
- unauthenticated user is sent to login
- authenticated non-admin receives restricted access
- authenticated admin can enter the operational UI
- orders/dashboard/inventory screens can render

### Browser smoke principle

Smoke tests validate boot and critical entrypoints without fabricating a production order.

Production ordering remains gated behind release verification.

---

## 11. Product visual direction

Sandwichies is dark-first.

Dark-first does **not** mean generic black.

Visual language should draw from:

- bread
- ingredients
- sauces
- grill/kitchen energy
- premium food menus
- street food
- warmth

Use the existing brand palette when useful, but structure it into intentional design tokens.

Required principles:

- readable typography
- strong hierarchy
- clear contrast
- tactile controls
- obvious selected states
- visible focus states
- mobile-friendly touch targets
- consistent radii, spacing, elevation
- meaningful interaction feedback

Avoid generic SaaS visual language when it weakens food/product identity.

---

## 12. Motion and interaction

Motion must have a product purpose.

Use motion to:

- confirm actions
- communicate state
- guide attention
- reinforce continuity
- reinforce identity

Avoid:

- unnecessary animation
- excessive duration
- distracting loops
- motion that harms readability
- animation that ignores reduced-motion preferences

`prefers-reduced-motion` must remain respected.

---

## 13. Product discovery

Architecture must support:

- favorites
- featured products
- popular products
- new creations
- seasonal products
- signature combinations
- recommended products

Product definitions belong in canonical domain data.

Do not hardcode duplicate product content in components.

Experimental products must be distinguishable from production products.

---

## 14. Business integrity

Treat these as domain semantics, not UI decoration:

- pricing
- recipes
- costs
- estimated profit
- delivery
- payment status
- order status
- completed-sale accounting
- inventory estimates
- inventory transactions

Inventory estimates must not be presented as transactional inventory unless underlying transactions exist.

When semantics are uncertain, document the decision.

---

## 15. Data Connect

`app/dataconnect/` remains experimental/non-production.

Do not move production ordering to Data Connect without:

- architecture decision
- migration plan
- tests
- roadmap update
- explicit approval

---

## 16. Repository placement

Prefer:

1. existing canonical file
2. existing concern directory
3. new file inside correct concern
4. new directory only for a genuine boundary

Do not create:

- duplicate utilities
- duplicate business rules
- temporary source files
- loose build artifacts
- secrets
- random root files

Keep historical assets isolated under historical/archive locations.

---

## 17. Documentation contract

When behavior changes, synchronize relevant documentation.

Update when applicable:

- `CONTEXT.md`
- `ROADMAP.md`
- `STEPBYSTEP.md`
- `app/docs/development/TESTING.md`
- `app/docs/architecture/SECURITY.md`
- `app/docs/deployment/RELEASE-CHECKLIST.md`
- phase/task reports

Current documentation must describe current behavior.

---

## 18. Execution workflow

For every implementation unit:

1. Inspect current source of truth.
2. Identify canonical domain ownership.
3. Define the user/business outcome.
4. Check security boundary.
5. Check UX/UI and responsive impact.
6. Implement the smallest coherent change.
7. Add or update tests.
8. Validate.
9. Update documentation.
10. Inspect resulting diff.
11. Verify no secrets or accidental files.
12. Record evidence.

Do not call a task complete because code merely compiles.

---

## 19. Quality gate

A change is **DONE** only when the relevant evidence exists.

Baseline evidence:

- lint
- tests
- build

Security-sensitive evidence:

- Emulator Rules regression

Customer/admin integration evidence:

- smoke baseline
- responsive/browser validation where applicable

Never invent evidence.

---

## 20. Release boundary

`BUSINESS.acceptingOrders` remains **false** until release verification is complete.

FASE 1–4 approval does not automatically authorize:

- production Firebase deployment
- production Rules deployment
- enabling live ordering
- production smoke execution against real customer data
- changing payment/operational policy

Those belong to the explicit release gate.

---

## 21. Priorities

P0: security, data integrity, production blockers  
P1: core product value and release quality  
P2: UX/UI and interaction quality  
P3: maintainability/performance  
P4: experiments

Do not allow speculative work to bypass unresolved P0/P1 problems.

---

## 22. Master execution loop

```
OBSERVE
↓
AUDIT
↓
UNDERSTAND
↓
DESIGN
↓
IMPLEMENT
↓
TEST
↓
MEASURE
↓
IMPROVE
```

---

## 23. Definition of Done

Sandwichies work is complete only when:

- implementation exists;
- behavior is validated;
- lint/test/build pass where applicable;
- security implications are checked;
- integration/browser behavior is checked where applicable;
- UX/UI implications are reviewed where relevant;
- documentation is synchronized;
- repository structure remains coherent;
- no known blocker is being hidden;
- evidence is recorded honestly.

---

## 24. Current execution directive

**FASE 1–4: APPROVED ALL**  
**FASE 7–11: APPROVED ALL**

Proceed directly with implementation.

Do not wait for phase-by-phase approval.

Do not broaden scope into unrelated features.

Do not enable production ordering merely because tests pass.

After each approved implementation group, report:

- implementation completed
- tests actually executed
- security checks actually executed
- CI status when applicable
- browser validation status
- remaining release blockers
- exact next approved phase
