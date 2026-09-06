# Rabi Raster brand direction

The mark is a compact monochrome raster field: a stable Organic Field sample interpreted through the renderer's 4 × 4 ordered dither. Its uneven outside edge and square-cut counter connect the identity to the product without turning it into a literal letter badge.

Three deterministic variants were generated and reviewed at display and favicon scale:

- **Seed** had a strong solid core, but its accidental letter-like silhouette made it less ownable.
- **Notch** balances a dense base, a porous dither edge and one memorable square counter. This is the selected mark.
- **Drift** remained legible, but its symmetrical oval read as a generic raster texture.

The selected geometry uses seed `583`, pattern scale `0.82`, Organic Field and `shouldDither`. Coordinates are snapped to a 3-unit grid inside a 48 × 48 viewBox, so the mark stays crisp and recognizable at 40 px and remains distinct at 24 px. The mark uses one neutral color and no gradient, glow or photographic source.

## Assets

- `public/brand/mark.svg` is the light mark on a transparent canvas for the dark application header.
- `public/brand/mark-dark.svg` is the same geometry in dark ink for light surfaces.
- `public/favicon.svg` places the simplified light mark on the editor's `#171719` tile.
- `public/brand/wordmark.svg` pairs the dark mark with a neutral system sans wordmark for repository surfaces.
- `scripts/generate-brand.ts` is the source of truth for the deterministic geometry. Run `node --experimental-strip-types scripts/generate-brand.ts` from the project root after changing a candidate.

Keep clear space around the mark equal to one raster cell. Do not smooth, recolor by cell, add a container behind the transparent mark, or rebuild the geometry by tracing a bitmap.
