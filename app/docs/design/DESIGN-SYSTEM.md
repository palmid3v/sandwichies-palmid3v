# Sandwichies Design System — Night Deli

The product has one permanent dark theme. It pairs a warm neighborhood sandwich shop with restrained 1980s sign-paint accents and modern, readable controls. The detailed visual specification is in [`../VISUAL-DESIGN-SYSTEM.md`](../VISUAL-DESIGN-SYSTEM.md).

## Foundations

- Page background: charcoal `#100f0d`.
- Deep surface: espresso `#191714`.
- Card/control surface: `#211e19`; raised option: `#2b2620`.
- Main text: warm cream `#fff1da`; secondary text: `#c5b8a6`.
- Primary action/focus: mustard `#f0c45f`.
- Supporting accents: tomato `#f07859`, mint `#88c79a`, lime `#b7dc78`.
- Display typography: Fraunces. Interface/body: DM Sans.

Use CSS semantic tokens from `src/index.css` and the visual override layer `src/styles/visual-system.css`. Avoid page-specific light surfaces or arbitrary new color palettes.

## Components

Primary actions use mustard with espresso text. Secondary actions use dark fills and warm borders. Focus rings are clearly visible. Inputs use dark native controls, legible placeholders, and dark autofill. Product cards prioritize food image, product name, price, and action. Admin cards and lists retain the same surface and status language as the storefront.

## Responsive and accessibility

Start at phone widths; retain at least 44 px touch targets and 48 px for primary fields/actions where practical. Do not rely on hover for state. Keep selection, disabled and error meaning textually clear. Respect `prefers-reduced-motion`. Do not compress admin tables until unreadable; use responsive card/list presentation.

## Dark-only behavior

`color-scheme: dark` is enforced at document and native-control level and in legacy style roots. No light theme or theme switch is part of the product.
