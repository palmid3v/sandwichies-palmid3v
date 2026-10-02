# CONTEXT — Sandwichies

## Identity

- Product: Sandwichies
- Type: Sandwich configurator + operations platform
- Developer: PALMI-D3V
- Backend: Firebase

## Purpose

Support customer sandwich configuration/order submission and admin order operations while keeping pricing and inventory calculations trusted.

## Customer flow

15 cm / 30 cm
→ protein
→ toppings
→ extras/base
→ cart
→ pickup/delivery
→ customer/payment data
→ order submission
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

## Domain modules

- app/shared/catalog.js
- app/shared/pricing.js
- app/shared/business.js
- app/shared/recipes.js
- app/shared/order-request.js

## Security

Customer order creation goes through a Firebase callable function.

Firestore Rules restrict direct browser order creation/deletion and protected admin operations require the admin claim.

Server-side totals are rebuilt from submitted configuration.

## Current operational state

acceptingOrders = false.

Checkout is intentionally disabled until configuration and release approval change.

## Stack

React 19 · Vite 8 · Firebase / Firestore · Firebase Functions/Admin · React Router 7 · html2canvas · Node test runner · ESLint 9.

## Documentation

app/docs/ contains product, business, architecture, pricing, security, deployment, development, testing, audits, tasks, and v0.1 history.

## Development

~~~bash
cd app
npm install
npm run dev
npm run lint
npm test
npm run build
npm run check
~~~

## Rule for future work

Maintain parity between client configuration, shared business modules, Firebase callable functions, and Firestore security rules. Never trust client-submitted financial totals.
