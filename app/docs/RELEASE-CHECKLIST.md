# Release checklist — 2026-11-12

## Current decision

**NO-GO for production.** The locally verified score is 67.5%. Keep `BUSINESS.acceptingOrders=false` and `ORDERS_ENABLED=false`. Do not deploy Workers, Firebase Functions or Firestore Rules as part of this audit. The historic checklist remains at `docs/deployment/RELEASE-CHECKLIST.md`; this file records current evidence and the open gates.

## Verified locally

- [x] `npm ci` completed from the committed lockfile.
- [x] `npm run check`: lint, 87 Worker tests, 43 domain tests, 12 Firestore Rules tests, 7 Functions/Firestore integration tests, build, bundle budget and smoke passed.
- [x] Production audit gate passed at its configured high-severity threshold; six moderate advisories remain documented.
- [x] Browser storefront/profile/admin-denial review at phone, tablet and desktop viewports.
- [x] Local Auth and Firestore emulators used for synthetic user and cart/profile tests.
- [x] Worker health and local CORS behavior verified; checkout gate remained closed.
- [x] Browser-to-Worker-to-Firestore Emulator cart and profile persistence verified.

## Required before any production release

- [ ] Review and remediate six moderate production dependency advisories, with package-level impact analysis and regression checks.
- [ ] Run the check suite on the project-required Node 22 runtime; current host uses Node 24 and Functions emulator warns about the mismatch.
- [ ] Verify deployed Worker hostname, bindings, CORS origins, rate limits, observability and fail-safe behavior in an approved non-production environment.
- [ ] Verify production Firebase project IDs, Auth provider settings, Firestore indexes, Rules, IAM and service identities without exposing credentials.
- [ ] Verify one dedicated Sandwichies identity and one dedicated Cupboard identity, project separation, least available IAM and credential rotation plan.
- [ ] Confirm Cupboard household, SKU mapping, inventory ownership and saga reconciliation using an isolated demo project only.
- [ ] Exercise authorized admin catalog, settings, inventory and order workflows with synthetic accounts in a non-production environment.
- [ ] Complete checkout, order idempotency, timeout reconciliation, transition, cancellation and inventory reversal in an isolated demo environment.
- [ ] Resolve release-specific accessibility and responsive findings; capture and retain approved browser screenshots/traces.
- [ ] Review privacy, retention, customer-data handling, external communication and payment-provider requirements.
- [ ] Obtain explicit owner approval for deployment and any change to order-intake flags.

## Prohibited within this audit

- No enabling either order-intake flag.
- No production deploy, migration, Firestore Rules change or real customer order.
- No real inventory change, payment credential or paid cloud resource.
- No real customer communication.

The completion score and evidence are maintained in `FINALIZATION-AUDIT.md`; route and integration evidence is in `BROWSER-QA-REPORT.md` and `INTEGRATION-MATRIX.md`.
