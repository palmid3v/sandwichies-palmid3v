# SECURITY TESTING — Sandwichies

## Phase 2–4 security and integration baseline

The project treats the browser as untrusted. Firestore order writes remain server-owned through the callable `createOrder` function.

### Emulator rules test

Run from `app/`:

```bash
npm run emulators:test
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
npm run lint
npm test
npm run security:test
npm run build
```

### Browser smoke

The browser smoke script is intentionally dependency-light and checks the deployed customer/admin entrypoints for availability and stable application boot markers. It does not submit production orders.

```bash
npm run smoke
```

For production validation, set `SMOKE_BASE_URL` to the target URL.

### Dependency audit

```bash
npm run audit
```

CI treats high and critical dependency vulnerabilities as failures.

## Evidence rule

Never report Emulator, browser smoke, audit, or release checks as passing unless the command was actually executed in the target environment.
