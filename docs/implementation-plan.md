# Rabi Raster implementation plan

## Product

Rabi Raster is a local image lab for producing portfolio-ready raster graphics and seamless motion loops. It supports Waves, Ring, Noise, Contours, Orbits, Interference, Ribbon and Organic Field generators plus a locally decoded photo, and renders halftone, dither, ASCII, Dot Matrix or Contour Particles output.

The application is a focused 2D editor. It has no layers, keyframes, backend, API, analytics, account, or cloud upload.

## Architecture

- React 19 and Vite 8 host a single responsive workspace.
- DialKit 2.0.0 runs in inline mode with `productionEnabled` and a stable `useDialKitController` id. The controller is the only source of truth for editable raster values.
- `src/raster/render.ts` provides the deterministic `renderRasterFrame` engine shared by preview and export.
- A product-owned animation clock provides play, pause, scrub, replay, and a seamless phase in `[0, 1)`. This is one output loop, not a clip editor.
- `src/export/**` owns SVG/PNG and WebM/MP4 blob creation. The UI requests exports, reports progress, and downloads returned blobs.
- Image files are decoded once when selected and held only in memory. Binary image data is never persisted or sent to a server.

## Interface

- Neutral dark workspace with a restrained type scale and violet output accent.
- Header branding: `Rabi Raster` and `by Rabituza Studio`, with an Organic Field-derived raster mark.
- Main preview is responsive while preserving the selected logical output ratio.
- Inline DialKit controls are grouped as Source, Effect, Particles, Palette, Motion, and Output.
- Eight style presets update effect controls through the DialKit controller: Dot Matrix, Contour Particles, Soft Dots, Rounded Dots, Signal Dither, Mono Grid, Type Field and Large Cells. Sources, palettes, motion and output are preserved.
- The bottom transport exposes play/pause, restart, current time, scrubber, and a 6 second duration control.
- Output tools expose 1600 × 900, square, and portrait canvases, export scale, background/transparent PNG, WebM/MP4 choice, PNG export, loop export, and truthful status.
- Settings JSON save/load includes only small editor values and output preferences. Reset restores defaults and clears the in-memory image.

## Accessibility and motion

- All custom buttons and inputs have visible labels, keyboard behavior, focus states, and adequate hit targets.
- The preview canvas has an accessible name and status is announced politely.
- `prefers-reduced-motion` starts the loop paused. The user can still play or scrub explicitly.

## Verification

- Build with TypeScript and Vite.
- Run focused Vitest coverage for settings/renderer integration as available.
- Browser proof covers preset changes, local image lifecycle, playback/scrub, settings import/export, reset, PNG output, video progress/capability behavior, and responsive canvas backing.


## Reference-inspired extension (approved 2026-09-06, implemented and verified)

- Dot Matrix: fixed mark diameter with opacity/brightness tone and visibility cutoff.
- Contour Particles: edge-anchored points, sensitivity, spacing irregularity and independent distribution seed. Photo processing stays local; contour extraction is cached.
- Ribbon and Organic Field generators; ribbon count, width and twist.
- Two accent colors, proportion and stable palette seed. Randomize accents and Randomize points own only their settings, with Undo. Existing styles continue to preserve photo, palette, motion and output.
- Transparent multicolor WebM must retain RGB and alpha; keep the monochrome export fast path.
- Editable static SVG frame alongside PNG and loop exports. This does not export hover code or a 3D scene. SVG text remains text with a monospace fallback.
- Verification: settings migration/roundtrip/undo; stable contour anchors and loop seams; new generators; browser UI photo/style/randomization; multicolor transparent native-video roundtrip; SVG geometry, XML escaping and alpha; production build.
