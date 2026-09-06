import { expect, test } from '@playwright/test';
import { captureUnexpectedConsoleErrors, expectNoUnexpectedConsoleErrors } from './raster-test-helpers';

test('transparent VP9 roundtrip preserves accent colors and matrix brightness RGB', async ({ page }) => {
  const consoleErrors = captureUnexpectedConsoleErrors(page);
  await page.goto('/src/export/index.ts');

  const proof = await page.evaluate(async () => {
    const { exportVideo, getVideoExportCapabilities } = await import('/src/export/index.ts');
    const { renderRasterFrame } = await import('/src/raster/render.ts');
    const { DEFAULT_RASTER_SETTINGS } = await import('/src/raster/settings.ts');
    const capabilities = await getVideoExportCapabilities({ transparent: true, width: 320, height: 180 });
    if (!capabilities.webm.supported) return { capabilities, unsupported: true as const };

    const makeSource = (gradient: boolean) => {
      const width = 64;
      const height = 36;
      const data = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const offset = (y * width + x) * 4;
          const gray = gradient ? Math.round((x / (width - 1)) * 230) : 0;
          data[offset] = gray;
          data[offset + 1] = gray;
          data[offset + 2] = gray;
          data[offset + 3] = 255;
        }
      }
      return new ImageData(data, width, height);
    };
    const colorDistance = (
      pixels: Uint8ClampedArray,
      offset: number,
      color: readonly [number, number, number],
    ) => Math.hypot(
      pixels[offset] - color[0],
      pixels[offset + 1] - color[1],
      pixels[offset + 2] - color[2],
    );
    const loadNativeFrame = async (blob: Blob, width: number, height: number) => {
      const url = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.src = url;
      await new Promise<void>((resolve, reject) => {
        video.addEventListener('loadeddata', () => resolve(), { once: true });
        video.addEventListener('error', () => reject(video.error ?? new Error('Video decode failed.')), { once: true });
      });
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) throw new Error('Canvas 2D is unavailable.');
      context.drawImage(video, 0, 0);
      const data = context.getImageData(0, 0, width, height).data;
      URL.revokeObjectURL(url);
      return data;
    };
    const renderReference = (
      settings: typeof DEFAULT_RASTER_SETTINGS,
      source: ImageData,
      width: number,
      height: number,
    ) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) throw new Error('Canvas 2D is unavailable.');
      renderRasterFrame(context, { width, height, settings, source, phase: 0 });
      return context.getImageData(0, 0, width, height).data;
    };

    const width = 320;
    const height = 180;
    const accentSource = makeSource(false);
    const accentColors = [[255, 117, 237], [255, 52, 47]] as const;
    const foreground = [24, 244, 92] as const;
    const accentSettings = {
      ...DEFAULT_RASTER_SETTINGS,
      source: 'image' as const,
      mode: 'matrix' as const,
      tone: 'opacity' as const,
      motion: 'off' as const,
      fade: 'none' as const,
      columns: 40,
      cutoff: 0,
      foreground: '#18f45c',
      accentColor: '#ff75ed',
      accentColor2: '#ff342f',
      accentAmount: 1,
      paletteSeed: 83,
    };
    const accentResult = await exportVideo({
      width,
      height,
      settings: accentSettings,
      source: accentSource,
      duration: 1,
      background: '#000000',
      format: 'webm',
      transparent: true,
      frameRate: 24,
      quality: 'high',
      fileName: 'multicolor-roundtrip',
    });
    const accentDirect = renderReference(accentSettings, accentSource, width, height);
    const accentDecoded = await loadNativeFrame(accentResult.blob, width, height);
    const accentSamples = accentColors.map(() => ({ count: 0, targetError: 0, foregroundError: 0 }));
    let transparentPixels = 0;
    let visiblePixels = 0;
    for (let offset = 0; offset < accentDirect.length; offset += 4) {
      if (accentDecoded[offset + 3] === 0) transparentPixels += 1;
      else visiblePixels += 1;
      if (accentDirect[offset + 3] < 240 || accentDecoded[offset + 3] < 160) continue;
      accentColors.forEach((color, colorIndex) => {
        if (colorDistance(accentDirect, offset, color) > 8) return;
        const sample = accentSamples[colorIndex];
        sample.count += 1;
        sample.targetError += colorDistance(accentDecoded, offset, color);
        sample.foregroundError += colorDistance(accentDecoded, offset, foreground);
      });
    }
    const accents = accentSamples.map((sample) => ({
      count: sample.count,
      meanTargetError: sample.targetError / sample.count,
      meanForegroundError: sample.foregroundError / sample.count,
    }));

    const brightnessSource = makeSource(true);
    const brightnessSettings = {
      ...accentSettings,
      tone: 'brightness' as const,
      foreground: '#ffffff',
      accentAmount: 0,
    };
    const brightnessResult = await exportVideo({
      width,
      height,
      settings: brightnessSettings,
      source: brightnessSource,
      duration: 1,
      background: '#000000',
      format: 'webm',
      transparent: true,
      frameRate: 24,
      quality: 'high',
    });
    const brightnessDirect = renderReference(brightnessSettings, brightnessSource, width, height);
    const brightnessDecoded = await loadNativeFrame(brightnessResult.blob, width, height);
    const directLuma: number[] = [];
    const decodedLuma: number[] = [];
    let lumaAbsoluteError = 0;
    for (let offset = 0; offset < brightnessDirect.length; offset += 4) {
      if (brightnessDirect[offset + 3] < 240 || brightnessDecoded[offset + 3] < 160) continue;
      const direct = brightnessDirect[offset] * .2126
        + brightnessDirect[offset + 1] * .7152
        + brightnessDirect[offset + 2] * .0722;
      const decoded = brightnessDecoded[offset] * .2126
        + brightnessDecoded[offset + 1] * .7152
        + brightnessDecoded[offset + 2] * .0722;
      directLuma.push(direct);
      decodedLuma.push(decoded);
      lumaAbsoluteError += Math.abs(decoded - direct);
    }
    directLuma.sort((a, b) => a - b);
    decodedLuma.sort((a, b) => a - b);
    const percentileRange = (values: number[]) =>
      values[Math.floor(values.length * .9)] - values[Math.floor(values.length * .1)];

    return {
      unsupported: false as const,
      capabilities,
      accentBlobBytes: accentResult.blob.size,
      accentFrameCount: accentResult.frameCount,
      accents,
      brightness: {
        decodedLumaRange: percentileRange(decodedLuma),
        directLumaRange: percentileRange(directLuma),
        meanLumaError: lumaAbsoluteError / directLuma.length,
        sampleCount: directLuma.length,
      },
      transparentPixels,
      visiblePixels,
    };
  });

  test.skip(proof.unsupported, proof.capabilities.webm.reason ?? 'Transparent VP9 encoding is unavailable.');
  if (proof.unsupported) return;

  console.log(JSON.stringify({ multicolorTransparentWebmBytes: proof.accentBlobBytes }));
  expect(proof.accentBlobBytes).toBeGreaterThan(1_000);
  expect(proof.accentFrameCount).toBe(24);
  expect(proof.transparentPixels).toBeGreaterThan(1_000);
  expect(proof.visiblePixels).toBeGreaterThan(1_000);
  for (const accent of proof.accents) {
    expect(accent.count).toBeGreaterThan(100);
    expect(accent.meanTargetError).toBeLessThan(80);
    expect(accent.meanTargetError).toBeLessThan(accent.meanForegroundError);
  }
  expect(proof.brightness.sampleCount).toBeGreaterThan(1_000);
  expect(proof.brightness.directLumaRange).toBeGreaterThan(80);
  expect(proof.brightness.decodedLumaRange).toBeGreaterThan(50);
  expect(proof.brightness.meanLumaError).toBeLessThan(45);
  await expectNoUnexpectedConsoleErrors(consoleErrors);
});
