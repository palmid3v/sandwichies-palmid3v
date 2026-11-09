# Order, payment, delivery and virtual-table contract

Status: phases 2–5 implemented on `main`. Admin Pedidos and Entregas are separate workspaces. Customer tracking consumes the same Worker-owned projection used by order history. The Worker owns commercial, payment and logistics transitions for virtual-table, pickup and home-delivery orders.

## Canonical ownership

- `orders/{orderId}` is the canonical business record.
- `orders/{orderId}.status` owns the commercial lifecycle.
- `orders/{orderId}.payment.status` owns the payment lifecycle.
- `virtualTables/{tableId}` owns the shared meeting-point table lifecycle and capacity.
- `virtualTables/{tableId}/members/{orderId}.deliveryStatus` owns the individual logistics lifecycle for a meeting-point order.
- `orders/{orderId}.delivery` owns the logistics lifecycle for pickup and home-delivery orders.
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
  - Pickup: preparation → handoff completed.
  - Home delivery: preparation → en route → delivered.
  - Virtual table: point assigned → customer arrival → en route → arrived → delivered.
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
