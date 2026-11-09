# Customer Storefront — Product Requirements

## Approved direction

Build a responsive Sandwichies customer storefront inspired by familiar food-ordering catalogs, using Sandwichies' existing brand, recipes, product IDs, categories, and shared pricing rules. Do not create duplicate products or silently modify the existing recipes.

## Catalog

- Reuse `shared/recipes.js` as the existing product source and `app/src/data/menu.js` as the storefront projection.
- Display product name, description, recipe ingredients in human-readable names, starting price in COP, category/discovery badges, and a clear customization action.
- Support existing discovery segments, text search, price filtering, and sorting by featured, price, or name.
- Keep product identifiers stable; catalog cards must select the existing recipe rather than create a new product.
- Product images may reuse existing local assets. Missing/bad image assets must not block browsing.

## Responsive behavior

- Desktop: multi-column product cards and visible catalog controls.
- Tablet/mobile: responsive grid, horizontally scrollable categories, readable card content, large touch targets, and stacked filters at narrow widths.
- Respect reduced-motion preferences and existing accessibility patterns.
- Keep search and category choices prominent on mobile; keep price/sort filters in a native disclosure so they do not push the catalog below the first screen.
- When the cart has items, show a fixed, safe-area-aware summary with quantity and total that links to the cart. Reserve bottom space so it does not cover content.

## Address and delivery

- Provide address search/selection and explicit confirmation for delivery.
- Point-of-meeting service coverage is validated against active admin polygons by the trusted backend. Domiciliary address coverage is not automatically validated; the existing radius assessment is manual-only.
- Do not invent a delivery zone or imply an address was validated when it was only typed.
- Select a geocoding/address provider only after checking terms, attribution, rate limits, privacy, and $0 budget constraints. Avoid a production dependency on an unapproved public endpoint.

## Customer identity

- Customers authenticate with email and password using the same Firebase Authentication instance as administrators.
- Registration sends an email-verification link. Unverified accounts cannot browse the authenticated checkout, submit orders, or read tracking data.
- Login supports verification-link resend and password reset.
- Anonymous authentication is disabled. New accounts start with new UIDs; anonymous customer histories are not linked or migrated.
- Administrative authorization remains separate and additionally requires the custom claim `admin: true`.
- Do not introduce SMS, WhatsApp OTP, or paid identity providers in this flow.

## Cart and order safety

- Reuse existing cart and trusted `createOrder` callable; do not trust browser-supplied totals.
- Release rule: keep `BUSINESS.acceptingOrders = false` until the release gate has been explicitly approved. `main` commit `270303d` has it set to `true`, which is a documented conflict; no production approval/deployment is evidenced and no real order should be created.
- Do not deploy Firebase Rules or Functions as part of storefront UI changes.
- Preserve the current server-side order/inventory idempotency behavior. Cupboard catalog items will be reviewed and synchronized in a later phase; do not auto-import or overwrite Sandwichies catalog data as part of this authentication change.

## Current implementation baseline

- Catalog search and discovery categories already exist.
- Price filtering and sorting were added to the functional storefront.
- Existing recipes, shared price calculation, local image assets, customizer, cart, and server-validated order callable remain the source of truth.
- Address autocomplete/coverage validation and phone verification are not yet implemented; do not describe them as available.
- Point-of-meeting polygon validation, GPS/manual pin selection and owner-only tracking are implemented. This does not imply address-geocoding coverage or release readiness.


## Product identity and customer communication

- The trusted order builder derives `productId` and `productName` from the canonical recipe's `favoriteId`; browser-supplied display names are not trusted.
- Custom builds use the explicit product identity `custom` and display label `Sándwich personalizado`; favorite-based products retain catalog names in orders, customer history, admin normalization, and WhatsApp summaries.
- Product emojis are suffixes in catalog names. Search, ranking, and aggregation use stable product IDs rather than emoji-bearing labels.
- WhatsApp summaries show product name, size, selected proteins, toppings/extras, fulfillment details, payment method, and trusted total.
- Customer order history surfaces product names and sizes before opening the live delivery timeline. Responsive styling keeps order cards, controls, and tracking steps usable on narrow screens.
- Historical orders with a valid `favoriteId` recover the canonical recipe name at read time. Older custom orders without recipe identity remain labeled as custom; historical Firestore records are not rewritten.
