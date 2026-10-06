# MASTERPROMPT AUDIT — Sandwichies

**Audit date:** 2026-10-05  
**Masterprompt:** `/MASTERPROMPT.md` v1.0  
**Scope:** Repository, architecture, security, quality gates, current customer/admin UX, visual direction, motion, product discovery, and roadmap readiness.

## Executive result

The Sandwichies Masterprompt is now installed as the project-specific operating contract.

The current repository is **not yet fully compliant with the Masterprompt**. The audit intentionally identifies the remaining gaps instead of marking future work as complete.

### Overall status

**FOUNDATION: PASS**  
**PRODUCT EXPERIENCE: IN PROGRESS**  
**RELEASE READINESS: BLOCKED**

---

## 1. Governance and documentation

| Requirement | Status | Evidence / action |
|---|---|---|
| Project Masterprompt | PASS | `MASTERPROMPT.md` created |
| README aligned | PASS | Product direction and control plane updated |
| CONTEXT aligned | PASS | Product/UX direction added |
| STEPBYSTEP aligned | PASS | New execution phases added |
| ROADMAP aligned | PASS | Product Experience Evolution phases added |
| Historical documentation preserved | PASS | Existing `v0.1` material retained |
| File placement rules | PASS | Existing placement contract retained |

---

## 2. Architecture and domain

| Requirement | Status |
|---|---|
| Shared catalog authority | PASS |
| Shared pricing authority | PASS |
| Shared recipes authority | PASS |
| Trusted order reconstruction | PASS |
| Server-owned order number | PASS |
| Server-owned financial values | PASS |
| Firestore restrictive baseline | PASS |
| Data Connect isolated from production | PASS |
| No mass restructuring required | PASS |

### Architectural decision

The current architecture should **not** be mass-restructured just to make folders look cleaner.

Existing files under `src/data`, `src/config`, and `src/utils` currently act as browser adapters around shared/domain logic in the areas already audited.

The Masterprompt therefore reinforces boundaries rather than forcing a directory rewrite.

---

## 3. Security and release quality

| Requirement | Status |
|---|---|
| Firebase Auth | PASS |
| Admin custom claim | PASS |
| Admin-only order reads/updates | PASS |
| Direct browser order creation denied | PASS |
| Direct counter access denied | PASS |
| Trusted callable order creation | PASS |
| Financial tampering validation | PASS |
| Firebase Emulator Rules tests | **MISSING** |
| Security regression suite in CI | **MISSING** |
| Dependency audit gate | **MISSING** |
| Browser smoke test | **MISSING** |
| Production smoke test | **MISSING** |
| Production verification | **PENDING** |
| Explicit release approval | **PENDING** |

These remain higher priority than product expansion.

---

# 4. UI/UX Masterprompt audit

## 4.1 Dark-first visual identity

**STATUS: NOT MET**

The current storefront is visually polished and food-oriented, but the active implementation is currently **light-first**:

- cream page background
- white/cream cards
- light form controls
- light admin interface

The existing palette has strong Sandwichies-specific colors, but it does not yet satisfy the new dark-first product direction.

### Required next phase

**Phase 7 — Sandwichies Visual System**

This phase must establish a true dark-first design language rather than simply changing backgrounds to black.

---

## 4.2 Motion and transitions

**STATUS: PARTIAL / EXISTS**

The current storefront already contains:

- entrance animations
- cart item animation
- quantity pop animation
- toast animation
- hover transitions
- button feedback
- modal animation
- responsive behavior
- `prefers-reduced-motion` support

This is a strong starting point.

However, there is not yet a documented **Sandwichies Motion System** governing these behaviors.

### Required next phase

**Phase 8 — Motion + Interaction System**

The existing animations should be consolidated into reusable rules rather than independently accumulated effects.

---

## 4.3 Product discovery

**STATUS: PARTIAL**

The customer experience already contains:

- favorite/curated sandwich recipes
- menu selection
- a recommended-products area

However, the current recommended section is explicitly a placeholder.

The product discovery experience therefore exists structurally but is not yet mature.

### Required next phase

**Phase 9 — Customer Discovery + Ordering UX**

---

## 4.4 Favorites

**STATUS: PARTIAL / EXISTS**

Authoritative favorites already exist in:

`app/shared/recipes.js`

Current recipes include:

- Turkey Finas Hierbas
- Explosivo
- Doble Jamón
- Spicy Mix
- Triple Stack
- Full House

The current system already allows a favorite recipe to be applied to the builder.

### Gap

The next evolution should move favorites from simple preset buttons toward a richer product-discovery experience.

Potential future concepts:

- featured
- popular
- new
- signature
- seasonal
- customer favorites

Do not duplicate product definitions in the UI.

---

## 4.5 New creations

**STATUS: NOT YET IMPLEMENTED**

There is currently no formal product-content system for:

- new creations
- seasonal creations
- limited releases
- experimental products

The architecture should be extended carefully when this work begins.

### Required phase

**Phase 10 — New Favorites + New Creations**

---

## 4.6 Mobile-first

**STATUS: PARTIAL / STRONG BASELINE**

The current storefront contains responsive breakpoints and mobile-specific layout behavior.

There is also reduced-motion support.

However, the complete customer journey still requires browser-level validation on mobile/responsive layouts.

### Required evidence

- customer mobile smoke test
- responsive ordering flow
- checkout interaction validation
- critical states

---

## 4.7 UI/UX system documentation

**STATUS: MISSING**

The repository currently lacks a dedicated current product-design specification covering:

- visual tokens
- typography
- component states
- spacing
- motion
- interaction patterns
- product discovery patterns

### Required documentation

Create current product documentation during Phases 7–10 rather than inventing a large design system before the first visual audit.

---

# 5. Product architecture assessment

## Current strength

Sandwichies already has an important foundation:

```
customer UI
    ↓
shared domain
    ↓
trusted Firebase function
    ↓
Firestore
```

This should remain intact while the visual/product layer evolves.

## Critical rule

New UI must consume canonical product/business data.

Do not create:

```
UI product data
+
shared product data
```

when the same concept already exists in `app/shared/`.

---

# 6. Current blockers

The following are the highest-priority unresolved Masterprompt items:

### P0/P1 — Engineering

1. Firebase Emulator Rules tests
2. Security regression suite
3. Dependency audit gate
4. Browser smoke coverage
5. Production smoke verification
6. Release approval path

### P1/P2 — Product

7. Dark-first visual system
8. Product discovery redesign
9. Motion system
10. New favorites/creations system
11. Current product-design documentation

---

# 7. New execution sequence

The project now follows:

```
PHASE 0
Governance + Masterprompt
        ↓
PHASE 1
Domain integrity
        ↓
PHASE 2
Security + Emulator
        ↓
PHASE 3
CI + dependency quality
        ↓
PHASE 4
Integration + browser smoke
        ↓
PHASE 5
Release verification
        ↓
PHASE 6
Business + inventory semantics
        ↓
PHASE 7
Sandwichies Visual System
        ↓
PHASE 8
Motion + Interaction System
        ↓
PHASE 9
Customer Discovery + Ordering UX
        ↓
PHASE 10
New Favorites + New Creations
        ↓
PHASE 11
Admin/Product Operations UX
        ↓
PHASE 12
Performance + Measurement
        ↓
PHASE 13
Product Expansion
```

---

# 8. What comes next

The next implementation cycle should **not immediately start adding random animations or new products**.

The correct order is:

1. Finish the remaining security/release quality gates.
2. Audit the existing customer UI screen by screen.
3. Define the Sandwichies visual language.
4. Convert the product to a genuine dark-first experience.
5. Establish reusable motion/interaction rules.
6. Redesign discovery around favorites, featured products and new creations.
7. Add the first new product experiences.
8. Validate the complete mobile customer journey.
9. Improve admin UX.
10. Measure the resulting experience.

---

# 9. Masterprompt execution verdict

**MASTERPROMPT INSTALLED:** YES

**DOCUMENTATION SYNCHRONIZED:** YES

**NEW PHASES DEFINED:** YES

**CURRENT PRODUCT FULLY COMPLIANT:** NO

**FOUNDATION READY FOR NEXT IMPLEMENTATION CYCLE:** YES

The purpose of this audit is to establish the next work, not to claim that unfinished work already exists.
