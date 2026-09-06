# Rabi Raster gallery

This directory holds screenshots and exported examples used by the project documentation.

## Editor

![Rabi Raster editor showing a generated Organic Field composition](editor.png)

This is an actual application screenshot with a generated source. No uploaded photo or mockup is used.

## Compare patterns and renderers

The [visual choice guide](choice-guide.md) shows all eight generators and five renderers, with short descriptions and practical starting points. Renderer examples use the same generated source.

## Try an exported loop

With the development server running, open the [interactive transparency example](http://127.0.0.1:5199/docs/examples/preview.html). It compares three resolution and quality settings for the same loop on a checkerboard, alongside a PNG reference. The [example files](../examples/) are included in this repository.

To create your own result, return to the editor, choose a source and style, adjust motion, and export. Save the settings JSON next to the output to keep the recipe.

## Future examples

Add a small, curated set that demonstrates meaningfully different workflows:

- a photo interpreted with Halftone or Dot Matrix
- a generated transparent WebM with its PNG fallback
- an ASCII or Dither composition
- a Contour Particles example built from a clean silhouette

Pair animated examples with a still preview so readers can understand the result when motion is unavailable. Do not commit uploaded source photos unless their publication rights are clear. Settings JSON files do not contain image data, so keep any permitted source image next to the recipe when reproducibility matters.

Use lowercase, descriptive file names such as `photo-dot-matrix.png` or `ribbon-transparent.webm`. Link gallery files with relative paths so they work in GitHub and local documentation previews.
