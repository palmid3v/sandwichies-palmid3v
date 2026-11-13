# Sandwichies architecture

## Runtime map

```text
React/Vite storefront and admin
  ├─ Firebase Auth (Email/Password; local Auth Emulator in Vite development)
  ├─ Firestore Web SDK (local Firestore Emulator in Vite development)
  └─ Cloudflare Worker API (local Wrangler in development)
       ├─ Firebase ID-token verification and role checks
       ├─ shared catalog, pricing, order and delivery domain
       ├─ Firestore REST (local emulator in development; remote service in deployment)
       └─ Cupboard adapter (external inventory project; credentials required)

Firebase Functions: retained legacy callable/admin functions and emulator tests.
Firestore Rules: browser access control; Worker service-account access bypasses Rules.
```

## Application entry points

- `src/main.jsx` initializes React and `src/AppRoutes.jsx` resolves `/`, `/perfil`, `/admin`, and the not-found route.
- `src/pages/OrderPage.jsx` owns storefront discovery, cart, fulfillment and closed checkout presentation.
- `src/pages/CustomerAuth.jsx` and `src/pages/CustomerProfile.jsx` handle verified customer accounts and profile data.
- `src/App.jsx` and its components provide the role-gated administration interface.
- `worker/src/index.js` is the Worker HTTP router; modules under `worker/src/` implement auth, cart, profiles, orders, delivery, virtual tables and Cupboard calls.
- `functions/index.js` contains Firebase callable functions. Its existence does not mean it is deployed or currently used by the active storefront order path.

## Trust boundaries

- The browser may display catalog prices and a cart preview; the Worker validates catalog selections and derives trusted order values.
- Customer API calls require a verified Firebase identity. Admin API calls additionally require the `admin` custom claim.
- Firestore Rules deny direct customer cart/profile and privileged business writes; the Worker uses project service credentials and therefore bypasses Rules.
- Cupboard is the stock authority. The Worker integration is a cross-project saga, not a distributed transaction; idempotency and reconciliation are required.
- Vite development points Auth and Firestore SDKs to local emulators. Only `LOCAL_DEV=true` selects the Worker Auth Emulator verifier, and that verifier requires a loopback host and confirms tokens with the local emulator.

## Release state

`BUSINESS.acceptingOrders=false` and Wrangler `ORDERS_ENABLED=false` remain release protections. The storefront disables order intake. No production deployment or live inventory operation is part of local verification. Production service credentials, IAM review, Cupboard reconciliation, and release approval remain external gates.
