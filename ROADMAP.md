# ROADMAP — Sandwichies

**Current release line:** MVP hardening  
**Operational state:** `acceptingOrders = false`  
**Status:** Active development; not yet release-approved.

## North star

Operate a trustworthy sandwich ordering system in which customers can configure and submit sandwiches reliably, prices and costs come from one domain source, order numbers and financial values are server-owned, administrators can operate orders safely, and inventory/metrics remain honest about their data quality.

## Phase 0 — Foundation

- [x] Root README
- [x] Root CONTEXT
- [x] Root STEPBYSTEP
- [x] Root ROADMAP
- [x] Historical documentation preserved
- [x] Repository placement rules
- [x] Current architecture identified
- [x] Data Connect classified as non-production/experimental

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
- [ ] Firebase Emulator Rules tests
- [ ] Security regression suite in CI

## Phase 3 — Quality and CI

- [x] ESLint
- [x] Automated domain tests
- [x] Production build validation
- [x] Single local `check` gate
- [x] GitHub Actions CI gate
- [ ] Dependency audit gate
- [ ] Browser smoke test
- [ ] Production smoke test

## Phase 4 — Operations

- [x] Orders history
- [x] Order details
- [x] Dashboard
- [x] Inventory capacity estimation
- [x] Live order synchronization
- [x] New-order notification
- [ ] Real inventory transactions
- [ ] Inventory purchase/consumption history
- [ ] Explicit stock adjustments
- [ ] Operational reporting period filters

## Phase 5 — Business semantics

- [x] Centralized pricing policy
- [x] Delivery charge
- [x] Cost and estimated profit calculations
- [x] Completed-sale accounting rule implemented
- [ ] Product-owner approval of completed-sale accounting policy
- [ ] Formal payment-status transitions
- [ ] Formal order-status transitions
- [ ] Decide WhatsApp confirmation vs notification semantics

## Phase 6 — Release readiness

- [ ] Production Firebase configuration verified
- [ ] Firebase Rules deployed and verified
- [ ] Functions deployed and verified
- [ ] Admin account provisioned and verified
- [ ] Customer checkout smoke test
- [ ] Admin smoke test
- [ ] Mobile/responsive smoke test
- [ ] Monitoring/rollback procedure
- [ ] Release checklist completed
- [ ] Explicit approval to set `acceptingOrders = true`

## Phase 7 — Performance and maintainability

- [ ] Measure production bundle
- [ ] Remove unnecessary client payload
- [ ] Review `src/src.7z`
- [ ] Confirm public assets
- [ ] Review component boundaries after MVP stabilization
- [ ] Keep business logic centralized in `shared/`

## Phase 8 — Future product growth

Only start after MVP hardening and release approval.

Candidate work:
- richer inventory management
- customer order history
- repeat orders
- business analytics
- recommended sandwiches
- reporting/export
- richer operational workflows

## Priority order

1. Security regression validation
2. CI/dependency quality gates
3. Production smoke validation
4. Release readiness
5. Inventory semantics
6. Business semantics
7. Performance
8. New product features

A future feature must not outrank an unresolved release/security blocker without explicit approval.
