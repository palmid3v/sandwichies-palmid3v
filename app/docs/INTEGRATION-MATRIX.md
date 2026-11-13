# Integration matrix — 2026-11-12

| Component | Expected behavior | Actual behavior | Status | Evidence / limit |
|---|---|---|---|---|
| Frontend routes | Load storefront, profile, admin and fallback | `/`, `/perfil`, `/admin` rendered in Chromium; signed-in non-admin was restricted at admin route | PARTIALLY WORKING | Browser QA report; authorized admin dashboard loaded, admin CRUD and all error/loading permutations not exercised |
| Authentication | Verified customer login and persistent session | Synthetic Email/Password account was created, email-verified and signed in using Auth Emulator; Worker `/v1/session` accepted the local token | WORKING (local) | Browser auth flow and Worker tests; no production credentials or auth project tested |
| Authorization | Enforce user ownership and admin role | Customer profile/cart reads were scoped to verified identity; customer without admin claim received restricted page; Rules tests passed | PARTIALLY WORKING | 12 Firestore Rules tests; synthetic admin dashboard claim was verified locally, production IAM remains unverified |
| Firestore | Persist app data and enforce browser rules | Cart and profile were read/written through local Worker to Firestore Emulator; direct access restrictions covered by Rules tests | WORKING (local) | Browser Worker 200 responses and emulator integration; production Firestore not tested |
| Cloudflare Worker | Validate CORS/auth, expose API and fail safely | Wrangler local health 200 with orders disabled; local CORS preflight 204; unauthenticated customer API returned 401 | WORKING (local) | Local browser/network evidence and 87 passing Worker tests; deployed Worker not verified |
| Catalog | Display searchable/filterable current products | Eight products rendered; “Serrano” search and “Nuevos” filter worked | WORKING (read-only) | Browser verified; creation/edit/availability controls in admin not verified |
| Cart | Persist user-owned cart with conflict/idempotency handling | Quantity increment updated total; cart saved through Worker, survived reload; tests cover stale revisions, replay and recovery | WORKING (local) | Browser round-trip plus Worker suite; competing browser sessions/network interruption not exercised manually |
| Checkout | Validate and create trusted order, deduplicate retries | Checkout was visibly disabled with “Pedidos cerrados”; Worker tests verify closed flags block creation | PARTIALLY WORKING (release-gated) | No browser order submission, Firestore order write or order lifecycle was attempted |
| Admin | Permit admins to manage business; deny other users | Non-admin denial verified; synthetic admin claim loaded dashboard and empty emulator order queue, but Worker-backed operations were not verified | PARTIALLY WORKING | 87 Worker tests cover privileged/non-admin domain paths; Cupboard calls were blocked by stopping Wrangler during UI review |
| Firebase Functions | Run callable/triggers for legacy operations | Functions + Firestore emulator integration passed 7 tests; test emulator initialized callable and trigger endpoints | WORKING (emulator-tested) | No Functions deployment or production endpoint verification |
| Firestore Rules | Deny unauthorized direct reads/writes | Rules emulator suite passed 12 tests, including customer data and privileged collections | WORKING (emulator-tested) | Rules were not deployed or changed in production |
| Cupboard inventory | Read and update mapped stock idempotently | Unit/integration suites exercise demo transaction, duplicate and reversal cases; real Cupboard credentials/contract and inventory were not accessed | BLOCKED BY EXTERNAL DEPENDENCY | No live or real inventory mutation; mappings, IAM and demo-project credentials require owner verification |
| Mobile | Keep customer/admin routes usable at phone width | Storefront, profile, admin denial and synthetic admin dashboard rendered at 390×844 without horizontal overflow | PARTIALLY WORKING | Tablet/desktop browser sizes also checked; complete purchase path is blocked by closed checkout; admin mobile CRUD not tested |
| External fonts | Load selected typefaces | Google Fonts CSS and font files returned HTTP 200 in the browser session | WORKING (external request) | Availability depends on network/provider; fallback remains necessary |
| DayFlow / Financial-D3v | Send approved cross-product events | No active production integration verified | NOT IMPLEMENTED | Roadmap contracts only |

## Local configuration

The ignored `app/worker/.dev.vars` holds local Worker settings and may contain credentials. It was not printed, copied to documentation or committed. The example template contains loopback emulator settings and keeps `ORDERS_ENABLED=false`. Vite development now connects Auth and Firestore SDKs to local emulators.

## External dependency status

Production Firebase projects, service-account IAM, deployed Worker bindings, Cupboard account/mapping, payment service and operational release approval remain outside local verification. No production endpoint, order, customer communication or inventory mutation was used.
