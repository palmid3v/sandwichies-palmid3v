# Sandwichies Documentation

## Current source of truth

Repository-level project control is defined by:

1. `/README.md`
2. `/CONTEXT.md`
3. `/MASTERPROMPT.md`
4. `/STEPBYSTEP.md`
5. `/ROADMAP.md`

This directory contains detailed application documentation and historical evidence.

## Structure

- `product/` — product behavior, user flows, UX/UI decisions and product evolution.
- `architecture/` — architecture, Firebase, security, pricing/costs.
- `development/` — development, code structure, cleanup and testing.
- `deployment/` — deployment and release procedures.
- `audits/` — audit records, including the current Masterprompt compliance audit.
- `tasks/` — task reports.
- `v0.1/` — historical baseline and evidence.

## Product documentation rule

Current product behavior belongs in current documents.

As the visual and interaction system evolves, document reusable product decisions rather than burying them inside individual components.

Recommended future current documents include:

- product vision
- UX principles
- visual/design system
- motion system
- customer journey
- product catalog strategy
- release/product experiments

## Documentation rule

Current behavior belongs in current documents.

Historical documents are preserved for traceability and should not be rewritten as if they describe the latest state.

For repository-wide engineering rules, use `STEPBYSTEP.md`.
For the complete product/engineering operating contract, use `MASTERPROMPT.md`.
For current priorities, use `ROADMAP.md`.


## Documentation checkpoint — 2026-10-18

Start with the root README.md for public product scope and ROADMAP.md / MASTERPROMPT.md for current release constraints. Current ordering safety state is acceptingOrders=false. Use app/docs/architecture/PRICING-AND-COSTS.md and the Phase A audit for the spreadsheet-derived source of truth. Do not mark release ready until security rules, automated tests, build, Firebase Emulator and browser review have evidence.
