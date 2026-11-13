# Sandwichies: local Worker and emulator workflow

The local browser, Worker, Authentication and Firestore all use loopback services. Use synthetic accounts and demo data only. The order gates remain disabled.

## Local request path

```text
Browser: Vite http://127.0.0.1:5182
  ├─ Firebase Auth SDK → Auth Emulator :9099
  ├─ Firestore Web SDK → Firestore Emulator :8080
  └─ Worker API → Wrangler :8787
       ├─ verifies emulator ID tokens through loopback Auth Emulator :9099
       └─ reads/writes Firestore Emulator :8080
```

`LOCAL_DEV=true` is only in the ignored local Worker variables. The local verifier requires an Auth Emulator loopback host, validates token project/time claims, then asks that emulator to validate the token and confirms its UID/email verification state. Production Wrangler config does not set `LOCAL_DEV`; production uses Firebase public-key verification. Do not use local emulator variables in a production build.

## Start services (PowerShell, from `app/`)

Run the preflight first; it creates ignored local config only when absent and never overwrites it:

```powershell
npm run local:preflight
```

Start the emulator suite (Auth and Firestore) in one terminal. It is ephemeral; do not enable import/export for this test workflow:

```powershell
npm run emulator:local
```

Start the Worker and Vite in separate terminals:

```powershell
npm run worker:dev
npm run dev -- --host 127.0.0.1 --port 5182
```

Open `http://127.0.0.1:5182`. The Firebase Emulator UI is at `http://127.0.0.1:4000`. Use synthetic test accounts created in the Auth Emulator. Email verification codes are available in the Emulator UI; no real email or customer communication is sent.

Check `http://127.0.0.1:8787/health`: it must return `status: ok` and `ordersEnabled: false`. Local CORS must allow the exact Vite origin. Never print `.env.local` or `worker/.dev.vars`; both can contain local credentials and are ignored by Git.

## Local verification boundaries

- Customer cart and profile requests are exercised against Firestore Emulator.
- The Auth Emulator and Worker are local only; local emulator tokens are not production tokens.
- Do not exercise Cupboard routes unless the endpoint is explicitly isolated to demo services. The Worker may have local Cupboard credentials configured.
- Do not submit orders. `BUSINESS.acceptingOrders=false` and `ORDERS_ENABLED=false` are intentional.
- Do not run deploy commands or production migrations from this workflow.

## Production configuration (reference only)

A production release requires separate approval, exact CORS origins, verified project-specific service identities and IAM, independent Sandwichies/Cupboard credentials, confirmed Cupboard mappings, and a tested reconciliation plan. Keep `ORDERS_ENABLED=false` until those gates and the release checklist are approved. This guide does not deploy anything.
