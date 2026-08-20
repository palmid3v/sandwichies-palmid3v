# Sandwichies

Customer ordering and operations app for a sandwich business.

## Current features

- Mobile-first sandwich builder with 15 cm and 30 cm pricing
- Recommended menu products with starting prices
- Multi-product cart
- Pickup and delivery checkout
- Cash and transfer payment options
- Customer notes and allergy reminder
- Atomic order numbering and duplicate-submit protection
- WhatsApp order summary
- Firebase Authentication for the admin area
- Real-time kitchen order queue
- Search, filters, payment tracking, and order statuses
- Daily sales, profit, average ticket, and best-seller reporting
- Estimated ingredient capacity

## Local development

```bash
npm install
npm run dev
```

Customer storefront: `http://localhost:5173/`

Admin: `http://localhost:5173/admin`

## Quality checks

```bash
npm run check
```

This runs ESLint, pricing tests, and a production build.

## Business configuration

Update `src/config/business.js` for:

- Business name and tagline
- WhatsApp number
- Whether the store is currently accepting orders
- Delivery fee
- Pickup and delivery estimates

Update ingredient purchase costs and portions in
`src/data/ingredients.js`. Recommended sandwiches live in
`src/data/menu.js`.

## Firebase deployment

The Firebase web configuration identifies the project and is expected to be
public in a browser app. Security is provided by Firebase Authentication and
Firestore rules.

Deploy the included rules before accepting public orders:

```bash
firebase deploy --only firestore:rules
```

Create the admin account in Firebase Authentication. The current rules treat
any authenticated Firebase user as staff, so only create accounts for trusted
employees.

## Important production note

Firestore rules validate the public order shape and restrict order reading and
editing to authenticated staff. For stronger protection against manipulated
prices, the next infrastructure upgrade should move final price calculation
and order creation into a Firebase Cloud Function or another trusted backend.
