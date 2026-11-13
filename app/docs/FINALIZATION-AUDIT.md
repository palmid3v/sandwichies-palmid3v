# Finalization audit — 2026-11-12

## Executive summary

**Status: PARTIALLY ACHIEVED — 67.5% verified.** Local verification improved customer identity, cart persistence, profile access, browser responsiveness and Worker/Auth Emulator coverage. Order intake remains intentionally closed. Production deployment, live Cupboard inventory and authorized admin workflows remain unverified.

The score uses the requested domain weights and only the 25%, 50%, 75% and 100% evidence levels. A domain does not receive full credit for source-code presence alone.

| Domain | Weight | Evidence level | Weighted score | Basis |
|---|---:|---:|---:|---|
| Frontend and UX | 10% | 75% | 7.5% | Storefront, search, category filter, profile, admin denial and route behavior inspected in browser; order submission remains unavailable. |
| Authentication and authorization | 10% | 75% | 7.5% | Synthetic verified Email/Password account used with local Auth Emulator; Worker session verified; non-admin denied `/admin`. Synthetic admin claim loaded the dashboard, but admin API operations were not tested. |
| Catalog and product management | 10% | 75% | 7.5% | Eight products rendered; search and category filter worked. Admin CRUD was not verified. |
| Cart and persistence | 10% | 100% | 10% | Browser changed quantity, saved through Worker to Firestore Emulator, reloaded and restored the same cart/revision state. |
| Checkout and order lifecycle | 15% | 25% | 3.75% | UI and Worker preserve closed gates; checkout control is disabled. No order was created. End-to-end order persistence/lifecycle is not verified. |
| Backend and Cloudflare | 10% | 75% | 7.5% | Local Worker health, CORS, authenticated cart/profile paths and Worker test suite verified. Cloudflare deployment is not verified. |
| Firebase and Firestore | 10% | 75% | 7.5% | Auth and Firestore emulators used; profile/cart read-write round-trips succeeded; 12 Rules tests passed. Production Firebase behavior is not verified. |
| Admin and business operations | 10% | 50% | 5% | Non-admin was denied; synthetic admin loaded the dashboard and empty emulator queue, but admin API operations were not exercised. |
| Mobile and responsive | 5% | 75% | 3.75% | 390×844 storefront/profile/admin denial and authorized dashboard checked without horizontal overflow; tablet and desktop routes were inspected in the browser. Complete mobile purchase journey cannot complete with checkout closed. |
| Security, reliability and documentation | 10% | 75% | 7.5% | Rules and integration suites passed; six moderate production dependency advisories remain; release and production IAM gates remain open. |
| **Total** | **100%** |  | **67.5%** |  |

## Verified behavior

- Local Email/Password Auth Emulator sign-up, email verification, sign-in and Worker session validation used a synthetic account. The emulator was stopped without export; this account is ephemeral and was not a real customer.
- Storefront rendered eight catalog products. Search for “Serrano” returned the matching product; combining it with “Nuevos” narrowed to one result.
- An authenticated cart quantity changed from one to two, the total updated, and a page reload restored the two-unit cart with “Carrito guardado en tu cuenta.” Worker logs and emulator API responses confirmed successful local persistence.
- `/perfil` loaded the synthetic user profile; profile save returned success through the Worker. Customer profile and address list reads returned HTTP 200.
- A signed-in non-admin visiting `/admin` saw “Esta cuenta no tiene el rol de administración requerido.”
- `/health` returned HTTP 200 with order intake disabled. Local CORS preflight returned 204; unauthenticated cart requests were rejected with 401.
- Browser widths checked: 1440×900, 768×1024 and 390×844. At 390 px, storefront and profile had no horizontal overflow.
- Full `npm run check` passed: lint, 87 Worker tests, 43 domain tests, 12 Firestore Rules tests, 7 Functions/Firestore integration tests, build, bundle budget and smoke.

## Defects corrected

- Local Worker had rejected the local Vite origin during CORS preflight because its local allowlist was not configured. The ignored local `.dev.vars` now allows only the two loopback Vite origins; this is not a production setting.
- The development browser was still targeting remote Firebase Auth. Vite now connects Auth to the local Auth Emulator; the Worker local verifier only accepts a loopback emulator host and confirms the token with that emulator.
- Customer auth and checkout fields lacked IDs/names. Profile, menu filter, contact and note controls now include stable identifiers; profile controls also carry autocomplete hints.
- Local preflight and architecture documentation incorrectly described remote Auth. They now match the emulator setup.
- One newly added Worker test lacked its Node `Buffer` import; corrected after lint caught it.

## Remaining issues and blockers

- Checkout is deliberately closed by `BUSINESS.acceptingOrders=false` and Wrangler `ORDERS_ENABLED=false`. No checkout POST or order creation was attempted in the browser.
- Authorized admin catalog mutations, business settings and order operations remain unverified; dashboard entry was verified with a synthetic claim.
- Cupboard credentials/contract and real inventory ownership could not be safely validated locally; no Cupboard mutation was attempted.
- The production Worker hostname, production Firebase IAM/rules and Cloudflare bindings were not validated or deployed.
- `npm audit --omit=dev` reports six moderate advisories in the `glob`/`minimatch` dependency chain. No forced major upgrade was applied.
- Functions emulator warned that the repository targets Node 22 while the host runs Node 24. Integration tests passed, but verification on Node 22 remains advisable.
- Firebase metadata lookup emitted DNS/ETIMEDOUT warnings during emulated Functions tests; the seven integration assertions still passed.
- After the profile metadata fix, DOM inspection found zero controls missing `id`, `name` or `autocomplete`. Chrome retained the console issue recorded before the hot update; a clean console after full navigation was not rechecked.

## Release assessment

**Not production ready.** The local build and checks pass, but the order lifecycle is gated, production service identities and IAM require review, Cupboard reconciliation is unverified, six moderate dependency advisories remain, and no release approval exists. Keep all release flags false.

See [integration matrix](INTEGRATION-MATRIX.md), [browser QA](BROWSER-QA-REPORT.md), and [release checklist](RELEASE-CHECKLIST.md).
