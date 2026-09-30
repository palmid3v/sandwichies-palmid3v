# TASK-SANDWICHES-002 — Consolidation, Documentation & Visual Redesign Report

**Date:** 2026-09-29  
**Scope:** local implementation only. No deployment, production Firebase change, custom-claim assignment, commit or push was performed.

## 1. TASK STATUS

`COMPLETED WITH PENDING ITEMS`

## 2. EXECUTIVE SUMMARY

The project was consolidated around the shared domain added in TASK-001, unused starter code was removed safely, documentation now has a navigable professional structure, and the customer/admin interfaces were redesigned around a tropical food identity inspired by the approved reference. The trusted order architecture and domain calculations were preserved.

## 3. ARCHITECTURE CHANGES

The final responsibilities are documented in `docs/architecture/ARCHITECTURE.md`:

```text
src/       React UI and intentional UI adapters
shared/    authoritative catalog, business configuration, pricing and request validation
functions/ trusted Firebase callable order boundary
test/      deterministic domain/request tests
docs/      product, architecture, development, deployment, audit and task evidence
```

`src/utils/pricing.js` was simplified into a pure UI export boundary; the legacy duplicate formula wrappers were removed. React uses `calculateLineItem` for previews, while the Cloud Function recalculates persisted financial data.

## 4. CLEANUP

File: `src/App.css`  
Action: Removed.  
Reason: unused Vite starter stylesheet.

File: `src/assets/react.svg` and `src/assets/vite.svg`  
Action: Removed.  
Reason: unused Vite starter assets.

File: `src/utils/whatsapp.js`  
Action: Removed.  
Reason: unreferenced legacy formatter; the active flow uses the trusted order result in `OrderPage.jsx`.

File: `src/assets/hero.png`  
Action: Retained and used.  
Reason: existing product asset now powers the customer hero.

File: `src/src.7z`  
Action: Retained as historical.  
Reason: it is unreferenced but has not been approved for removal.

File: public assets and `docs/v0.1/`  
Action: Retained.  
Reason: public assets lack sufficient removal evidence; v0.1 preserves project/audit history.

The complete asset/cleanup record is in `docs/development/CLEANUP.md`.

## 5. DOCUMENTATION

Created:

- `docs/README.md`
- `docs/product/PRODUCT-OVERVIEW.md`
- `docs/product/USER-FLOWS.md`
- `docs/product/BUSINESS-RULES.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/PRICING-AND-COSTS.md`
- `docs/architecture/SECURITY.md`
- `docs/development/CODE-STRUCTURE.md`
- `docs/development/CLEANUP.md`
- `docs/development/TESTING.md`
- `docs/deployment/DEPLOYMENT.md`
- `docs/deployment/RELEASE-CHECKLIST.md`
- `docs/tasks/README.md`
- `docs/audits/README.md`
- this report

Updated:

- Root `README.md` now explains purpose, status, installation, commands, architecture, Firebase roles, release guardrails and documentation.

Moved: none. Historical `docs/v0.1` documentation was deliberately retained and indexed instead of moved, preserving original references and traceability.

Removed: no documentation was removed.

The structure supports SENA productive-project evidence without inventing forms or approvals: it separates product context, business rules, implementation, testing, security, release, audit and task traceability.

## 6. VISUAL REDESIGN

### Palette and typography

Introduced reusable CSS tokens for deep leafy green, tropical green, lime, mango, papaya, coral and cream. The system uses a high-contrast dark-green/cream base with warm action colors rather than generic blue/gray SaaS styling.

### Customer UI

The customer UI now has an illustrated sandwich hero, clear “build yours” entry point, warm rounded cards, a recommended-sandwich placeholder marked as coming soon, stronger price/cart hierarchy, food-oriented selection states, and visible protein quantity controls (one to three portions). It continues to use the shared configuration model and does not add fictional recipes/prices.

### Admin UI

The existing admin functions received the same cream/tropical surfaces, rounded operational cards, responsive controls, status treatments and modal presentation. This is visual-only: no authorization or calculation logic was weakened.

### Responsive, motion and accessibility

Desktop, tablet and mobile breakpoints were updated for hero, builder, cart and admin layouts. Motion uses short CSS transitions/entrances for cards, choices, cart, toast, modal and meters. Both style systems include `prefers-reduced-motion` fallbacks. Keyboard focus uses a visible coral outline; semantic controls/labels remain intact. No AI-themed visual language was introduced.

## 7. COST/BUSINESS LOGIC

Pricing, costs, quantities, delivery and consumption remain centralized in `shared/catalog.js`, `shared/business.js`, `shared/pricing.js` and `shared/order-request.js`. The new protein quantity controls modify the same normalized configuration that computes preview, server price and inventory usage. No monetary formula was added to React.

## 8. TESTS

Actual local validation:

```text
npm run lint
  -> PASS

npm test
  -> PASS (9/9)

npm run build
  -> PASS
  -> Bundle warning remains: 614.77 kB JS / 190.17 kB gzip

npm audit --omit=dev
  -> REVIEWED: 11 vulnerabilities (1 critical, 1 high, 9 moderate)
```

Emulator tests were not run: no Emulator Suite configuration was added or claimed.

## 9. PENDING ITEMS

PENDING: Firebase Emulator coverage.  
Reason: the repository still has no Emulator Suite foundation for rules, claims, callable endpoint or transactional counter.  
Required next step: add emulator configuration and tests before release.

PENDING: Firebase release and administrative custom claims.  
Reason: the task forbids production deployment, rule publication and claim assignment.  
Required next step: approved non-production rollout, secure claim provisioning and smoke tests.

PENDING: Dependency remediation.  
Reason: audit reports 11 production findings; available Firebase Admin/Functions fixes require major-version review.  
Required next step: dedicated compatibility upgrade without `npm audit fix --force`.

PENDING: Sales-recognition policy.  
Reason: the code explicitly uses `entregado + pagado`, but product must approve this accounting definition.  
Required next step: Nexsy/product confirmation or revised documented rule.

PENDING: WhatsApp confirmation semantics.  
Reason: an order persists before WhatsApp opens, while message sending/receipt is not observable.  
Required next step: approve the operational policy for unsent/closed WhatsApp flows.

PENDING: `src/src.7z` and uncertain public assets.  
Reason: preserved as historical/unverified rather than deleted by filename.  
Required next step: owner decision on retention/removal.

PENDING: Complete documentation target.  
Reason: current docs cover implemented architecture, cost, security, development and release; standalone data-model/Firebase/rollback documents should be expanded only when their actual environment details are supplied.  
Required next step: document those details after emulator/environment decisions.

## 10. GIT STATUS

- Changed files: implementation from TASK-001 plus README, visual styles, customer components, documentation and cleanup listed above.
- Staged files: none.
- Unstaged files: all changes.
- Untracked files: `docs/` additions, `functions/` and `shared/` additions from TASK-001.
- Commits: none.
- Push: none.

**NO COMMIT**  
**NO PUSH**

## ADMIN ACCESS VERIFICATION

```text
Admin claim name: admin (boolean custom claim, expected value true)
Existing admin account: PENDING — no account email/identity or authorized Firebase Admin credentials were provided.
Claim provisioning: Implemented as npm run provision:admin. It finds an existing Firebase Auth user by ADMIN_EMAIL and assigns/revokes the claim without creating an account.
Frontend guard: Verified by source inspection. App.jsx obtains getIdTokenResult() and allows /admin only when claims.admin === true.
Cloud Function authorization: createOrder is intentionally a public customer callable endpoint; it never grants administrative access. It uses Admin SDK only to write reconstructed orders.
Firestore authorization: Verified by source inspection. firestore.rules permits order read/update only when request.auth.token.admin == true and blocks client counter access.
Admin panel access: PENDING — not verified because the existing account could not be provisioned or authenticated in the authorized Firebase environment.
Non-admin rejection: Verified by source inspection in the frontend/rules; not verified against Emulator or a live project.
Password-reset behavior: Documented. Firebase password changes do not remove custom claims; a claim change requires a refreshed ID token/sign-in.
Documentation updated: docs/architecture/SECURITY.md and docs/architecture/FIREBASE.md.
```

PENDING: Provision and test the existing administrator account.  
Reason: neither an existing administrator identity nor Firebase Admin credentials for the correct environment are available in this workspace.  
Required manual action: an authorized operator must set `ADMIN_EMAIL` to the existing admin's Firebase Auth email, provide their approved Firebase Admin application credentials, run `npm run provision:admin`, then sign in again and verify `/admin`, orders, dashboard and inventory.
