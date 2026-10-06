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

## Evidence rule

Never report Emulator, browser smoke, audit, or release checks as passing unless the command was actually executed in the target environment.
