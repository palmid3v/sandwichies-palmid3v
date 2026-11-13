# Changelog

## 2026-11-12 — finalization verification

- Added local Firebase Authentication Emulator connection and an explicit loopback-only Worker token-verification path for development.
- Added Auth Emulator configuration and a combined local Auth/Firestore emulator command; local preflight now checks emulator wiring.
- Corrected local CORS allowlist for the running Vite origin in ignored local settings. Production CORS configuration was not changed.
- Added accessible `id`/`name` metadata to menu filters, customer contact fields, order notes, profile and address forms; profile fields now declare autocomplete tokens.
- Updated architecture, local-development and current project documentation with verified emulator and release behavior.
- Added finalization audit, integration matrix, browser QA report and current release checklist.
- Updated lockfile with safe non-major dependency fixes. Six moderate production dependency advisories remain.
- Verified local `npm run check`: 87 Worker, 43 domain, 12 Firestore Rules and 7 Functions/Firestore integration tests; lint, build, bundle budget and smoke passed.
- Order intake remains disabled; no production deployment, real order, live inventory operation or customer communication occurred.
