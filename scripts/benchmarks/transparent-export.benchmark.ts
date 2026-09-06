import path from 'node:path';
import { expect, test } from '@playwright/test';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const examples = path.join(projectRoot, 'docs/examples');
const artifacts = [
  { fileName: 'rabi-raster-waves-transparent-web-24fps.webm', frameRate: 24, quality: 'web', width: 1600, height: 900 },
  { fileName: 'rabi-raster-waves-transparent-high-30fps.webm', frameRate: 30, quality: 'high', width: 1600, height: 900 },
  { fileName: 'rabi-raster-waves-transparent-web-24fps-800x450.webm', frameRate: 24, quality: 'web', width: 800, height: 450 },
] as const;

for (const artifact of artifacts) {
  test(`native decode quality: ${artifact.fileName}`, async ({ page }) => {
    await page.route(`**/artifact/${artifact.fileName}`, async (route) => {
      await route.fulfill({ contentType: 'video/webm', path: path.join(examples, artifact.fileName) });
    });
    await page.goto('/src/export/index.ts');
    const downloadPromise = page.waitForEvent('download');
    await page.evaluate(async ({ fileName, frameRate, height, quality, width }) => {
      const { downloadBlob, exportVideo } = await import('/src/export/index.ts');
      const { DEFAULT_RASTER_SETTINGS } = await import('/src/raster/settings.ts');
      const result = await exportVideo({
        width,
        height,
        settings: DEFAULT_RASTER_SETTINGS,
        duration: 6,
        background: '#000000',
        format: 'webm',
        transparent: true,
        frameRate,
        quality,
        fileName,
      });
      downloadBlob(result.blob, result.fileName);
    }, artifact);
    const download = await downloadPromise;
    await download.saveAs(path.join(examples, artifact.fileName));

    const proof = await page.evaluate(async ({ fileName, width, height }) => {
      const { renderRasterFrame } = await import('/src/raster/render.ts');
      const { DEFAULT_RASTER_SETTINGS } = await import('/src/raster/settings.ts');
      const blob = await (await fetch(`/artifact/${fileName}`)).blob();
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.src = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        video.addEventListener('loadeddata', () => resolve(), { once: true });
        video.addEventListener('error', () => reject(video.error ?? new Error('Video decode failed.')), { once: true });
      });
      await new Promise<void>((resolve) => {
        video.addEventListener('seeked', () => resolve(), { once: true });
        video.currentTime = 0;
      });

      const decoded = document.createElement('canvas');
      decoded.width = width;
      decoded.height = height;
      const decodedContext = decoded.getContext('2d', { alpha: true });
      if (!decodedContext) throw new Error('Canvas 2D unavailable.');
      decodedContext.drawImage(video, 0, 0);

      const direct = document.createElement('canvas');
      direct.width = width;
      direct.height = height;
      const directContext = direct.getContext('2d', { alpha: true });
      if (!directContext) throw new Error('Canvas 2D unavailable.');
      renderRasterFrame(directContext, { width, height, settings: DEFAULT_RASTER_SETTINGS, phase: 0 });

      const decodedComposite = document.createElement('canvas');
      decodedComposite.width = width;
      decodedComposite.height = height;
      const decodedCompositeContext = decodedComposite.getContext('2d');
      if (!decodedCompositeContext) throw new Error('Canvas 2D unavailable.');
      decodedCompositeContext.fillStyle = '#14213D';
      decodedCompositeContext.fillRect(0, 0, width, height);
      decodedCompositeContext.drawImage(decoded, 0, 0);
      decodedComposite.id = 'benchmark-decoded-composite';
      decodedComposite.hidden = true;
      document.body.append(decodedComposite);

      const directComposite = document.createElement('canvas');
      directComposite.width = width;
      directComposite.height = height;
      const directCompositeContext = directComposite.getContext('2d');
      if (!directCompositeContext) throw new Error('Canvas 2D unavailable.');
      directCompositeContext.fillStyle = '#14213D';
      directCompositeContext.fillRect(0, 0, width, height);
      directCompositeContext.drawImage(direct, 0, 0);
      directComposite.id = 'benchmark-direct-composite';
      directComposite.hidden = true;
      document.body.append(directComposite);

      const decodedRgba = decodedContext.getImageData(0, 0, width, height).data;
      const directRgba = directContext.getImageData(0, 0, width, height).data;
      const decodedRgb = decodedCompositeContext.getImageData(0, 0, width, height).data;
      const directRgb = directCompositeContext.getImageData(0, 0, width, height).data;
      let alphaAbsoluteError = 0;
      let squaredError = 0;
      let decodedVisiblePixels = 0;
      let directVisiblePixels = 0;
      for (let index = 0; index < decodedRgba.length; index += 4) {
        alphaAbsoluteError += Math.abs(decodedRgba[index + 3] - directRgba[index + 3]);
        if (decodedRgba[index + 3] > 16) decodedVisiblePixels += 1;
        if (directRgba[index + 3] > 16) directVisiblePixels += 1;
        for (let channel = 0; channel < 3; channel += 1) {
          const difference = decodedRgb[index + channel] - directRgb[index + channel];
          squaredError += difference * difference;
        }
      }
      const pixelCount = width * height;
      const mse = squaredError / (pixelCount * 3);
      if (fileName === 'rabi-raster-waves-transparent-web-24fps.webm') {
        document.body.replaceChildren();
        document.body.style.margin = '0';
        const checkerboard = document.createElement('div');
        checkerboard.id = 'benchmark-native-compositor';
        checkerboard.style.width = '800px';
        checkerboard.style.height = '450px';
        checkerboard.style.backgroundColor = '#F5F1E8';
        checkerboard.style.backgroundImage = [
          'linear-gradient(45deg, #CBD5E1 25%, transparent 25%)',
          'linear-gradient(-45deg, #CBD5E1 25%, transparent 25%)',
          'linear-gradient(45deg, transparent 75%, #CBD5E1 75%)',
          'linear-gradient(-45deg, transparent 75%, #CBD5E1 75%)',
        ].join(',');
        checkerboard.style.backgroundPosition = '0 0, 0 8px, 8px -8px, -8px 0';
        checkerboard.style.backgroundSize = '16px 16px';
        video.style.display = 'block';
        video.style.width = '800px';
        video.style.height = '450px';
        checkerboard.append(video);
        document.body.append(checkerboard, decodedComposite, directComposite);
      } else {
        URL.revokeObjectURL(video.src);
      }
      return {
        alphaMae: alphaAbsoluteError / pixelCount,
        bytes: blob.size,
        compositePsnr: 10 * Math.log10((255 * 255) / mse),
        decodedVisiblePixels,
        directVisiblePixels,
        duration: video.duration,
      };
    }, artifact);

    console.log(JSON.stringify({ fileName: artifact.fileName, ...proof }));
    expect(proof.duration).toBeCloseTo(6, 3);
    expect(proof.decodedVisiblePixels).toBeGreaterThan(10_000);
    expect(proof.compositePsnr).toBeGreaterThan(32);
    expect(proof.alphaMae).toBeLessThan(5);

    if (artifact.fileName === 'rabi-raster-waves-transparent-web-24fps.webm') {
      await page.locator('#benchmark-native-compositor').screenshot({
        path: path.join(examples, 'rabi-raster-waves-transparent-web-24fps-native-video-checkerboard.png'),
      });
      for (const [canvasId, fileName] of [
        ['benchmark-decoded-composite', 'rabi-raster-waves-transparent-web-24fps-1600x900-decoded-frame0-on-navy.png'],
        ['benchmark-direct-composite', 'rabi-raster-waves-transparent-direct-frame0-1600x900-on-navy.png'],
      ] as const) {
        const downloadPromise = page.waitForEvent('download');
        await page.evaluate(async ({ canvasId, fileName }) => {
          const { downloadBlob } = await import('/src/export/index.ts');
          const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
          if (!canvas) throw new Error(`Missing benchmark canvas ${canvasId}.`);
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PNG encode failed.')), 'image/png');
          });
          downloadBlob(blob, fileName);
        }, { canvasId, fileName });
        const download = await downloadPromise;
        await download.saveAs(path.join(examples, download.suggestedFilename()));
      }
    }
  });
}
