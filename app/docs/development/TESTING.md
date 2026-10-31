# SECURITY TESTING — Sandwichies

## Phase 2–4 security and integration baseline

The project treats the browser as untrusted. Firestore order writes remain server-owned through the callable `createOrder` function.

### Emulator rules test

Run from `app/`:

```bash
npm run security:test
```

The command starts the Firebase Emulator Suite with Firestore rules and executes the Node security regression suite.

The regression suite verifies that:
- unauthenticated clients cannot read orders;
- authenticated non-admin clients cannot read or update orders;
- admin clients can read and update orders;
- browser clients cannot create or delete orders directly;
- browser clients cannot read or write `counters/orders`;
- the catch-all rule denies unspecified collections.

### Local validation

```bash
npm run check
```

`npm test` executes domain/unit tests only. `npm run security:test` starts the
Firestore Emulator and runs the Rules suite separately, so a missing emulator
cannot be mistaken for a passing unit test.

### Entrypoint smoke

The dependency-light entrypoint smoke validates that the customer and admin
routes are served by a production build and expose the React root marker. When
no `SMOKE_BASE_URL` is supplied, it starts and stops a local Vite preview
server itself. It does not execute browser JavaScript or submit production
orders; browser validation remains a separate recorded check.

For customer/admin UX changes, inspect the customer at 320, 390 and 430 CSS px and at desktop width. Verify category/search, advanced filters, recipe ingredient disclosure/search, empty and populated cart, fixed cart navigation and checkout-disabled state. In admin, verify access restriction, synchronized/empty/error states, order contact/fulfillment, pending-payment attention and next transition with emulator/test data only. Do not submit an order to the configured production Firebase project.

```bash
npm run smoke
```

For release validation, set `SMOKE_BASE_URL` to the target URL only after the
explicit release gate authorizes a production check.

### Dependency audit

```bash
npm run audit
```

CI treats high and critical dependency vulnerabilities as failures.

Local gate evidence (2026-10-30): 6 moderate transitive findings were reported
(`glob`, `minimatch`); no high or critical findings blocked the audit. The
`expireVirtualTables` scheduled function was skipped because Pub/Sub Emulator
was not running. This does not validate scheduled expiration behavior.

## Evidence rule

Never report Emulator, browser smoke, audit, or release checks as passing unless the command was actually executed in the target environment.
