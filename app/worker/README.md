# Sandwichies Worker — foundation

Isolated Cloudflare Worker foundation for the Sandwichies backend migration under the $0 constraint.

## Current scope

- `GET /health`: public health check.
- `GET /v1/session`: validates a Firebase ID token and returns its UID plus the admin claim.
- `GET /v1/admin/session`: validates the token and requires the Firebase custom claim `admin: true`.
- Firebase ID token verification checks RS256 signature against Google's Secure Token JWK set, issuer, audience, subject, issue time, authentication time and expiration.
- Exact-origin CORS allowlist is configured with `ALLOWED_ORIGINS` in `wrangler.toml`.
- `OPTIONS` preflight accepts only the configured origins, `GET/POST/OPTIONS`, and `Authorization/Content-Type` request headers.
- No Firestore reads/writes, order creation, inventory operations, payment operations, cron jobs or production mutations are implemented in this foundation.

## Local tests

From this directory, with Node.js 22 or later:

```bash
npm test
```

The Firebase auth tests generate an ephemeral RSA key pair and exercise valid, wrong-audience, expired and tampered tokens. The Worker tests cover CORS allowlisting, preflight acceptance/rejection, CORS response headers and unauthenticated session access. They do not contact Firebase or mutate a project.

## Wrangler

Configuration: `wrangler.toml`.

For a manual deployment after review, from the repository root:

```bash
npx wrangler deploy --config app/worker/wrangler.toml
```

Do not run this command until the Worker configuration, secrets and environment have been reviewed and deployment is explicitly authorized.

The Cloudflare Git build must remain disabled until its root directory and deploy command are explicitly configured for this Worker. If enabled later, use the repository root with deploy command:

```bash
npx wrangler deploy --config app/worker/wrangler.toml
```

## Required environment

- `FIREBASE_PROJECT_ID`: public Firebase project identifier; currently `sandwich-pro` in the Wrangler vars section.
- `ALLOWED_ORIGINS`: comma-separated exact origins. The current list covers the known Vercel frontend and local Vite development ports.

No service-account private key or other secret belongs in this repository.

## Next implementation gate

Before adding business endpoints, implement and test a server-only Firestore REST credential provider and transactional adapter. It must use a least-privilege service identity, keep credentials in Cloudflare secrets, preserve Firestore transaction semantics and fail closed when configuration is absent. Cupboard's second Firebase project must remain a separate credential boundary. Do not port the existing Firebase Admin SDK modules directly into the Worker runtime.

Before frontend cutover or release:

1. Run `npm test` and the full Sandwichies `npm run check` suite.
2. Add authenticated Firestore access using a narrowly scoped server identity and verify all authorization rules.
3. Implement and test order, delivery-zone, virtual-table and Cupboard inventory contracts.
4. Verify idempotency, stock reversal, concurrency and failure handling in isolated test data.
5. Confirm Cloudflare Free limits and operational behavior against the $0 budget.
6. Update the frontend API adapter and verify no production route still depends on undeployed Firebase Functions.
7. Obtain explicit approval before deployment or enabling real orders.

Do not enable Firebase Blaze, add billing, migrate production data, or submit real orders as part of this work.
