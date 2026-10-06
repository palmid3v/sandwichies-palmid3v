# Sandwichies Design System — FASE 7

## Direction

Sandwichies uses a dark-first visual system designed around food, appetite and kitchen energy rather than generic SaaS patterns.

The interface should feel:
- warm without becoming pastel;
- tactile without becoming skeuomorphic;
- energetic without becoming noisy;
- premium enough for a curated food product;
- readable and fast on mobile.

## Color roles

| Token | Role |
| --- | --- |
| `--surface-0` | page background |
| `--surface-1` | controls / deep surfaces |
| `--surface-2` | cards and secondary surfaces |
| `--surface-3` | interactive option surfaces |
| `--ink` | primary readable text |
| `--muted` | secondary text |
| `--leaf` | headings and emphasis |
| `--tropical` | primary positive/action color |
| `--lime` | confirmation/accent |
| `--mango` | appetite/primary CTA accent |
| `--papaya` | secondary accent / attention |
| `--coral` | checkout / destructive emphasis |

The semantic role matters more than the literal color value. Components should use tokens instead of introducing new arbitrary colors.

## Typography

The baseline uses the system UI stack:

`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

Hierarchy:
- eyebrow: compact uppercase contextual label;
- heading: strong, compact, high contrast;
- body: readable with comfortable line-height;
- helper: muted and subordinate;
- price/total: visually prominent.

## Spacing

Primary spacing units are `4px` multiples:

`--space-1` through `--space-9`.

Prefer the token scale over one-off spacing values.

## Radius and elevation

- small controls: `--radius-sm`
- interactive cards: `--radius-md` / `--radius-lg`
- primary surfaces: `--radius-xl`
- pills/statuses: `--radius-pill`

Use `--shadow-sm` for normal surfaces, `--shadow-md` for elevated interactive controls, and `--shadow-lg` for overlays/important confirmation.

## Product-card language

Favorite products are represented as tactile cards with:
- clear product name;
- price anchor;
- selection state;
- confirmation mark;
- subtle food-oriented accent;
- hover/pressed feedback.

The canonical product definition remains in `app/shared/recipes.js`. UI components do not duplicate product definitions.

## Controls

Interactive controls should:
- use a minimum target around 48px where practical;
- show a clear selected state;
- expose a keyboard focus ring;
- support pressed/active feedback;
- avoid relying on color alone when possible.

## Food/product motifs

Current motifs include:
- bread/food hero photography;
- warm mango and papaya accents;
- green kitchen/ingredient tones;
- diagonal texture in hero surfaces;
- small ingredient-like accent dots and bars.

Motifs are restrained so product content remains dominant.

## Dark-first behavior

The active product system is intentionally dark-first. There is no automatic light theme introduced by FASE 7; this avoids maintaining two visual systems before the product needs one.

## Accessibility contrast rule

Text and controls must remain visibly distinguishable from their surface. Focus indication must remain visible independently from hover state. Selected controls should combine border/background/mark changes rather than relying on hue alone.

Reduced-motion behavior is defined in the FASE 8 interaction system.

## Mobile rules

Customer UX is mobile-first:
- controls stay touch-friendly;
- option grids collapse to a single column at narrow widths;
- the active builder total becomes a sticky bottom action surface;
- text remains readable without horizontal scrolling;
- interaction feedback remains visible without hover.
