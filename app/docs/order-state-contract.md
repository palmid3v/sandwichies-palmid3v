# Order, payment, delivery and virtual-table contract

Status: implemented baseline for phases 2–3 on `main`. The canonical write boundary, customer projection synchronization and admin activity history are active in code. Historical reconciliation and non-virtual-table dispatch workflows remain explicit rollout work.

## Canonical ownership

- `orders/{orderId}` is the canonical business record.
- `orders/{orderId}.status` owns the commercial lifecycle.
- `orders/{orderId}.payment.status` owns the payment lifecycle.
- `virtualTables/{tableId}` owns the shared meeting-point table lifecycle and capacity.
- `virtualTables/{tableId}/members/{orderId}.deliveryStatus` owns the individual logistics lifecycle for a meeting-point order.
- `customerOrderTracking/{uid}/orders/{orderId}` is a customer-safe, read-only projection, never an independent source of truth.
- `orderEvents/{eventId}` records commercial and payment transitions.
- `deliveryEvents/{eventId}` records logistics, table and zone activity.

## Commercial lifecycle

`pendiente -> confirmado -> preparando -> listo -> entregado`

Cancellation is allowed only from the states permitted by the domain transition policy and the existing unpaid-order rule. `entregado` and `cancelado` are terminal.

For virtual-table orders, the Worker rejects manual commercial completion. The admin completes delivery once in Admin / Entregas. The Worker accepts logistics completion only when the order is `listo`; the transition to `delivered` atomically updates the member, customer projection, table capacity/status and canonical order to `entregado`.

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
- `POST /v1/admin/orders/:id/delivery`: individual virtual-table delivery transition.
- `POST /v1/customer/orders/:id/ready`: authenticated customer arrival confirmation.
- `GET /v1/admin/orders/:id/activity`: merged admin-only order/payment/logistics history.
- `POST /v1/admin/delivery-zones` and virtual-table operations: Worker-owned zone/table changes.
- Browser writes to order documents, customer tracking and event collections are denied by Firestore Rules. Trusted Worker operations own those mutations.

## Customer projection

New orders create `customerOrderTracking/{uid}/orders/{orderId}` for every fulfillment mode. The projection contains identifiers, order number, commercial status, payment status, optional delivery/table status and update time. Customer history and order-detail API responses hydrate commercial/payment/delivery state from this projection; the customer UI also subscribes to its own projection for live updates. Customers may read only their own projection; only the Worker may write it.

## Activity records and visibility

- `order_status_changed`: commercial transition, from/to states and admin actor.
- `order_delivered`: automatic commercial completion caused by virtual-table delivery.
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
- Pickup and home-delivery orders retain their commercial status workflow. A separate dispatch lifecycle and Entregas UI for those fulfillment modes is not yet implemented; only virtual-table deliveries currently drive automatic logistics-to-commercial completion.
- Event history is bounded to the latest 200 records per source before merge; cursor pagination is future work.
