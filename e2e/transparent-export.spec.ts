import { expect, test } from '@playwright/test';
import { captureUnexpectedConsoleErrors, expectNoUnexpectedConsoleErrors } from './raster-test-helpers';

test('transparent WebM decodes in HTMLVideoElement with alpha, motion, and 24 FPS timing', async ({ page }) => {
  const consoleErrors = captureUnexpectedConsoleErrors(page);
  await page.goto('/src/export/index.ts');

  const proof = await page.evaluate(async () => {
    const { exportVideo, getVideoExportCapabilities } = await import('/src/export/index.ts');
    const { renderRasterFrame } = await import('/src/raster/render.ts');
    const { DEFAULT_RASTER_SETTINGS } = await import('/src/raster/settings.ts');
    const capabilities = await getVideoExportCapabilities({
      transparent: true,
      width: 320,
      height: 180,
    });
    if (!capabilities.webm.supported) return { capabilities, unsupported: true as const };

    const settings = {
      ...DEFAULT_RASTER_SETTINGS,
      source: 'waves' as const,
      mode: 'halftone' as const,
      motion: 'drift' as const,
      fade: 'none' as const,
      columns: 40,
      foreground: 'rgba(255, 32, 78, 0.6)',
    };
    const progress: number[] = [];
    const result = await exportVideo({
      width: 320,
      height: 180,
      settings,
      duration: 1,
      background: '#102030',
      format: 'webm',
      transparent: true,
      frameRate: 24,
      quality: 'web',
      onProgress: (value: number) => progress.push(value),
      fileName: 'transparent-proof',
    });

    const mediabunnyUrl = performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((name) => name.includes('/node_modules/.vite/deps/mediabunny.js'));
    if (!mediabunnyUrl) throw new Error('Vite did not expose the loaded Mediabunny module URL.');
    const { ALL_FORMATS, BlobSource, EncodedPacketSink, Input } = await import(mediabunnyUrl);
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(result.blob) });
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('Encoded artifact contains no video track.');
    const packets = [] as Array<{ timestamp: number; duration: number; hasAlpha: boolean }>;
    for await (const packet of new EncodedPacketSink(track).packets()) {
      packets.push({
        timestamp: packet.timestamp,
        duration: packet.duration,
        hasAlpha: Boolean(packet.sideData.alpha?.byteLength),
      });
    }
    packets.sort((a, b) => a.timestamp - b.timestamp);

    const objectUrl = URL.createObjectURL(result.blob);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadeddata', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(video.error ?? new Error('Video decode failed.')), { once: true });
    });

    const canvas = document.createElement('canvas');
    canvas.width = result.width;
    canvas.height = result.height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas 2D is unavailable.');
    const sampleAt = async (time: number, phase: number) => {
      await new Promise<void>((resolve) => {
        video.addEventListener('seeked', () => resolve(), { once: true });
        video.currentTime = time;
      });
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(video, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261;
      let transparentPixels = 0;
      let inkPixels = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        hash = Math.imul(hash ^ pixels[index], 16777619);
        hash = Math.imul(hash ^ pixels[index + 1], 16777619);
        hash = Math.imul(hash ^ pixels[index + 2], 16777619);
        hash = Math.imul(hash ^ pixels[index + 3], 16777619);
        if (pixels[index + 3] === 0) transparentPixels += 1;
        if (pixels[index + 3] > 0) inkPixels += 1;
      }
      const reference = document.createElement('canvas');
      reference.width = canvas.width;
      reference.height = canvas.height;
      const referenceContext = reference.getContext('2d', { alpha: true });
      if (!referenceContext) throw new Error('Canvas 2D is unavailable.');
      renderRasterFrame(referenceContext, {
        width: canvas.width,
        height: canvas.height,
        settings,
        phase,
      });
      const composite = document.createElement('canvas');
      composite.width = canvas.width;
      composite.height = canvas.height;
      const compositeContext = composite.getContext('2d');
      if (!compositeContext) throw new Error('Canvas 2D is unavailable.');
      compositeContext.fillStyle = '#123456';
      compositeContext.fillRect(0, 0, canvas.width, canvas.height);
      compositeContext.drawImage(canvas, 0, 0);
      const referenceComposite = document.createElement('canvas');
      referenceComposite.width = canvas.width;
      referenceComposite.height = canvas.height;
      const referenceCompositeContext = referenceComposite.getContext('2d');
      if (!referenceCompositeContext) throw new Error('Canvas 2D is unavailable.');
      referenceCompositeContext.fillStyle = '#123456';
      referenceCompositeContext.fillRect(0, 0, canvas.width, canvas.height);
      referenceCompositeContext.drawImage(reference, 0, 0);
      const decodedComposite = compositeContext.getImageData(0, 0, canvas.width, canvas.height).data;
      const expectedComposite = referenceCompositeContext.getImageData(0, 0, canvas.width, canvas.height).data;
      let squaredError = 0;
      for (let index = 0; index < decodedComposite.length; index += 1) {
        const difference = decodedComposite[index] - expectedComposite[index];
        squaredError += difference * difference;
      }
      const mse = squaredError / decodedComposite.length;
      const compositePsnr = 10 * Math.log10((255 * 255) / mse);
      return { hash: hash >>> 0, transparentPixels, inkPixels, compositePsnr };
    };
    const first = await sampleAt(0, 0);
    const middle = await sampleAt(0.5, 0.5);
    URL.revokeObjectURL(objectUrl);

    return {
      unsupported: false as const,
      capabilities,
      blobSize: result.blob.size,
      blobType: result.blob.type,
      containerTransparent: await track.canBeTransparent(),
      decodedDuration: await input.computeDuration([track]),
      fileName: result.fileName,
      first,
      frameCount: result.frameCount,
      height: await track.getCodedHeight(),
      middle,
      packets,
      progressFirst: progress[0],
      progressLast: progress.at(-1),
      resultDuration: result.duration,
      width: await track.getCodedWidth(),
    };
  });

  test.skip(proof.unsupported, proof.capabilities.webm.reason ?? 'Transparent VP9 encoding is unavailable.');
  if (proof.unsupported) return;

  expect(proof.capabilities.webm.codec).toBe('vp9');
  expect(proof.capabilities.mp4.supported).toBe(false);
  expect(proof.blobSize).toBeGreaterThan(1_000);
  expect(proof.blobType).toBe('video/webm');
  expect(proof.fileName).toBe('transparent-proof.webm');
  expect([proof.width, proof.height]).toEqual([320, 180]);
  expect(proof.containerTransparent).toBe(true);
  expect(proof.frameCount).toBe(24);
  expect(proof.packets).toHaveLength(24);
  expect(proof.packets.every((packet) => packet.hasAlpha)).toBe(true);
  expect(proof.decodedDuration).toBeCloseTo(1, 4);
  expect(proof.resultDuration).toBeCloseTo(1, 4);
  proof.packets.slice(0, 4).forEach((packet, index) => {
    expect(packet.timestamp).toBeCloseTo(index / 24, 3);
    expect(packet.duration).toBeCloseTo(1 / 24, 2);
  });
  expect(proof.first.transparentPixels).toBeGreaterThan(1_000);
  expect(proof.first.inkPixels).toBeGreaterThan(1_000);
  expect(proof.first.compositePsnr).toBeGreaterThan(30);
  expect(proof.middle.transparentPixels).toBeGreaterThan(1_000);
  expect(proof.middle.inkPixels).toBeGreaterThan(1_000);
  expect(proof.middle.compositePsnr).toBeGreaterThan(30);
  expect(proof.first.hash).not.toBe(proof.middle.hash);
  expect(proof.progressFirst).toBe(0);
  expect(proof.progressLast).toBe(1);
  await expectNoUnexpectedConsoleErrors(consoleErrors);
});

test('transparent MP4 is rejected explicitly', async ({ page }) => {
  await page.goto('/src/export/index.ts');
  const message = await page.evaluate(async () => {
    const { exportVideo } = await import('/src/export/index.ts');
    const { DEFAULT_RASTER_SETTINGS } = await import('/src/raster/settings.ts');
    try {
      await exportVideo({
        width: 320,
        height: 180,
        settings: DEFAULT_RASTER_SETTINGS,
        duration: 1,
        background: '#000000',
        format: 'mp4',
        transparent: true,
      });
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });

  expect(message).toMatch(/transparent.*WebM|WebM.*transparen/i);
});
