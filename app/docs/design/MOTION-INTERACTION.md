# Sandwichies Motion & Interaction System — FASE 8

## Purpose

Motion exists to communicate action, state and continuity. It is not decoration.

## Timing

| Token | Target use |
| --- | --- |
| `--duration-fast` | micro feedback |
| `--duration-base` | buttons, cards, controls |
| `--duration-slow` | section/entry transitions |

Primary easing:
- `--ease-standard`: normal interaction;
- `--ease-emphasized`: entry and confirmation moments.

## Interaction states

### Hover

Desktop hover may:
- lift a card by a small amount;
- strengthen a border;
- reveal a subtle shimmer/accent.

Hover must not be required to understand the state.

### Focus

Keyboard focus uses a dedicated lime outline with offset so controls remain clearly discoverable.

### Pressed

Pressed state compresses interactive controls slightly and removes the hover lift.

### Selected

Selection changes:
- border;
- surface treatment;
- confirmation marker;
- semantic `aria-pressed` state where appropriate.

### Quantity

Quantity controls use a compact, high-contrast pill with a small pop animation when they appear. Quantity changes update the live count.

### Cart

New cart items use a short directional entry animation. Removing an item does not block the user or introduce a long transition.

### Feedback

Toast feedback communicates success/error immediately. Confirmation screens use a short success-scale animation.

### Modal

Order details use an entry animation plus backdrop fade. Escape remains available for keyboard users.

### Navigation

Route entry surfaces use the same low-amplitude rise pattern rather than a full-screen transition.

### Loading

Async actions reuse the same control surface and replace only the label/action text while disabled. The visual system reserves skeleton patterns for future data-heavy surfaces instead of adding skeletons where content is already local.

## Reusable patterns

Implemented reusable classes:
- `.motion-enter`
- `.motion-pop`
- `.motion-feedback`
- `.motion-shimmer`
- `.stagger-children`
- `.state-success`
- `.state-toast`
- `.state-cart-item`

These are imported globally through `app/src/styles/motion.css`.

## Reduced motion

When `prefers-reduced-motion: reduce` is active:
- animations are effectively removed;
- transitions become near-instant;
- hover/pressed movement is suppressed;
- smooth scrolling is disabled.

The interaction remains fully understandable without animation.
