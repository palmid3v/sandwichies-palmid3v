# 🥪 Sandwichies

A product-oriented sandwich configurator and operations platform covering customer ordering, trusted pricing, order management, inventory estimation, and admin workflows.

> **Current status:** Active business application under development. Current business configuration has acceptingOrders = false, so checkout is intentionally disabled until configuration and release approval change it.

## 🎯 Product scope

### Customer
- 15 cm / 30 cm products
- Protein, toppings, extras, and base customization
- Cart and order submission
- Pickup/delivery information
- Customer and payment-method data
- WhatsApp order summary
- Order confirmation

### Admin
- Firebase Authentication
- Admin custom-claim authorization
- Orders history and details
- Dashboard
- Inventory-capacity estimation
- Payment status
- Live Firestore synchronization
- New-order notification sound

## 🧮 Domain logic

Shared catalog, pricing, business, recipes, and order-request modules define product configuration, costs, prices, delivery fees, profit calculations, and inventory consumption.

Server-side order creation rebuilds totals from submitted configuration instead of trusting client totals.

## 🔐 Security boundary

Customer order creation is handled through a Firebase callable function. Firestore Rules restrict direct browser order creation/deletion, and protected admin operations require the admin custom claim.

## 🛠️ Technology

| Technology | Role |
| --- | --- |
| React 19 | UI |
| Vite 8 | Tooling |
| Firebase / Firestore | Persistence |
| Firebase Functions / Admin SDK | Trusted backend |
| React Router 7 | Routing |
| html2canvas | Rendering support |
| Node test runner | Tests |
| ESLint 9 | Code quality |

## 📁 Repository structure

~~~text
sandwichies-palmid3v/
├── app/
│   ├── src/              # Browser application
│   ├── shared/           # Shared business/domain modules
│   ├── functions/        # Firebase backend
│   ├── docs/             # Product/engineering history
│   ├── scripts/          # Administrative scripts
│   └── package.json
├── archive/
├── CONTEXT.md
└── README.md
~~~

## 📚 Documentation

Detailed documentation is maintained under app/docs/ and covers:

- Product
- Business rules
- Architecture
- Firebase
- Pricing and costs
- Security
- Deployment
- Development
- Testing
- Audits
- Tasks
- v0.1 history

## 🚦 Operational state

acceptingOrders is currently false.

Do not enable customer checkout without reviewing configuration and release requirements.

## 🚀 Development

~~~bash
cd app
npm install
npm run dev
npm run lint
npm test
npm run build
npm run check
npm run provision:admin
~~~

## 📌 Project boundary

This repository is both the application source of truth and the backend/domain source for Sandwichies. Shared business modules must remain aligned with client and server validation.

## 📚 Project context

See CONTEXT.md for the consolidated product, business, security, and architecture rules.

---

**PALMI-D3V** · Sandwichies · 2026