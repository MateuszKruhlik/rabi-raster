# Rabi Raster verification

## Current status, 2026-09-07

Current local verification covers the working tree, including the relative brand-asset path used by production builds:

- `npm test`: PASS, 5 files and 48 tests.
- `npm run build`: PASS, TypeScript and Vite production build; 513 modules transformed. The editor bundle is 713.88 kB minified and 213.88 kB gzip. Vite reports a non-blocking large-chunk warning.
- `npm run test:browser`: PASS, 20 Playwright tests in Chromium.
- Production static smoke: PASS at `/` and `/playground/rabi-raster/app/`; the brand image returned HTTP 200 and loaded with a non-zero natural width at both paths.

Baseline GitHub validation for commit `bd2923358788122e84bb33c6796873bb66d3b85e` is recorded in [GitHub Actions run 34057169701](https://github.com/matikkutik/rabi-raster/actions/runs/34057169701). Unit tests and the production build passed, followed by 20 Chromium browser tests. Local changes made after that commit are not covered by this run. After pushing a new commit, use the repository's [CI workflow](https://github.com/matikkutik/rabi-raster/actions/workflows/ci.yml) to verify its result.

Automated browser coverage is currently Chromium-only. Safari and Firefox verification was deferred by the owner on 2026-09-07 and must not be treated as passed. In particular, transparent VP9 WebM playback still needs a PNG fallback for Safari.

## Historical verification record

The sections below preserve evidence from successive checks on 2026-09-06. Their test counts and bundle sizes describe those stages, not the current status above.

## Initial automated baseline, 2026-09-06

- `npm test`: PASS, 3 files and 29 tests, final run at 16:41 local time.
- `npm run build`: PASS, TypeScript and Vite production build; 505 modules transformed. Vite reports one non-blocking large-chunk warning for the 697.72 kB editor bundle. The editor is not included in exported media.
- `npm run test:browser`: PASS, 11 Playwright tests in 28.1 s, no skipped tests.

The browser suite proves:

- all three raster renderers, procedural sources, halftone marks, density, contrast/invert/color, motion/amplitude, text-space fades, and ASCII glyph edits change real canvas pixels;
- a local PNG upload replaces the empty image state, renders source pixels, enables export, and is absent from persisted settings;
- selected settings survive a real page reload, and the forward timeline advances and wraps at the edited duration;
- PNG downloads decode with the requested dimensions, image-source ink, transparency, and fully opaque output when transparency is off, including a semi-transparent CSS background color;
- video output contains 180 changing, decoded frames over 6 seconds with a 30 FPS 33/34 ms packet cadence, selected opaque background, progress from 0 to 1, and cancellation before or during encoding;
- each format reported as supported creates its real container. This Chromium run supported WebM with VP9 and MP4 with AVC; each one-second probe contained 30 packets;
- UI export actions downloaded a 1080 x 1350 PNG and a 60-frame, 2-second loop without browser console errors.
- all six procedural sources produce distinct real canvas pixels; mark size changes coverage independently of grid density; randomized settings reproduce the same canvas after reload;
- legacy settings migrate to seed 1, pattern scale 1, mark size 1 and High / 30 fps without losing existing values;
- transparent WebM contains 24 alpha packets per second, native HTMLVideoElement playback preserves empty pixels and moving ink, and a translucent foreground remains close to the phase-matched renderer reference after compositing;
- MP4 is explicitly rejected and disabled when a transparent background is selected.

## Initial manual browser QA, 2026-09-06

The root session also checked presets and renderer modes, pause/restart, a 390 x 844 mobile viewport, a 1600 x 900 PNG, and a 6-second WebM with 180 frames through the live UI. No console warning or error was observed, and the product styles contain no Google Fonts imports.

For the transparency update, root inspected screenshots of Contours, Orbits and Interference, then compared all three final WebM assets against an original transparent PNG in a native video gallery. All three videos played, reported duration 6 seconds and had no media error. The gallery also verifies the reference PNG loads and the checkerboard is visible through the video background. See `docs/examples/preview.html` while the local server is running.

## File size and visual fidelity, 2026-09-06

Measured in Chromium for the same default Waves scene, 6 seconds, transparent background. MB and kB use decimal units. PSNR compares the first native decoded frame with the original renderer on a navy background; it is a bounded quality measurement for this scene, not a guarantee for every pattern or frame.

| Export | Actual bytes | Display size | Composite PSNR | Alpha mean absolute error, 0–255 |
| --- | ---: | ---: | ---: | ---: |
| Web, 24 fps, 800 × 450 | 392,428 | 392 kB | 35.684 dB | 3.113 |
| Web, 24 fps, 1600 × 900 | 1,283,187 | 1.28 MB | 37.755 dB | 1.945 |
| High, 30 fps, 1600 × 900 | 3,206,945 | 3.21 MB | 44.332 dB | 0.876 |

The separate benchmark passed 3/3 and requires PSNR above 32 dB and alpha MAE below 5 for each sample. It is deliberately excluded from the normal browser suite because it regenerates example artifacts:

```sh
npx playwright test --config scripts/benchmarks/playwright.config.ts
```

Transparent export uses raw RGBA VideoSample input. CanvasSource introduced premultiplied RGB in the tested Chromium path, darkening fading marks when the separately encoded alpha was applied at playback. The fix retains straight alpha and fills invisible RGB with the renderer's single foreground color, which also avoids dark chroma fringes and reduces color-plane complexity. A native video regression with a translucent foreground checks composited pixel fidelity, rather than merely inspecting container metadata.

Transparent playback is verified in Chromium. The [open WebKit VP9 alpha issue](https://bugs.webkit.org/show_bug.cgi?id=275908) remains a reason to validate Safari separately and keep a static PNG fallback. See [website use](website-use.md).

## Evidence paths

- Automated HTML report: `playwright-report/index.html`
- Latest run status: `test-results/.last-run.json`
- Browser specifications: `e2e/raster-export.spec.ts`, `e2e/raster-ui.spec.ts`, `e2e/transparent-export.spec.ts`
- Separate quality benchmark: `scripts/benchmarks/transparent-export.benchmark.ts`
- Actual media samples and visual comparison: `docs/examples/`
- Production output: `dist/`

No portfolio page-load performance audit or publication was run. Media sizes were measured; whole-site performance was not.

## Independent image, style and motion controls, 2026-09-06

The photo regression now uploads an image, applies Mono Grid, verifies image/motion/palette/output remain selected, varies motion and look separately, and checks exact canvas restoration after each undo. Pulse and Scatter & return change the frame at mid-loop and return exactly at the cycle boundary. The same photo exports PNG and a transparent 48-frame, 2-second WebM. The extended focused regression passed separately in 5.4 s after the final control layout change. Unit coverage includes strict preset ownership, reversible independent variation groups, legacy motion defaults, image motion seed independence, pulse and scatter seam behavior.


## Reference-inspired effects, multicolor alpha and SVG, 2026-09-06

Final integrated verification after engine and UI review:

- `npm test`: 48/48 tests in 5 files passed.
- `npm run test:browser`: 15/15 Chromium tests passed in 27.7 seconds, no skipped codec tests in this run.
- `npm run build`: TypeScript and Vite passed (508 modules). JS 715.78 kB / 213.63 kB gzip; existing chunk-size warning remains non-blocking. This editor bundle is not a portfolio embed.
- UI regression uploads a synthetic JPG silhouette, applies Dot Matrix and Contour Particles while retaining Image, changes tone, independently randomizes/undoes points and accents, and downloads vector SVG.
- Ribbon and Organic Field change over time, survive reload and wrap. Unit tests also check near-boundary continuity, since exact phase 0 == 1 alone cannot detect a jump immediately before the wrap.
- Contour tests verify stable cached anchors, spacing, sensitivity direction, alpha silhouettes and no dependency on the Dot Matrix cutoff. Per-image cache is bounded; spacing uses spatial buckets. ImageData is treated as immutable, as in the current uploader.
- SVG XML parses, contains vector primitives without embedded image/script/external paint references, and rasterizes within average channel difference 2 of PNG in the browser test. Wide-gamut CSS input is normalized in brightness mode and retains alpha. ASCII remains text and depends on available fonts.
- Native video roundtrip retains both accent colors and matrix brightness with transparency. The 320 x 180, 1-second, High/24 fps multicolor sample is 26,061 bytes; this is a small fixture, not a portfolio size guarantee.
- Monochrome benchmark separately remained 3/3: the existing 800 x 450 Web, 1600 x 900 Web and High samples retained their previous bytes and PSNR. Multicolor uses a bounded 2-pixel RGB bleed only into fully transparent pixels; visible RGB and all alpha bytes stay unchanged before encoding.
- CUA visual review: new Ribbon forms intersecting strands rather than parallel rows. Existing photo, palette, motion and output stay independent when selecting styles.

New coverage: `e2e/reference-effects.spec.ts`, `e2e/multicolor-export.spec.ts`, `e2e/svg-export.spec.ts`, plus unit tests in raster, settings, SVG and transparent pixel preparation. No hover component, 3D scene, Git commit or publication was performed. Safari alpha compatibility and whole-site performance remain outside this Chromium verification.


## Identity and editor review, 2026-09-06

- New Organic Field-derived SVG brand assets and eight static renderer previews were reviewed visually. Previews use no photo data and have no animation loop.
- Unit suite: 48/48 passed. Production build: passed (509 modules; existing large-chunk advisory remains).
- Final Chromium suite after UI integration: 17/17 passed in 30.8 seconds. This includes source/style persistence, all randomization targets with Undo, PNG/SVG/video exports, and two new design regression tests.
- Distinct previews and clearing stale selected-style state are covered by browser tests. Disabled targets explain the missing renderer/movement/source.
- Desktop at 1440×900 and 1280×720 keeps Export loop in the viewport. Widths 390 and 320 have no horizontal document overflow. Desktop/mobile screenshots were inspected.
- The gallery editor image is a real deterministic generated-source screenshot, without private photos.
- Local Git repository initialized on main. No remote created, no push, no public release. The included CI workflow has not run on GitHub.


## Visual pattern and renderer menus, 2026-09-06

- Pattern: eight actual generator thumbnails plus an Image option with a local-file illustration. Renderer: five actual thumbnails using one common generated source. No source photograph or video is loaded by these menus.
- Short descriptions appear both in the options and beneath the selected field. They wrap on narrow screens. Canvas previews mount only with the menu; computed pixels are cached for reuse.
- Product-owned menu components use DialKit's public store and render the other controls through its public Folder/ControlRenderer components. No DOM patching or duplicate settings store.
- Verified Home/End, arrow keys, typeahead, selection, Escape focus restoration, Tab exit, outside interaction and a 320px viewport. Fixed a race between scroll-to-trigger and initial popup opening; the popup now repositions on ancestor scroll. Desktop and mobile screenshots inspected.
- Final unit suite 48/48, Chromium suite 20/20 in 21.5 seconds, production build passed. Existing large-chunk advisory remains; JS gzip 213.87 kB and CSS gzip 12.86 kB.
- Thirteen standalone SVG examples generated for the documentation gallery and parsed as valid XML. The gallery assets are outside the app bundle and are not fetched by the editor.
