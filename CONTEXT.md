# CONTEXT — Sandwichies

## Identity

- Product: Sandwichies
- Type: Sandwich configurator + operations platform
- Developer: PALMI-D3V
- Backend: Firebase
- Current release line: MVP hardening

## Purpose

Support customer sandwich configuration/order submission and admin order operations while keeping pricing and inventory calculations trusted.

## Current operational state

`acceptingOrders = false`.

Checkout remains intentionally disabled until release validation and approval are complete.

## Customer flow

15 cm / 30 cm
→ protein
→ toppings
→ extras/base
→ cart
→ pickup/delivery
→ customer/payment data
→ trusted order submission
→ WhatsApp summary
→ confirmation

## Admin flow

Firebase Auth
→ admin custom claim
→ orders
→ dashboard
→ order details
→ payment status
→ inventory estimation

## Domain authority

- `app/shared/catalog.js`
- `app/shared/pricing.js`
- `app/shared/business.js`
- `app/shared/recipes.js`
- `app/shared/order-request.js`

Client values are previews. Financial/order values are rebuilt by the trusted Firebase callable function.

## Security

Customer order creation goes through `createOrder`.

Firestore Rules:
- deny direct browser order creation/deletion,
- deny direct counter access,
- allow protected order operations only to admins.

Admin authorization uses the Firebase Auth `admin` custom claim.

## Stack

React 19 · Vite 8 · Firebase / Firestore · Firebase Functions/Admin · React Router 7 · Node test runner · ESLint 9.

## Repository control

The master project documents are:

1. `README.md`
2. `CONTEXT.md`
3. `STEPBYSTEP.md`
4. `ROADMAP.md`

Detailed documentation is under `app/docs/`. Historical material remains under `app/docs/v0.1/`.

## Data Connect

`app/dataconnect/` is experimental/non-production and is not part of the active Firestore order architecture. Do not introduce it into production without an explicit architecture decision and migration plan.

## Development

```bash
cd app
npm install
npm run dev
npm run lint
npm test
npm run build
npm run check
```

## Rule for future work

Maintain parity between client configuration, shared business modules, Firebase callable functions, and Firestore security rules. Never trust client-submitted financial totals.

A task is not DONE until implementation, validation, security review, and documentation are synchronized.
