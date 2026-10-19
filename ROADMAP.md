# ROADMAP — Sandwichies

**Current release line:** MVP hardening → Product Experience Evolution  
**Operational state:** `acceptingOrders = false`  
**Status:** Fases A–B previously applied; Fases C–D storefront/admin improvements committed directly to main. Automated CI and browser review are the remaining evidence gates.

## North star

Build a trustworthy sandwich ordering product that feels distinctive, interactive, mobile-first and intentionally designed.

Customers should be able to discover, configure and submit sandwiches reliably. Pricing and financial values must remain trusted. Administrators must operate safely. The visual and interaction system should make Sandwichies feel like a real food product rather than a generic CRUD application.

---

## Execution track A–D — current work

This track is the current hands-on sequence alongside the numbered historical/product phases.

### Fase A — Integridad y release
- [x] Reconcile the six Excel-defined recipes and current unit purchase costs in documentation.
- [x] Restrict browser-admin order updates to operational status/payment status and update timestamp.
- [x] Add regression cases for protected order, customer, financial and inventory fields.
- [ ] Run dependency audit, lint, domain tests, Firestore Emulator rules tests, build and smoke.
- [ ] Validate rules and error/retry behavior in a non-production environment.
- [ ] Inspect inventory recovery/idempotency behavior for duplicate events and failure paths.

### Fase B — Diseño y prototipo
- [x] Add a standalone responsive storefront prototype outside the production app bundle.
- [x] Document desktop/mobile hierarchy and loading, empty, error and checkout-disabled states.
- [ ] Human visual review at mobile and desktop widths.
- [ ] Approve prototype before implementing its patterns in the functional storefront.

### Fase C — Storefront
- [x] Add menu search across product names/descriptions alongside discovery segments.
- [x] Improve empty search results and reset actions.
- [x] Add an explicit submit-handler guard while `acceptingOrders = false`, preserving the cart.
- [x] Preserve shared catalog, pricing and trusted order contracts.
- [ ] Browser-test discovery, configurator, cart and disabled-checkout behavior.

### Fase D — Administración
- [x] Add payment-status filtering and resettable search/status/payment filters to order history.
- [x] Make the payment-pending summary shortcut open orders with pending payments.
- [x] Add responsive styling for the new admin filter controls.
- [ ] Validate permission failures, duplicate events, inventory recovery and responsive layouts.
- [ ] Evaluate pagination only against observed order volume.

**Release boundary:** no production deploy, no rules/functions deployment, and no enabling checkout during this work. `BUSINESS.acceptingOrders` stays false.

---

## Phase 0 — Governance + Masterprompt

- [x] Root README
- [x] Root CONTEXT
- [x] Root STEPBYSTEP
- [x] Root ROADMAP
- [x] Root MASTERPROMPT
- [x] Historical documentation preserved
- [x] Repository placement rules
- [x] Current architecture identified
- [x] Data Connect classified as non-production/experimental
- [x] Product/UX operating contract defined

## Phase 1 — Domain integrity

- [x] Shared catalog
- [x] Shared pricing
- [x] Shared recipes
- [x] Shared business configuration
- [x] Trusted order request validation
- [x] Server-side order reconstruction
- [x] Transactional order numbering
- [x] Financial tampering tests

## Phase 2 — Security hardening

- [x] Firebase Auth for admin
- [x] Admin custom claim
- [x] Firestore admin authorization
- [x] Direct browser order creation denied
- [x] Direct counter access denied
- [x] Admin-only order reads/updates
- [x] Firebase Emulator Rules tests
- [x] Security regression suite in CI

## Phase 3 — Quality and CI

- [x] ESLint
- [x] Automated domain tests
- [x] Production build validation
- [x] Single local `check` gate
- [x] GitHub Actions CI gate
- [x] Dependency audit gate
- [x] Browser smoke test
- [ ] Production smoke test

## Phase 4 — Integration and browser validation

- [x] Customer ordering integration coverage (entrypoint smoke baseline)
- [x] Admin authentication smoke coverage (entrypoint smoke baseline)
- [x] Customer responsive/mobile smoke baseline
- [x] Admin responsive smoke baseline
- [ ] Critical error/empty/loading states
- [ ] Browser regression baseline

## Phase 5 — Release verification

- [ ] Production Firebase configuration verified
- [ ] Firebase Rules deployed and verified
- [ ] Functions deployed and verified
- [ ] Admin account provisioned and verified
- [ ] Customer checkout smoke test
- [ ] Admin smoke test
- [ ] Mobile/responsive smoke test
- [x] Monitoring/rollback procedure
- [ ] Release checklist completed
- [ ] Explicit approval to set `acceptingOrders = true`

## Phase 6 — Business and inventory semantics

- [x] Centralized pricing policy
- [x] Delivery charge
- [x] Cost and estimated profit calculations
- [x] Completed-sale accounting rule implemented
- [x] Product-owner approval of completed-sale accounting policy
- [x] Formal payment-status transitions
- [x] Formal order-status transitions
- [x] Decide WhatsApp confirmation vs notification semantics
- [x] Real inventory transactions
- [x] Inventory purchase/consumption history
- [x] Explicit stock adjustments
- [x] Operational reporting period filters

---

# Product Experience Evolution

These phases begin after release/security blockers are under control and may proceed in parallel with lower-risk hardening.

## Phase 7 — Sandwichies Visual System

**Execution:** APPROVED ALL — implementation baseline built.

Goal: establish a recognizable dark-first Sandwichies design language.

- [x] Audit current customer visual hierarchy
- [x] Define color/token system
- [x] Define typography system
- [x] Define spacing/radius/elevation system
- [x] Define product-card language
- [x] Define button/input/control language
- [x] Define food/product visual motifs
- [x] Define light/dark behavior where needed
- [x] Document accessibility contrast rules
- [ ] Create current UI baseline screenshots/evidence

## Phase 8 — Motion + Interaction System

**Execution:** APPROVED ALL — implementation baseline built.

Goal: make Sandwichies feel responsive and alive without becoming distracting.

- [x] Define transition durations/easing
- [x] Define hover/focus/pressed states
- [x] Define product selection feedback
- [x] Define quantity/cart feedback
- [x] Define favorite interaction
- [x] Define modal/navigation transitions
- [x] Define loading/skeleton behavior
- [x] Define success/error feedback
- [x] Add reduced-motion behavior
- [x] Document reusable motion patterns

## Phase 9 — Customer Discovery + Ordering UX

Goal: move the customer experience toward a responsive product catalog while preserving the current trusted domain and ordering flow.

- [x] Audit current landing/catalog experience
- [x] Improve hero/entry experience
- [x] Reuse existing recipe catalog and category metadata
- [x] Add product-name/description search
- [x] Add price filter and sorting by featured, price, and name
- [x] Display recipe ingredients with readable ingredient names
- [x] Keep existing shared price calculation and customization flow
- [ ] Browser-smoke the complete customer journey at desktop and mobile widths
- [ ] Verify product cards against the actual asset set and review visual consistency
- [ ] Validate address search, address confirmation, and delivery coverage
- [ ] Choose a $0-compatible address lookup approach after reviewing provider limits/privacy

## Phase 10 — Phone identity + order readiness

- [ ] Evaluate Firebase Phone Auth against current Firebase configuration and $0 budget
- [ ] Evaluate WhatsApp verification alternatives without introducing unapproved paid services
- [ ] Implement real phone ownership verification before customer checkout
- [ ] Keep customer auth separate from admin custom claims
- [ ] Test OTP abuse/rate limiting, errors, resend, and mobile behavior
- [ ] Verify trusted order creation and inventory idempotency end-to-end
- [ ] Preserve `BUSINESS.acceptingOrders = false` until explicit release approval

Requirements: `app/docs/product/CUSTOMER-STOREFRONT.md`.

## Phase 10 — New Favorites + New Creations

Goal: establish a sustainable product-content system.

- [x] Define product/favorite data model needs
- [x] Define featured/new/popular concepts
- [x] Create first new favorites
- [x] Create first new signature/seasonal creations
- [x] Review pricing/cost implications
- [x] Review inventory implications
- [x] Add discovery UI
- [x] Validate trusted server reconstruction through shared pricing/order model
- [x] Document production vs experimental products

## Phase 11 — Admin/Product Operations UX

**Execution:** APPROVED ALL — implementation baseline built.

Goal: make operations clearer and more efficient without weakening the security model.

- [x] Audit admin information hierarchy
- [x] Improve order status visibility
- [x] Improve payment status visibility
- [x] Improve inventory visibility
- [x] Improve operational feedback
- [x] Improve responsive admin experience
- [x] Add safe operational shortcuts where justified
- [x] Validate admin authorization boundaries

Implementation notes:
- Orders now surface active, confirmation, payment and readiness priorities before the detailed list.
- Order detail exposes explicit payment state and a single safe next-status shortcut while preserving canonical transition checks.
- Inventory highlights low serving capacity and confirms successful/failed movement recording.
- Admin responsive behavior is consolidated through existing mobile breakpoints.
- Authorization remains admin-claim based for reads and callable inventory writes, while Firestore Rules continue to validate order/payment transitions.
- Browser and emulator evidence remains pending because this phase was implemented without executing GitHub Actions or production deployment.

## Phase 12 — Performance + Measurement

Goal: ensure richer UX remains fast and measurable.

- [ ] Measure production bundle
- [ ] Measure critical customer path
- [ ] Review client payload
- [ ] Review image/assets strategy
- [ ] Review render performance
- [ ] Define product UX metrics
- [ ] Define ordering funnel metrics
- [ ] Measure discovery/selection/checkout behavior where instrumentation exists
- [ ] Remove unnecessary complexity

## Phase 13 — Product Expansion

Only after the foundation and release path are stable.

Candidate work:

- richer inventory management
- customer order history
- repeat orders
- recommendations
- business analytics
- reporting/export
- richer operational workflows
- additional product discovery experiences

---

## Priority order

1. Security regression validation
2. CI/dependency quality gates
3. Integration/browser validation
4. Production/release verification
5. Business and inventory semantics
6. Visual system
7. Motion/interaction system
8. Customer discovery and ordering UX
9. New favorites and creations
10. Admin/product operations UX
11. Performance and measurement
12. Product expansion

A future feature must not silently outrank an unresolved security or production blocker.

## Master product loop

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


## Documentation checkpoint — 2026-10-18

- Operational safety: `acceptingOrders = false`; checkout stays disabled until explicit release approval.
- Spreadsheet-defined recipes, quantities and current unit purchase costs remain the business source of truth.
- Fases A–D have implementation commits on main, but implementation is not equivalent to release validation.
- Remaining gates include dependency audit, lint, domain tests, Firestore Emulator rules tests, production build and browser review. Re-check the latest phase audit and CI before marking anything validated.
- Preserve separation between customer-facing product experience and admin operational permissions.
