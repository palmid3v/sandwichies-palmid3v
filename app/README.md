# 🥪 Sandwichies — App Context

## 🎯 Purpose
Product configurator and operational platform for sandwich ordering, trusted pricing, order administration, and inventory estimation.

## 🛒 Customer workflow
15 cm / 30 cm selection → protein → toppings → extras/base → cart → pickup/delivery → customer/payment data → order submission → WhatsApp summary → confirmation.

## 🧑‍💼 Admin workflow
Firebase Auth → admin custom claim → live orders → dashboard → order detail → payment status → estimated inventory consumption.

## 🧮 Domain
`shared/catalog.js`, `shared/pricing.js`, `shared/business.js`, and `shared/order-request.js` centralize configuration, costs, prices, delivery, profit, and consumption logic. The callable backend rebuilds order totals from the submitted configuration.

## 🔐 Security
Orders are created through a Firebase callable function. Firestore rules restrict direct browser order creation/deletion and protected admin operations require the admin custom claim.

## 🧱 Stack
React 19 · Vite 8 · Firebase/Firestore · Firebase Functions/Admin · React Router 7 · html2canvas · Node test runner · ESLint 9.

## 📚 Documentation
Detailed material is under `docs/` covering architecture, Firebase, pricing/costs, security, deployment, development, product rules, audits, tasks, and v0.1 history.

## 🚦 Operational state
`acceptingOrders` is currently `false`; checkout is intentionally disabled until configuration/release approval changes it.

## ▶️ Commands
```bash
npm install
npm run dev
npm run lint
npm test
npm run build
npm run check
npm run provision:admin
```

## 📌 Status
Active business application under development; the current repository is the source of truth.