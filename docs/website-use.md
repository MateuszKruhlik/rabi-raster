# Using Rabi Raster assets on a website

## Start with a measured export

For a subtle portfolio background, start with WebM, Web quality, 24 fps, 1× resolution and a 4–6 second loop. Try 0.5× when the artwork occupies a small area. Compare fine marks at their intended display size before choosing the smaller file. Use 30 fps for faster motion and High quality when compression visibly damages thin marks or ASCII characters. 2× is available, but creates four times as many pixels as 1× and is rarely the first choice for a full-screen background.

The size shown after export is the actual file size. It is not a forecast. Dense noise, fine grids and rapid movement can compress less efficiently than sparse, gently moving marks. There is no single setting that guarantees both maximum fidelity and the smallest file for every pattern.

## Transparency

Turn Transparent on to leave the canvas background empty. The checkerboard is an editor aid and is not exported. Foreground opacity controls the marks, while Transparent controls whether a background is included.

- PNG retains alpha and is suitable for a still overlay or fallback.
- WebM uses VP9 with a separately encoded alpha channel through Mediabunny. This is a real transparent video, not a solid color that must be keyed out.
- MP4 uses AVC and needs an opaque background in this tool. Its export is disabled while Transparent is on.
- Chromium playback is tested. Safari/WebKit has an [open VP9 transparency issue](https://bugs.webkit.org/show_bug.cgi?id=275908), so ordinary WebM codec support alone does not establish alpha support. Use a transparent PNG fallback for unverified targets, or prepare and test a separate HEVC-with-alpha asset for Safari. This tool does not export HEVC alpha.

## Page loading and motion

Only the exported media needs to go on the portfolio. Do not ship the Rabi Raster editor, React or DialKit with it.

Use a decorative video without audio or controls, with muted, loop and playsinline behavior. Size its box before loading so it does not shift surrounding content. For videos below the first screen, defer assigning the video URL until the element approaches the viewport; preload="none" by itself does not prevent an autoplay video from loading. Pause off-screen and hidden-tab playback.

For visitors who prefer reduced motion, show the PNG and avoid fetching the loop until they explicitly request motion. Validate the fallback in the actual portfolio, including when video cannot play. Keep the hero's text and meaningful content independent of the decorative asset.

These are integration recommendations, not implemented portfolio changes. See Google's guidance on [video loading](https://web.dev/articles/lazy-loading-video) and [video performance](https://web.dev/learn/performance/video-performance).

## Make a custom pattern

Choose a generated source, then change Seed for a new composition and Pattern scale for broader or finer structure. Density sets the number of grid columns; Mark size controls the thickness of each mark without moving the grid. Choose Halftone, Dither or ASCII to reinterpret the same field. Set a color, motion and duration, then save settings.

Alternatively, open Source, set Pattern to Image, then choose a locally drawn texture, logo or photograph in Image. Dark areas become ink by default; Invert reverses that mapping. Source alpha is retained. Settings files deliberately omit image bytes, so keep the original image alongside the settings and select it again after loading them.


## Reference effects and vector frames

- Dot Matrix changes opacity or brightness while keeping mark size fixed. Opacity adapts to the underlying page; brightness preserves the mark RGB regardless of background, except for antialiasing and any explicit alpha.
- Contour Particles finds edges rather than removing the background. Use a clean source or a transparent silhouette for clearer outlines. Increase edge sensitivity for quieter details; use Randomize points to vary distribution without replacing the photo.
- The Palette folder enables two stable accent colors. Their seed does not change every frame. Multicolor WebM must preserve the RGB plane, so previous monochrome file-size measurements do not predict its size.
- SVG exports the selected static frame as vector marks, including the selected background unless Transparent is on. No screenshot or source image is embedded. ASCII text uses a system monospace stack and can render differently elsewhere. For a fixed photographic rendering, use PNG.
- SVG does not include a hover implementation. Keep settings JSON and a reference loop alongside the SVG; use the raster engine for large interactive point fields. Measure file size and runtime on the actual target page before choosing a format.
