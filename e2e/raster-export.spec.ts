import { expect, test } from '@playwright/test';
import { captureUnexpectedConsoleErrors, expectNoUnexpectedConsoleErrors } from './raster-test-helpers';

test('PNG export decodes at the requested dimensions with real image ink and transparency', async ({ page }) => {
  const consoleErrors = captureUnexpectedConsoleErrors(page);
  await page.goto('/src/export/index.ts');

  const proof = await page.evaluate(async () => {
    const { exportImage } = await import('/src/export/index.ts');
    const { DEFAULT_RASTER_SETTINGS } = await import('/src/raster/settings.ts');
    const width = 320;
    const height = 180;
    const sourcePixels = new Uint8ClampedArray(16 * 16 * 4);
    for (let index = 0; index < sourcePixels.length; index += 4) {
      sourcePixels[index + 3] = 255;
    }
    const source = new ImageData(sourcePixels, 16, 16);
    const settings = {
      ...DEFAULT_RASTER_SETTINGS,
      source: 'image' as const,
      mode: 'halftone' as const,
      motion: 'off' as const,
      fade: 'none' as const,
      columns: 40,
      foreground: '#FF204E',
    };
    const result = await exportImage({
      width,
      height,
      settings,
      source,
      phase: 0,
      background: '#102030',
      transparent: true,
      fileName: 'image-proof.png',
    });

    const signature = Array.from(new Uint8Array(await result.blob.slice(0, 8).arrayBuffer()));
    const bitmap = await createImageBitmap(result.blob);
    const decoded = document.createElement('canvas');
    decoded.width = bitmap.width;
    decoded.height = bitmap.height;
    const context = decoded.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, decoded.width, decoded.height).data;
    let transparentPixels = 0;
    let inkPixels = 0;
    let redInkPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      if (alpha === 0) transparentPixels += 1;
      if (alpha > 0) inkPixels += 1;
      if (alpha > 0 && pixels[index] > pixels[index + 1] * 2) redInkPixels += 1;
    }

    const empty = await exportImage({
      width,
      height,
      settings,
      source: new ImageData(
        new Uint8ClampedArray(16 * 16 * 4).fill(255),
        16,
        16,
      ),
      phase: 0,
      background: '#102030',
      transparent: true,
    });
    const emptyBitmap = await createImageBitmap(empty.blob);
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = width;
    emptyCanvas.height = height;
    const emptyContext = emptyCanvas.getContext('2d');
    if (!emptyContext) throw new Error('Canvas 2D is unavailable.');
    emptyContext.drawImage(emptyBitmap, 0, 0);
    emptyBitmap.close();
    const emptyAlpha = emptyContext.getImageData(0, 0, width, height).data
      .filter((_, index) => index % 4 === 3)
      .reduce((sum, alpha) => sum + alpha, 0);

    const opaque = await exportImage({
      width,
      height,
      settings,
      source,
      phase: 0,
      background: 'rgba(32, 64, 96, 0.35)',
      transparent: false,
    });
    const opaqueBitmap = await createImageBitmap(opaque.blob);
    const opaqueCanvas = document.createElement('canvas');
    opaqueCanvas.width = width;
    opaqueCanvas.height = height;
    const opaqueContext = opaqueCanvas.getContext('2d');
    if (!opaqueContext) throw new Error('Canvas 2D is unavailable.');
    opaqueContext.drawImage(opaqueBitmap, 0, 0);
    opaqueBitmap.close();
    const opaquePixels = opaqueContext.getImageData(0, 0, width, height).data;
    let minOpaqueAlpha = 255;
    for (let index = 3; index < opaquePixels.length; index += 4) {
      minOpaqueAlpha = Math.min(minOpaqueAlpha, opaquePixels[index]);
    }

    return {
      blobType: result.blob.type,
      decodedWidth: decoded.width,
      decodedHeight: decoded.height,
      emptyAlpha,
      fileName: result.fileName,
      inkPixels,
      minOpaqueAlpha,
      redInkPixels,
      signature,
      transparentPixels,
    };
  });

  expect(proof.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(proof.blobType).toBe('image/png');
  expect(proof.fileName).toBe('image-proof.png');
  expect([proof.decodedWidth, proof.decodedHeight]).toEqual([320, 180]);
  expect(proof.inkPixels).toBeGreaterThan(1_000);
  expect(proof.redInkPixels).toBeGreaterThan(1_000);
  expect(proof.transparentPixels).toBeGreaterThan(1_000);
  expect(proof.emptyAlpha).toBe(0);
  expect(proof.minOpaqueAlpha).toBe(255);
  await expectNoUnexpectedConsoleErrors(consoleErrors);
});

test('video export writes a decodable 30 FPS loop with changing frames and an opaque chosen background', async ({ page }) => {
  const consoleErrors = captureUnexpectedConsoleErrors(page);
  await page.goto('/src/export/index.ts');

  const proof = await page.evaluate(async () => {
    const { exportVideo, getVideoExportCapabilities } = await import('/src/export/index.ts');
    const { DEFAULT_RASTER_SETTINGS } = await import('/src/raster/settings.ts');
    const mediabunnyUrl = performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((name) => name.includes('/node_modules/.vite/deps/mediabunny.js'));
    if (!mediabunnyUrl) throw new Error('Vite did not expose the loaded Mediabunny module URL.');
    const {
      ALL_FORMATS,
      BlobSource,
      EncodedPacketSink,
      Input,
    } = await import(mediabunnyUrl);
    const capabilities = await getVideoExportCapabilities();
    const format = capabilities.webm.supported ? 'webm' : capabilities.mp4.supported ? 'mp4' : null;
    if (!format) return { capabilities, unsupported: true as const };

    const settings = {
      ...DEFAULT_RASTER_SETTINGS,
      source: 'waves' as const,
      mode: 'dither' as const,
      motion: 'drift' as const,
      amplitude: 0.9,
      fade: 'none' as const,
      columns: 40,
      foreground: '#F5F1E8',
    };
    const progress: number[] = [];
    const result = await exportVideo({
      width: 320,
      height: 180,
      settings,
      duration: 6,
      background: '#5A1020',
      format,
      onProgress: (value) => progress.push(value),
      fileName: 'loop-proof',
    });

    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(result.blob) });
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('Encoded artifact contains no video track.');
    const packets = [] as Array<{ timestamp: number; duration: number }>;
    for await (const packet of new EncodedPacketSink(track).packets()) {
      packets.push({ timestamp: packet.timestamp, duration: packet.duration });
    }
    const sorted = packets.toSorted((a, b) => a.timestamp - b.timestamp);

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
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = result.width;
    sampleCanvas.height = result.height;
    const sampleContext = sampleCanvas.getContext('2d');
    if (!sampleContext) throw new Error('Canvas 2D is unavailable.');
    const sampleAt = async (time: number) => {
      if (Math.abs(video.currentTime - time) > 1e-4) {
        await new Promise<void>((resolve) => {
          video.addEventListener('seeked', () => resolve(), { once: true });
          video.currentTime = time;
        });
      }
      sampleContext.drawImage(video, 0, 0);
      const pixels = sampleContext.getImageData(0, 0, result.width, result.height).data;
      let hash = 2166136261;
      let opaque = true;
      let backgroundPixels = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        hash = Math.imul(hash ^ pixels[index], 16777619);
        hash = Math.imul(hash ^ pixels[index + 1], 16777619);
        hash = Math.imul(hash ^ pixels[index + 2], 16777619);
        if (pixels[index + 3] !== 255) opaque = false;
        if (pixels[index] > pixels[index + 1] * 2 && pixels[index] > pixels[index + 2] * 1.5) {
          backgroundPixels += 1;
        }
      }
      return { hash: hash >>> 0, opaque, backgroundPixels };
    };
    const first = await sampleAt(0);
    const middle = await sampleAt(3);
    URL.revokeObjectURL(objectUrl);

    return {
      unsupported: false as const,
      capabilities,
      format,
      blobSize: result.blob.size,
      blobType: result.blob.type,
      duration: await input.computeDuration([track]),
      fileName: result.fileName,
      first,
      frameCount: result.frameCount,
      height: await track.getCodedHeight(),
      middle,
      packetCount: packets.length,
      packetDurations: sorted.slice(0, 4).map((packet) => packet.duration),
      packetTimestamps: sorted.slice(0, 4).map((packet) => packet.timestamp),
      progressFirst: progress[0],
      progressLast: progress.at(-1),
      width: await track.getCodedWidth(),
    };
  });

  test.skip(proof.unsupported, 'Chromium has no WebCodecs encoder for WebM or MP4.');
  if (proof.unsupported) return;

  expect(proof.blobSize).toBeGreaterThan(1_000);
  expect(proof.blobType).toBe(proof.format === 'webm' ? 'video/webm' : 'video/mp4');
  expect(proof.fileName).toBe(`loop-proof.${proof.format}`);
  expect([proof.width, proof.height]).toEqual([320, 180]);
  expect(proof.frameCount).toBe(180);
  expect(proof.packetCount).toBe(180);
  expect(proof.duration).toBeCloseTo(6, 4);
  proof.packetTimestamps.forEach((timestamp, index) => {
    expect(timestamp).toBeCloseTo(index / 30, 3);
  });
  for (const duration of proof.packetDurations) {
    expect(duration).toBeGreaterThanOrEqual(0.033);
    expect(duration).toBeLessThanOrEqual(0.034);
  }
  expect(proof.progressFirst).toBe(0);
  expect(proof.progressLast).toBe(1);
  expect(proof.first.opaque).toBe(true);
  expect(proof.middle.opaque).toBe(true);
  expect(proof.first.backgroundPixels).toBeGreaterThan(1_000);
  expect(proof.first.hash).not.toBe(proof.middle.hash);
  await expectNoUnexpectedConsoleErrors(consoleErrors);
});

test('video export reports capability and cancels both before and during encoding', async ({ page }) => {
  await page.goto('/src/export/index.ts');
  const result = await page.evaluate(async () => {
    const { exportVideo, getVideoExportCapabilities } = await import('/src/export/index.ts');
    const { DEFAULT_RASTER_SETTINGS } = await import('/src/raster/settings.ts');
    const controller = new AbortController();
    controller.abort();
    let abortName = '';
    try {
      await exportVideo({
        width: 320,
        height: 180,
        settings: DEFAULT_RASTER_SETTINGS,
        duration: 6,
        background: '#000000',
        format: 'webm',
        signal: controller.signal,
      });
    } catch (error) {
      abortName = error instanceof DOMException ? error.name : String(error);
    }
    const capabilities = await getVideoExportCapabilities();
    const supportedFormat = capabilities.webm.supported ? 'webm' : capabilities.mp4.supported ? 'mp4' : null;
    let midExportAbortName = '';
    const progress: number[] = [];
    if (supportedFormat) {
      const midExportController = new AbortController();
      try {
        await exportVideo({
          width: 160,
          height: 90,
          settings: DEFAULT_RASTER_SETTINGS,
          duration: 1,
          background: '#000000',
          format: supportedFormat,
          signal: midExportController.signal,
          onProgress: (value) => {
            progress.push(value);
            if (value > 0) midExportController.abort();
          },
        });
      } catch (error) {
        midExportAbortName = error instanceof DOMException ? error.name : String(error);
      }
    }
    return { abortName, capabilities, midExportAbortName, progress, supportedFormat };
  });

  expect(result.abortName).toBe('AbortError');
  for (const capability of Object.values(result.capabilities)) {
    expect(typeof capability.supported).toBe('boolean');
    if (capability.supported) expect(capability.codec).not.toBeNull();
    else expect(capability.reason).toBeTruthy();
  }
  if (result.supportedFormat) {
    expect(result.midExportAbortName).toBe('AbortError');
    expect(result.progress[0]).toBe(0);
    expect(result.progress.some((value) => value > 0 && value < 1)).toBe(true);
    expect(result.progress.at(-1)).toBeLessThan(1);
  }
});

test('every reported video format produces its real container and 30 packets for one second', async ({ page }) => {
  const consoleErrors = captureUnexpectedConsoleErrors(page);
  await page.goto('/src/export/index.ts');
  const proof = await page.evaluate(async () => {
    const { exportVideo, getVideoExportCapabilities } = await import('/src/export/index.ts');
    const { DEFAULT_RASTER_SETTINGS } = await import('/src/raster/settings.ts');
    const mediabunnyUrl = performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((name) => name.includes('/node_modules/.vite/deps/mediabunny.js'));
    if (!mediabunnyUrl) throw new Error('Vite did not expose the loaded Mediabunny module URL.');
    const { ALL_FORMATS, BlobSource, EncodedPacketSink, Input } = await import(mediabunnyUrl);
    const capabilities = await getVideoExportCapabilities();
    const outputs: Array<{
      duration: number;
      format: 'webm' | 'mp4';
      packetCount: number;
      signature: number[];
      type: string;
    }> = [];

    for (const format of ['webm', 'mp4'] as const) {
      if (!capabilities[format].supported) continue;
      const result = await exportVideo({
        width: 160,
        height: 90,
        settings: { ...DEFAULT_RASTER_SETTINGS, fade: 'none', columns: 40 },
        duration: 1,
        background: '#231A35',
        format,
      });
      const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(result.blob) });
      const track = await input.getPrimaryVideoTrack();
      if (!track) throw new Error(`${format} export contains no video track.`);
      let packetCount = 0;
      for await (const _packet of new EncodedPacketSink(track).packets()) packetCount += 1;
      outputs.push({
        duration: await input.computeDuration([track]),
        format,
        packetCount,
        signature: Array.from(new Uint8Array(await result.blob.slice(0, 12).arrayBuffer())),
        type: result.blob.type,
      });
    }
    return { capabilities, outputs };
  });

  for (const format of ['webm', 'mp4'] as const) {
    const capability = proof.capabilities[format];
    const output = proof.outputs.find((entry) => entry.format === format);
    if (!capability.supported) {
      expect(capability.reason).toBeTruthy();
      expect(output).toBeUndefined();
      continue;
    }
    expect(output).toBeDefined();
    if (!output) continue;
    expect(output.type).toBe(`video/${format}`);
    expect(output.packetCount).toBe(30);
    expect(output.duration).toBeCloseTo(1, 3);
    if (format === 'webm') expect(output.signature.slice(0, 4)).toEqual([26, 69, 223, 163]);
    else expect(String.fromCharCode(...output.signature.slice(4, 8))).toBe('ftyp');
  }
  await expectNoUnexpectedConsoleErrors(consoleErrors);
});
