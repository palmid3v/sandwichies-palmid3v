# Sandwichies Worker — foundation

Isolated Cloudflare Worker foundation for the Sandwichies backend migration under the $0 constraint.

## Current scope

- `GET /health`: public health check.
- `GET /v1/session`: validates a Firebase ID token and returns its UID plus the admin claim.
- `GET /v1/admin/session`: validates the token and requires the Firebase custom claim `admin: true`.
- Firebase ID token verification checks RS256 signature against Google's Secure Token JWK set, issuer, audience, subject, issue time, authentication time and expiration.
- No Firestore reads/writes, order creation, inventory operations, payment operations, cron jobs or production mutations are implemented in this foundation.

## Local tests

From this directory, with Node.js 22 or later:

```bash
npm test
```

The tests generate an ephemeral RSA key pair and exercise valid, wrong-audience, expired and tampered tokens. They do not contact Firebase or mutate a project.

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

No service-account private key or other secret belongs in this repository.

## Next implementation gate

Before adding business endpoints, implement and test a server-only Firestore REST credential provider and transactional adapter. It must use a least-privilege service identity, keep credentials in Cloudflare secrets, preserve Firestore transaction semantics and fail closed when configuration is absent. Cupboard's second Firebase project must remain a separate credential boundary. Do not port the existing Firebase Admin SDK modules directly into the Worker runtime.
