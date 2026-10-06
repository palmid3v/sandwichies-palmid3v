# FASE 5–6 — Execution Report

**Date:** 2026-10-05  
**Scope:** Release verification tooling + business/inventory semantics  
**Status:** Implementation complete; production/environment verification remains pending.

## FASE 5 — Release verification

Implemented:

- Added a dedicated production verification script at `app/scripts/release-verify.mjs`.
- Added `npm run release:verify`.
- The script checks the customer and admin entrypoints, verifies the expected Firebase project identifier is present in the client bundle, and confirms the `createOrder` callable endpoint is responding without permitting an order while `acceptingOrders=false`.
- Expanded the release checklist with technical, Firebase, smoke, evidence, monitoring and rollback gates.
- Kept production ordering disabled.

Not completed by repository automation:

- Actual production Firebase deploy/verification.
- Actual admin account claim verification.
- Production customer/admin/browser smoke evidence.
- Approval and execution to set `acceptingOrders=true`.

## FASE 6 — Business and inventory semantics

Implemented:

- Formal order status transitions in `app/shared/business.js`.
- Formal payment transition `pendiente → pagado`.
- Completed-sale definition: `entregado + pagado`.
- WhatsApp defined as customer confirmation/communication, not financial truth.
- Transactional inventory domain in `app/shared/inventory.js`.
- Server-owned inventory balances in `inventoryBalances`.
- Server-owned movement history in `inventoryTransactions`.
- Automatic completed-sale consumption trigger, idempotent per order/ingredient.
- Admin purchase and stock-adjustment flow.
- Inventory security rules and regression coverage.
- Operational reporting filters for today, 7 days, 30 days and all.
- Historical orders without physical ingredient usage are not silently consumed.

## Accounting policy approved for this execution

A sale enters business reporting only when the order is both delivered and paid. Inventory consumption is posted when that state is reached. Payment is intentionally one-way for the current model; refund/reversal semantics are outside this phase and require a separate business decision.

## Validation requirement

The repository now contains the required test and release commands, but no command is considered passing unless it has been actually executed in the target environment.