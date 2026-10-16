# Sandwichies asset library

This folder stores version-controlled visual assets used by the storefront. Keep source assets in Git rather than relying on external image URLs.

## Structure

- brand/: logos and brand marks.
- illustrations/: original vector illustrations and decorative artwork.
- ingredients/: ingredient illustrations and future ingredient photography.
- sandwiches/: recipe-specific images and future product photography.
- badges/: reusable labels such as Popular, Signature and New.

## Asset register

| File | Purpose | Format | Palette / notes | Status |
|---|---|---|---|---|
| illustrations/charcuteria-sandwich.svg | Retro sandwich artwork for the storefront hero | SVG vector | Bone rose, burgundy, terracotta, sage | Provisional original artwork |
| ../charcuteria-sandwich.svg | Existing hero artwork path retained for compatibility | SVG vector | Same as above | Legacy path; migrate references before removing |

## Asset guidelines

- Prefer SVG for simple illustrations and marks; optimize paths before adding complex SVGs.
- Prefer AVIF or WebP for photography, with appropriate dimensions and useful alt text.
- Keep source assets local to the app so the storefront does not depend on third-party URLs.
- Record source, license/usage rights, intended placement, and whether an asset is provisional or final.
- Use descriptive, lowercase kebab-case filenames.
- Replace provisional artwork with real product photos when available, without changing pricing or order logic.
