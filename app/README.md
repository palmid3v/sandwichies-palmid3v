# 🥪 Sandwichies

Sandwichies is a product-oriented web application for configuring sandwiches, calculating costs and prices, submitting orders, and operating those orders from an authenticated admin workspace.

## 🛒 Customer

- 15 cm / 30 cm sizes
- Protein selection
- Toppings
- Extras
- Base customization
- Cart
- Pickup or delivery
- Customer/contact information
- Payment method
- Order submission
- WhatsApp summary
- Order confirmation

## 🧑‍💼 Admin

- Firebase Authentication
- Admin custom-claim authorization
- Orders history
- Dashboard
- Order detail
- Estimated inventory consumption
- New-order sound notification
- Payment status
- Inventory capacity view
- Live Firestore synchronization

## 🧮 Shared Domain

shared/catalog.js and shared/pricing.js are the domain source for product configuration, ingredient consumption, costs, prices, delivery fees, profit calculations, and inventory consumption.

The server rebuilds totals from the submitted configuration instead of trusting client totals.

## 🔐 Order Flow

~~~text
Customer UI
    ↓
Firebase callable createOrder
    ↓
Trusted validation + pricing
    ↓
Firestore
    ↑
Admin UI
~~~

Firestore rules block direct browser creation and deletion of orders. Admin reads and updates require the admin custom claim.

## 🧱 Stack

- React 19.2.4
- Vite 8.0.1
- Firebase 12.11.x
- Firebase Functions 6.6.x
- Firebase Admin 13.10.x
- React Router 7.18.x
- html2canvas
- Node test runner
- ESLint 9.x

## 📚 Documentation

Current documentation is organized under app/docs/:
- product/
- architecture/
- development/
- deployment/
- tasks/
- audits/

## 🚦 Operational State

The current business configuration has acceptingOrders set to false, so checkout is intentionally disabled until that flag is changed and the release is approved.

## ▶️ Scripts

~~~bash
npm install
npm run dev
npm run lint
npm test
npm run build
npm run check
npm run provision:admin
~~~