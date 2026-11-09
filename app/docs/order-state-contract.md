# Order, payment, delivery and virtual-table contract

Status: phases 2â€“5 implemented on `main`. Admin Pedidos and Entregas are separate workspaces. Customer tracking consumes the same Worker-owned projection used by order history. The Worker owns commercial, payment and logistics transitions for virtual-table, pickup and home-delivery orders.

## Canonical ownership

- `orders/{orderId}` is the canonical business record.
- `orders/{orderId}.status` owns the commercial lifecycle.
- `orders/{orderId}.payment.status` owns the payment lifecycle.
- `virtualTables/{tableId}` owns the shared meeting-point table lifecycle and capacity.
- `virtualTables/{tableId}/members/{orderId}.deliveryStatus` owns the individual logistics lifecycle for a meeting-point order.
- `orders/{orderId}.delivery` is the canonical logistics snapshot for all fulfillment modes. For virtual-table orders, the individual member document remains the operational source for table capacity and per-member delivery transitions; every transition is mirrored to this canonical order snapshot and the customer projection.
- `customerOrderTracking/{uid}/orders/{orderId}` is a customer-safe, read-only projection, never an independent source of truth.
- `orderEvents/{eventId}` records commercial and payment transitions.
- `deliveryEvents/{eventId}` records logistics, table and zone activity.

## Commercial lifecycle

`pendiente -> confirmado -> preparando -> listo -> entregado`

Cancellation is allowed only from the states permitted by the domain transition policy and the existing unpaid-order rule. `entregado` and `cancelado` are terminal.

For all fulfillment modes, the Worker rejects manual commercial completion. The admin completes delivery once in Admin / Entregas. The Worker accepts logistics completion only when the order is `listo`; the transition to `delivered` atomically updates the logistics record, customer projection and canonical order to `entregado`. For virtual-table orders, it also releases table capacity.

## Pickup and home-delivery lifecycle

- Pickup (`recoger`): `waiting_preparation -> delivered`. The admin confirms handoff from Entregas once the order is `listo`.
- Home delivery (`domicilio`): `waiting_preparation -> en_route -> delivered`. The admin dispatches and confirms completion from Entregas once the order is `listo`.
- Each logistics transition updates the canonical order's delivery object and the customer's tracking projection. Final delivery atomically changes commercial status to `entregado` and records logistics and commercial events.
- Repeating a completed transition is idempotent and cannot create a second completion event.

## Administrative state consistency

- Admin / Pedidos displays the commercial state and a separate logistics state from the canonical `orders/{orderId}.delivery.status` snapshot.
- Every customer-arrival and admin logistics transition for a virtual-table order updates the virtual-table member, canonical order snapshot and customer projection in the same Firestore transaction. The Admin order listener therefore receives the same logistics progress as the customer view.
- Pickup and home-delivery transitions likewise update the canonical order and customer projection in one transaction.
- Manual commercial transition to `entregado` is rejected for pickup, home delivery and meeting-point orders. The only supported completion action is Admin / Entregas; the Worker then completes the commercial order automatically.
- If a previously completed commercial order has an incomplete logistics state, a later valid logistics completion may reconcile the delivery snapshot. It does not create a duplicate commercial completion event. Existing inconsistent records are not bulk-mutated; they require operational review.

## Payment lifecycle

`pendiente -> pagado`

Payment confirmation is admin-only through `POST /v1/admin/orders/:id/payment`. It is not reversible through this API and cannot be confirmed while the order is `pendiente` or `cancelado`.

## Individual virtual-table delivery lifecycle

`waiting_customer -> customer_ready -> en_route -> arrived -> delivered`

The supported shortcut `waiting_customer -> en_route` remains valid. `cancelled` is terminal and is assigned when its commercial order is cancelled.

A table can contain multiple orders. Completing one member decrements capacity once; retrying the same delivery transition is idempotent and cannot decrement capacity again. Completing one member never completes another member's order.

## Worker mutation boundary

- `POST /v1/admin/orders/:id/status`: commercial transition and associated inventory side effects.
- `POST /v1/admin/orders/:id/payment`: payment confirmation.
- `POST /v1/admin/orders/:id/delivery`: logistics transition for virtual-table, pickup and home-delivery orders.
- `POST /v1/customer/orders/:id/ready`: authenticated customer arrival confirmation.
- `GET /v1/admin/orders/:id/activity`: merged admin-only order/payment/logistics history.
- `POST /v1/admin/delivery-zones` and virtual-table operations: Worker-owned zone/table changes.
- Browser writes to order documents, customer tracking and event collections are denied by Firestore Rules. Trusted Worker operations own those mutations.

## Customer projection

New orders create `customerOrderTracking/{uid}/orders/{orderId}` for every fulfillment mode. The projection contains identifiers, order number, commercial status, payment status, optional delivery/table status and update time. Customer history and order-detail API responses hydrate commercial/payment/delivery state from this projection; the customer UI also subscribes to its own projection for live updates. Customers may read only their own projection; only the Worker may write it.


## Customer live tracking

- The customer confirmation screen and account order history use the same `CustomerOrderTracking` view.
- The view reads the authenticated customer's order response and subscribes only to `customerOrderTracking/{uid}/orders/{orderId}`; it does not query admin event collections or write order state directly.
- Commercial progress, payment state and delivery progress are rendered from the canonical order fields hydrated by the Worker and the customer's read-only projection.
- Delivery progress adapts to fulfillment mode:
  - Pickup: preparation â†’ handoff completed.
  - Home delivery: preparation â†’ en route â†’ delivered.
  - Virtual table: point assigned â†’ customer arrival â†’ en route â†’ arrived â†’ delivered.
- The customer may register arrival only for their own virtual-table order while it is in `waiting_customer`. The Worker validates ownership and updates the canonical member and projection.
- Projection updates are live; order history and the confirmation screen reconcile from the same projection. The client never mutates commercial, payment or delivery status directly.

## Activity records and visibility

- `order_status_changed`: commercial transition, from/to states and admin actor.
- `order_delivered`: automatic commercial completion caused by logistics delivery for any fulfillment mode.
- `payment_status_changed`: payment transition, from/to states and admin actor.
- `deliveryEvents`: table assignment, customer-ready, dispatch, arrival, completion, cancellation, expiry and zone activity.
- Admin order detail exposes a unified chronological view from both event collections. The Worker filters by order ID and requires admin claims.

Older records are not retroactively assigned events that were never recorded. The timeline displays available recorded activity; it does not fabricate historical transitions.

## Rollout and compatibility

- No production data backfill or replay has been run.
- Legacy customer projections are repaired when the corresponding order is transitioned or paid; customer read APIs also hydrate from any existing projection.
- A controlled dry-run/reconciliation is required to identify old orders with missing projections, mismatched table counts or inconsistent order/member statuses before any write migration.
- Do not manually replay a delivery transition until the canonical order, member, table count and inventory movement/event records have been checked.
- Updated Firestore Rules and Worker code must be deployed together. Browser order writes are intentionally denied.

## Remaining scope outside this implementation

- Historical projection backfill/reconciliation and synthetic legacy timeline entries are intentionally not automatic; they require a dry-run report and explicit review before mutating live records.
- Admin navigation separates Pedidos (commercial/payment management) from Entregas (virtual tables, pickup and home delivery). Entregas exposes only operationally ready or dispatched orders; commercial and payment controls remain in Pedidos.
- Event history is bounded to the latest 200 records per source before merge; cursor pagination is future work.

## Phase 6 â€” regression and closure matrix

The Worker domain suite now covers the following end-to-end invariants using isolated in-memory Firestore and injected inventory adapters:

- **Synchronization:** customer arrival and delivery transitions are mirrored to the virtual-table member, canonical order and customer tracking projection.
- **Cancellation:** an unpaid order can be cancelled; Cupboard consumption is reversed idempotently, its member becomes cancelled, and its active table count is decremented once. A paid order is rejected before cancellation and its transition lock is released.
- **Partial delivery:** delivering one member completes only that order; sibling orders remain active and the table is released only when the final active member is delivered.
- **Multiple orders per table:** two orders can share one table; cancelling one preserves the other member and table capacity.
- **Multiple orders per table:** two orders can share one table; cancelling one preserves the other member and table capacity.
- **Payments:** confirmation is idempotent, updates the customer projection and emits one audit event. Cancelled and unconfirmed orders cannot be marked paid.
- **Manual completion:** all supported fulfillment modes reject commercial completion outside Admin / Entregas.
- **Historical reconciliation:** a legacy commercial completion can receive its missing logistics completion without generating a duplicate commercial completion event.

These are automated domain-level regression tests. They do not replace browser-based concurrent-user testing or a controlled Firebase Emulator end-to-end session with the actual frontend. No production data is migrated or modified by the test suite.
