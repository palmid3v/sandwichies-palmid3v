# Browser QA report — 2026-11-12

## Method

Used the available Chrome DevTools browser automation against the running local Vite app (`127.0.0.1:5182`), Wrangler Worker (`127.0.0.1:8787`) and Firebase Auth/Firestore emulators. The customer account and contact values were synthetic. No production order or inventory endpoint was used.

## Routes checked

| Route | Result | Notes |
|---|---|---|
| `/` | PARTIAL PASS | Storefront rendered eight catalog items, search, category filters, ingredients, prices, cart and customer details. Checkout remained disabled as configured. |
| `/perfil` | PASS (local) | Synthetic verified account profile and address form loaded. Profile save completed and displayed “Perfil guardado.”; Worker profile/addresses GET and profile POST returned 200. |
| `/admin` | PASS (authorization) | A signed-in customer without admin claim saw “Esta cuenta no tiene el rol de administración requerido.” A synthetic local `admin:true` account then loaded the authorized dashboard and empty emulator order queue; the Worker was stopped to prevent Cupboard reads, so admin API operations were not verified. |
| Unknown path | PASS | `/not-a-route` rendered the expected “Esta dirección no existe” fallback with a return-to-store link. |

## Customer journey evidence

- Initial storefront load returned HTTP 200; application modules, CSS and Google Fonts loaded successfully in the captured session. No application console errors were observed while the emulators were running. React DevTools emitted its normal development notice.
- Search for “Serrano” returned the Serrano Verde product. Selecting “Nuevos” narrowed the combined result to one item.
- Synthetic customer signed in through Auth Emulator. The cart displayed “Carrito guardado en tu cuenta.”
- Incrementing Turkey Finas Hierbas quantity from 1 to 2 updated the total from COP 13,900 to COP 27,800. Reload restored the two-unit cart. Worker logs and local Firestore emulator transport confirmed successful save/read.
- Checkout button was disabled and labeled “Pedidos cerrados.” No order submission was attempted.
- Profile GETs and profile POST used the local Worker and returned 200. Auth Emulator account lookup/token refresh calls returned 200.

## Responsive checks

| Viewport | Routes / surfaces | Result |
|---|---|---|
| 390×844 phone | Storefront, profile, admin denial and authorized dashboard | No horizontal overflow; menu, cart, profile form, restricted message and authorized dashboard fit viewport. |
| 768×1024 tablet | Storefront and auth/admin surfaces | Rendered without observed horizontal overflow in prior browser pass. |
| 1440×900 desktop | Storefront, customer auth and admin surfaces | Rendered without observed horizontal overflow in prior browser pass. |

The mobile storefront screenshot was captured in the browser session. The browser tool denied saving it into the workspace, so no PNG artifact or trace is included in the repository. The screenshot was inspected inline. No persistent trace was captured.

## Defects found and response

| Route | Reproduction | Expected | Actual | Severity | Resolution / evidence |
|---|---|---|---|---|---|
| `/` local API | Load storefront from Vite and call local Worker | Local browser origin receives CORS response | Worker preflight rejected local origin until ignored local `.dev.vars` allowlist included loopback Vite origins | P1 local QA blocker | Fixed local ignored config only. Recheck returned HTTP 204; production allowlist unchanged. |
| `/`, `/perfil`, `/admin` forms | Inspect form controls in browser | Inputs have stable `id`/`name`; relevant profile fields have autocomplete | Chrome reported missing form metadata (storefront count 7; profile count 12 before corrections) | P2 accessibility | Added IDs/names to controls; profile controls also receive autocomplete tokens. Latest DOM inspection found zero inputs/selects/textareas missing both `id` and `name`, and zero without an autocomplete attribute on profile. Existing console warning records pre-fix may remain in browser history. |
| `/admin` | Visit as a customer account without admin claim | Access denied | Access restricted as expected | No defect | Browser confirmed denial message. |

## Console and network

- Storefront after fix: no application errors; Vite connection and React DevTools informational notice only.
- Profile: no JavaScript exception; Chrome initially reported missing autocomplete metadata, then controls were updated. DOM inspection after update found no missing `id`/`name` or `autocomplete` attributes. The prior browser console issue entry predates the change.
- Worker requests observed: local health 200, local CORS preflight 204, missing-token request 401, customer cart/profile/addresses reads 200, customer cart/profile writes 200.
- No failed application HTTP requests were observed in the exercised flows. Firebase metadata DNS/timeout warnings occurred in separate Functions emulator integration logs; integration tests still passed.
- For authorized-admin UI verification, Wrangler was intentionally stopped so Cupboard calls could not reach the local credential configuration; the dashboard showed its Worker connection error while Firestore Emulator showed an empty order queue. No inventory data was requested.
- After intentionally stopping the local emulators, a later browser reload with a cached customer session displayed Firebase `auth/network-request-failed` and two refused local Auth requests. This was caused by the emulator being stopped; it was not observed during the successful Auth/Worker/Firestore browser run.

## Not tested

- Order creation, duplicate browser submissions, payment or recovery after checkout timeout (blocked intentionally by release gates).
- Parallel browser sessions/cart conflicts through UI, product detail customization flow, authorized admin CRUD/settings, live map/geolocation permissions, or a live Cupboard connection.
- Production CORS, deployed Worker status, live Firebase authorization/IAM, customer messaging and payments.
