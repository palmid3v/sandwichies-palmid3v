# 🥪 Sandwichies

A product-oriented sandwich configurator and operations platform covering customer ordering, trusted pricing, order management, inventory estimation, and admin workflows.

## ✨ Current capabilities

### 🛒 Customer
- 15 cm / 30 cm products
- Protein, toppings, extras, and base customization
- Cart and order submission
- Pickup/delivery information
- Contact and payment method selection
- WhatsApp order summary
- Order confirmation

### 🧑‍💼 Admin
- Firebase Authentication
- Admin custom-claim authorization
- Orders history and detail views
- Dashboard
- Inventory-capacity estimation
- Payment status
- Live Firestore synchronization
- New-order notification sound

## 🧮 Domain logic

The shared catalog, pricing, business, and order-request modules define product configuration, costs, prices, delivery fees, profit calculations, and inventory consumption. Server-side order creation rebuilds totals from submitted configuration instead of trusting client totals.

## 🔐 Security boundary

Customer order creation is handled through a Firebase callable function. Firestore rules prevent direct browser order creation/deletion and require the admin custom claim for protected admin operations.

## 🧱 Stack

- React 19
- Vite 8
- Firebase / Firestore
- Firebase Functions / Admin SDK
- React Router 7
- html2canvas
- Node test runner
- ESLint 9

## 🏗️ Repository structure

```text
sandwichies/
├── app/       # Current application, functions, domain logic, tests, and docs
└── archive/   # Historical material
```

Documentation is under `app/docs/`, with product, architecture, security, pricing, deployment, development, audit, task, and v0.1 history.

## 🚦 Current operational state

The current business configuration has `acceptingOrders = false`, so checkout is intentionally disabled until the configuration is changed and the release is approved.

## ▶️ Development

```bash
cd app
npm install
npm run dev
npm run lint
npm test
npm run build
npm run check
npm run provision:admin
```