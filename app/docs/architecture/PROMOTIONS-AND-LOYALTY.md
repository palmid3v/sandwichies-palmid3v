# Promotions and Loyalty — Architecture v1

**Status:** domain foundation only; campaigns disabled; not production-ready.

## Initial business rules

- Referrals reward both the inviter and invitee after the invitee's first qualifying purchase.
- Loyalty issues one promotional credit reward every 3 qualifying purchases (milestones 3, 6, 9, ...).
- Each reward expires 90 days after issuance.
- Minimum order amount is configurable per campaign.
- Reward amounts are configurable and must be greater than zero before a campaign can be enabled.
- Currency is COP. Amounts are integer pesos.
- A qualifying sale must be delivered, paid, meet the campaign minimum, belong to a stable customer identity, and not have been processed previously.

## Existing repository integration points

- `shared/business.js`: `isCompletedSale(order)` defines delivered + paid.
- `functions/index.js`: trusted order creation and status transition functions.
- `shared/order-request.js`: server-side reconstruction of customer order input.
- `firestore.rules`: default-deny access model.
- `src/customerFirebase.js`: anonymous customer auth currently used by storefront.
- `docs/design/DESIGN-SYSTEM.md`: dark-first customer/admin UI tokens and interaction guidance.

## Proposed Firestore collections

- `promotionRules/{ruleId}`: validated campaign settings and audit metadata.
- `referrals/{referralId}`: inviter/invitee attribution and qualification state.
- `loyaltyAccounts/{uid}`: derived progress projection, not a source of financial truth.
- `customerRewards/{rewardId}`: one document per granted reward.
- `promotionLedger/{entryId}`: append-only credits, redemptions, expirations, and compensating reversals.

These collections are proposals. They must not be treated as deployed collections until the implementation and security rules are reviewed.

## Domain foundation in this change

`shared/promotions.js` contains pure validation and calculation helpers:
- validate loyalty configuration;
- determine whether trusted order data meets a campaign's eligibility conditions;
- calculate crossed loyalty milestones;
- create deterministic idempotency keys;
- calculate expiry using UTC calendar days;
- construct a reward domain record.

Persistence, authorization, identity linking, ledger transactions, referral activation, redemption and UI are not implemented in this foundation.

## Required implementation design

1. Do not trust a UID supplied in customer request data. Use `request.auth.uid` and an explicitly defined stable customer identity.
2. Anonymous Firebase UIDs are not guaranteed to persist across devices or cleared browser storage. Before enabling rewards or referrals, implement account linking or another verified identity flow and a safe migration of anonymous progress.
3. Process each completed order idempotently. A deterministic order-processing record and deterministic reward IDs prevent duplicate credits on retries.
4. Update progress and create rewards in one Firestore transaction where possible. Do not assume Firestore transactions can atomically include Cupboard or any external service.
5. Keep ledger entries append-only. Correct errors with compensating entries, not edits or deletion.
6. Define redemption reservation/commit/release semantics before applying credits to an order, including concurrent checkout attempts.
7. Define reversals when a completed sale or referral later becomes invalid, especially if a reward was already redeemed.
8. Add explicit Firestore rules for customer-owned reads; deny client writes to rules, balances, rewards, referrals and ledger. Validate admin custom claims in every privileged callable.
9. Keep all campaigns disabled until reward amounts, identity policy, minimums, refund behavior, and operational costs are approved.
10. Preserve the existing Cupboard inventory workflow and the current Sandwichies design system.

## Test strategy

- Unit tests: rule validation, sale eligibility, milestones 3/6/9, expiry, idempotency keys and reward payloads.
- Security tests: customer isolation, denied client writes, admin-only rule changes, server-only ledger mutations.
- Integration tests: completed order processing, duplicate events, simultaneous orders, referral qualification, redemption and reversals in Firebase Emulator Suite.
- Release checks: lint, unit tests, Firestore rules tests, integration tests, build, performance budget and smoke tests.

## Rollout gates

No production deployment or campaign activation is authorized by this document. Before release, verify Firebase project configuration and deployed functions, run the full test suite, confirm Cloud Functions requirements/costs, and obtain explicit approval.
