# Order, payment, delivery and virtual-table contract

Status: implementation baseline for phases 2–3.

## Canonical ownership

- `orders/{orderId}` is the canonical business record.
- `orders/{orderId}.status` is the commercial lifecycle.
- `orders/{orderId}.payment.status` is the payment lifecycle.
- `virtualTables/{tableId}` owns the shared meeting-point table lifecycle and capacity.
- `virtualTables/{tableId}/members/{orderId}.deliveryStatus` owns the individual logistics lifecycle for a meeting-point order.
- `customerOrderTracking/{uid}/orders/{orderId}` is a customer-safe, read-only projection. It is not an independent source of truth.
- `orderEvents/{eventId}` records commercial and payment transitions. `deliveryEvents/{eventId}` records logistics/table/zone activity.

## Commercial states

`pendiente -> confirmado -> preparando -> listo -> entregado`

Cancellation is allowed from `pendiente`, `confirmado`, or `preparando` (subject to the existing unpaid-order rule). `entregado` and `cancelado` are terminal.

For virtual-table orders, the Worker accepts logistics completion only when the commercial order is `listo`. When an admin moves the individual delivery from `arrived` to `delivered`, the same Firestore transaction updates the member, customer projection, table capacity/status, and canonical order to `entregado`.

## Payment states

`pendiente -> pagado`

Payment confirmation is admin-only and performed through the Worker. It is not reversible through this API. Payment cannot be confirmed while the order is still `pendiente` or after cancellation.

## Individual delivery states

`waiting_customer -> customer_ready -> en_route -> arrived -> delivered`

The existing supported alternative `waiting_customer -> en_route` remains valid. `cancelled` is terminal and is assigned when its commercial order is cancelled.

A table can contain multiple orders. Completing one member must decrement capacity once and must not complete or mutate the other members' orders.

## Worker mutation boundary

- `POST /v1/admin/orders/:id/status`: commercial transition and associated inventory side effects.
- `POST /v1/admin/orders/:id/payment`: payment confirmation.
- `POST /v1/admin/orders/:id/delivery`: individual virtual-table delivery transition.
- Client actions update only their own tracking projection through authenticated Worker operations.
- Browser writes to order documents are denied by Firestore Rules. Worker writes use trusted server credentials.

## Customer projection

New orders create `customerOrderTracking/{uid}/orders/{orderId}` for every fulfillment mode. The projection contains only identifiers, order number, commercial status, payment status, delivery status/table status, and update time. Customers may read only their own projection; only the Worker may write it.

## Activity records

- `order_status_changed`: commercial transition, with from/to states and admin actor.
- `order_delivered`: automatic commercial completion caused by a delivered logistics transition.
- `payment_status_changed`: payment transition, with from/to states and admin actor.
- Existing `deliveryEvents` continue to record table, zone, member and delivery activity.

## Rollout and compatibility

This implementation creates customer projections for new orders and writes/repairs a projection when an existing order is transitioned or paid. Existing historical orders are not bulk-migrated. Before production rollout, validate the Worker against the Firestore Emulator, deploy updated Firestore Rules, and verify legacy records with a controlled reconciliation script. Do not manually replay a delivery transition until the order, member, table count and movement/event records have been checked.

## Deferred scope

- Full historical event timeline UI and event pagination.
- Backfill/reconciliation of every pre-existing order projection.
- Delivery workflows for pickup and home delivery; this change preserves their current commercial completion path and specifically couples virtual-table delivery completion to commercial completion.
