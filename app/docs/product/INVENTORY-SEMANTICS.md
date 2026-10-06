# Inventory Semantics — Sandwichies

## Purpose

Sandwichies now treats inventory as a transactional ledger instead of a display-only estimate.

## Opening baseline

The catalog field `stockQuantity` is the opening physical baseline for an ingredient.

It is not a transaction history and must not be interpreted as purchase/consumption history.

When the first transaction touches an ingredient, its current balance is initialized from `stockQuantity`.

## Transaction types

### Purchase

Positive inventory movement recorded by an authenticated administrator through the trusted callable.

### Consumption

Negative inventory movement generated automatically by the backend when an order becomes a completed sale.

### Adjustment

Explicit positive or negative correction recorded by an administrator with a required reason.

## Completed-sale accounting

A completed sale is:

- order status = `entregado`;
- payment status = `pagado`.

Only completed sales contribute to the dashboard's sales, cost and profit reporting.

The same completed-sale transition is the trigger for automatic ingredient consumption.

## Idempotency

Completed-sale consumption uses a deterministic transaction identifier based on order ID and ingredient ID. A retry therefore does not create a second consumption movement.

## Historical compatibility

Orders created before physical ingredient usage was stored may not contain enough information to reconstruct consumption safely. These orders are marked as unavailable for automatic inventory consumption rather than being guessed.

## Authorization

Administrators may read inventory balances and transaction history.

Browser writes to both inventory collections remain denied.

All inventory mutations are performed by trusted backend code.

## Operational model

Current balance = opening catalog baseline + all recorded transaction deltas.

The admin UI exposes:

- current balance;
- approximate servings based on portion quantity;
- recent movement history;
- purchase entry;
- stock adjustment entry.

Inventory does not yet model supplier invoices, batch/lot tracking, expiration dates, purchase prices by lot, or warehouse/location separation. Those are future extensions.