import { expect, test } from '@playwright/test';
import { captureUnexpectedConsoleErrors, expectNoUnexpectedConsoleErrors } from './raster-test-helpers';

test('SVG is valid standalone vector markup and rasterizes like the PNG frame', async ({ page }) => {
  const consoleErrors = captureUnexpectedConsoleErrors(page);
  await page.goto('/src/export/svg.ts');

  const proof = await page.evaluate(async () => {
    const { exportSvg } = await import('/src/export/svg.ts');
    const { exportImage } = await import('/src/export/image.ts');
    const { DEFAULT_RASTER_SETTINGS } = await import('/src/raster/settings.ts');
    const width = 240;
    const height = 120;
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    for (let index = 0; index < pixels.length; index += 4) pixels[index + 3] = 255;
    const options = {
      width,
      height,
      settings: {
        ...DEFAULT_RASTER_SETTINGS,
        source: 'image' as const,
        mode: 'halftone' as const,
        mark: 'circle' as const,
        motion: 'off' as const,
        fade: 'none' as const,
        columns: 40,
        foreground: 'rgba(255, 32, 78, 0.6)',
      },
      source: new ImageData(pixels, 4, 4),
      phase: 0.42,
      background: '#102030',
      transparent: false,
      fileName: 'browser-proof',
    };

    const [svgResult, pngResult] = await Promise.all([exportSvg(options), exportImage(options)]);
    const markup = await svgResult.blob.text();
    const document = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const root = document.documentElement;
    const matrixResult = await exportSvg({
      ...options,
      settings: {
        ...options.settings,
        mode: 'matrix' as const,
        tone: 'brightness' as const,
        cutoff: 0,
        foreground: 'oklch(70% 0.2 20 / 0.35)',
      },
      transparent: true,
    });
    const matrixMarkup = await matrixResult.blob.text();
    const matrixDocument = new DOMParser().parseFromString(matrixMarkup, 'image/svg+xml');
    const matrixPaints = Array.from(matrixDocument.querySelectorAll('circle'))
      .map((circle) => circle.getAttribute('fill') ?? '');
    const matrixAlpha = Number(matrixPaints[0]?.match(/,\s*([\d.]+)\)$/)?.[1]);

    const decode = async (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = window.document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas 2D is unavailable.');
        context.drawImage(image, 0, 0, width, height);
        return context.getImageData(0, 0, width, height).data;
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    const [svgPixels, pngPixels] = await Promise.all([decode(svgResult.blob), decode(pngResult.blob)]);
    let totalDifference = 0;
    let opaqueSvgPixels = 0;
    for (let index = 0; index < svgPixels.length; index += 1) {
      totalDifference += Math.abs(svgPixels[index] - pngPixels[index]);
      if (index % 4 === 3 && svgPixels[index] === 255) opaqueSvgPixels += 1;
    }

    return {
      averageChannelDifference: totalDifference / svgPixels.length,
      elementCount: svgResult.elementCount,
      embeddedImages: root.querySelectorAll('image').length,
      fileName: svgResult.fileName,
      height: root.getAttribute('height'),
      matrixAlpha,
      matrixCircleCount: matrixPaints.length,
      matrixNormalized: matrixPaints.every((paint) => paint.startsWith('rgba(')),
      matrixRawWideGamut: /oklch\(|color\(display-p3/i.test(matrixMarkup),
      opaqueSvgPixels,
      parserErrors: document.querySelectorAll('parsererror').length,
      scripts: root.querySelectorAll('script').length,
      viewBox: root.getAttribute('viewBox'),
      width: root.getAttribute('width'),
    };
  });

  expect(proof.parserErrors).toBe(0);
  expect(proof.scripts).toBe(0);
  expect(proof.embeddedImages).toBe(0);
  expect(proof.fileName).toBe('browser-proof.svg');
  expect([proof.width, proof.height, proof.viewBox]).toEqual(['240', '120', '0 0 240 120']);
  expect(proof.elementCount).toBeGreaterThan(100);
  expect(proof.matrixCircleCount).toBeGreaterThan(100);
  expect(proof.matrixNormalized).toBe(true);
  expect(proof.matrixRawWideGamut).toBe(false);
  expect(proof.matrixAlpha).toBeCloseTo(0.35, 2);
  expect(proof.opaqueSvgPixels).toBe(240 * 120);
  expect(proof.averageChannelDifference).toBeLessThan(2);
  await expectNoUnexpectedConsoleErrors(consoleErrors);
});
