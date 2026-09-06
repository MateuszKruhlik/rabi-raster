import { expect, test } from '@playwright/test';
import {
  canvasPixelProof,
  captureUnexpectedConsoleErrors,
  expectNoUnexpectedConsoleErrors,
  pauseLoop,
  selectDialOption,
} from './raster-test-helpers';

test('editor controls render every raster mode, source, mark, color, density, motion and fade', async ({ page }) => {
  const consoleErrors = captureUnexpectedConsoleErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Edit artwork' })).toBeVisible();
  await pauseLoop(page);
  await selectDialOption(page, 'Movement', 'Off');

  const canvas = page.getByLabel('Raster artwork preview');
  await expect(canvas).toHaveAttribute('data-source-ready', 'true');
  const baseline = await canvasPixelProof(page);
  expect(baseline.width).toBeGreaterThan(500);
  expect(baseline.height).toBeGreaterThan(250);

  const rendererHashes = new Set<number>([baseline.hash]);
  for (const mode of ['Dither', 'ASCII', 'Halftone']) {
    await selectDialOption(page, 'Renderer', mode);
    await expect(page.locator('.stage-meta-end')).toContainText(mode.toLowerCase());
    rendererHashes.add((await canvasPixelProof(page)).hash);
  }
  expect(rendererHashes.size).toBe(3);

  const sourceHashes = new Set<number>();
  for (const source of ['Waves', 'Ring', 'Noise', 'Contours', 'Orbits', 'Interference']) {
    await selectDialOption(page, 'Pattern', source);
    sourceHashes.add((await canvasPixelProof(page)).hash);
  }
  expect(sourceHashes.size).toBe(6);

  await selectDialOption(page, 'Pattern', 'Waves');
  await selectDialOption(page, 'Renderer', 'Halftone');
  const markHashes = new Set<number>();
  for (const mark of ['Circle', 'Square', 'Pill']) {
    await selectDialOption(page, 'Mark', mark);
    markHashes.add((await canvasPixelProof(page)).hash);
  }
  expect(markHashes.size).toBe(3);

  const beforeDensity = await canvasPixelProof(page);
  const density = page.getByRole('slider', { name: 'Density' });
  await density.focus();
  await page.keyboard.press('End');
  await expect(density).toHaveAttribute('aria-valuenow', '180');
  expect((await canvasPixelProof(page)).hash).not.toBe(beforeDensity.hash);

  const foreground = page.getByLabel('Foreground color value');
  const beforeColor = await canvasPixelProof(page);
  await foreground.fill('#24FF70');
  await foreground.press('Enter');
  await foreground.blur();
  await expect(foreground).toHaveValue('#24FF70');
  expect((await canvasPixelProof(page)).hash).not.toBe(beforeColor.hash);

  const invert = page.getByRole('radiogroup', { name: 'Invert' });
  const beforeInvert = await canvasPixelProof(page);
  await invert.getByRole('radio', { name: 'On' }).click();
  await expect(invert.getByRole('radio', { name: 'On' })).toHaveAttribute('aria-checked', 'true');
  expect((await canvasPixelProof(page)).hash).not.toBe(beforeInvert.hash);

  const transparent = page.getByRole('radiogroup', { name: 'Transparent' });
  await transparent.getByRole('radio', { name: 'On' }).click();
  await selectDialOption(page, 'Text space', 'Left');
  const leftFade = await canvasPixelProof(page);
  expect(leftFade.alphaLeft).toBeLessThan(leftFade.alphaRight);
  await selectDialOption(page, 'Text space', 'Right');
  const rightFade = await canvasPixelProof(page);
  expect(rightFade.alphaRight).toBeLessThan(rightFade.alphaLeft);

  await selectDialOption(page, 'Renderer', 'ASCII');
  const glyphs = page.getByLabel('Glyphs');
  const beforeGlyphs = await canvasPixelProof(page);
  await glyphs.fill(' .XO');
  await glyphs.blur();
  expect((await canvasPixelProof(page)).hash).not.toBe(beforeGlyphs.hash);

  await selectDialOption(page, 'Movement', 'Wave');
  const amplitude = page.getByRole('slider', { name: 'Amplitude' });
  await amplitude.focus();
  await page.keyboard.press('End');
  await expect(amplitude).toHaveAttribute('aria-valuenow', '1');
  await page.getByRole('button', { name: 'Restart loop' }).click();
  await expect(canvas).toHaveAttribute('data-phase', '0.0000');
  const phaseZero = await canvasPixelProof(page);
  await page.getByLabel('Loop position').fill('2.1');
  await expect(canvas).toHaveAttribute('data-phase', '0.3500');
  expect((await canvasPixelProof(page)).hash).not.toBe(phaseZero.hash);

  await expectNoUnexpectedConsoleErrors(consoleErrors);
});

test('image import stays local, replaces the empty image state and enables output', async ({ page }) => {
  const consoleErrors = captureUnexpectedConsoleErrors(page);
  await page.goto('/');
  await pauseLoop(page);
  await selectDialOption(page, 'Movement', 'Off');
  await selectDialOption(page, 'Pattern', 'Image');
  await expect(page.getByText('Choose a local image in Source')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export PNG' })).toBeDisabled();
  await expect(page.getByLabel('Raster artwork preview')).toHaveAttribute('data-source-ready', 'false');

  const imageBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 16;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, 32, 16);
    context.fillStyle = '#000000';
    context.fillRect(0, 0, 16, 16);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const imageInput = page.locator('input[type="file"][accept^="image"]');
  await page.getByRole('button', { name: /Choose image image/ }).click();
  await expect(page.getByRole('dialog', { name: 'Image image picker' })).toBeVisible();
  await imageInput.setInputFiles({
    name: 'local-proof.png',
    mimeType: 'image/png',
    buffer: Buffer.from(imageBase64, 'base64'),
  });

  await expect(page.getByText('32 × 16 image ready for this session.')).toBeVisible();
  await expect(page.getByLabel('Raster artwork preview')).toHaveAttribute('data-source-ready', 'true');
  await expect(page.getByRole('button', { name: 'Export PNG' })).toBeEnabled();
  expect((await canvasPixelProof(page)).opaquePixels).toBeGreaterThan(1_000);
  expect(await page.evaluate(() => localStorage.getItem('rabi-raster:settings:v1'))).not.toContain('data:image');
  await selectDialOption(page, 'Movement', 'Wave');
  await page.getByRole('radiogroup', { name: 'Transparent' }).getByRole('radio', { name: 'On' }).click();
  await page.getByLabel('Loop position').fill('1.2');
  const previous = await page.evaluate(() => JSON.parse(localStorage.getItem('rabi-raster:settings:v1')!).values);
  await page.getByRole('button', { name: 'Mono Grid Sharp print texture' }).click();
  await expect(page.getByRole('button', { name: /^Pattern/ })).toContainText('Image');
  await expect(page.getByRole('button', { name: /^Movement/ })).toContainText('Wave');
  await expect(page.getByLabel('Raster artwork preview')).toHaveAttribute('data-source-ready', 'true');
  const styled = await page.evaluate(() => JSON.parse(localStorage.getItem('rabi-raster:settings:v1')!).values);
  expect(styled.Motion).toEqual(previous.Motion);
  expect(styled.Output).toEqual(previous.Output);
  expect(styled.Effect.Foreground).toEqual(previous.Effect.Foreground);
  const beforeMotion = await canvasPixelProof(page);
  await page.getByLabel('Target', { exact: true }).selectOption('motion');
  await page.getByRole('button', { name: 'Randomize motion', exact: true }).click();
  expect((await canvasPixelProof(page)).hash).not.toBe(beforeMotion.hash);
  await page.getByRole('button', { name: 'Undo variation' }).click();
  expect((await canvasPixelProof(page)).hash).toBe(beforeMotion.hash);
  await page.getByLabel('Target', { exact: true }).selectOption('look');
  await page.getByRole('button', { name: 'Randomize look', exact: true }).click();
  expect((await canvasPixelProof(page)).hash).not.toBe(beforeMotion.hash);
  await page.getByRole('button', { name: 'Undo variation' }).click();
  expect((await canvasPixelProof(page)).hash).toBe(beforeMotion.hash);
  await page.getByLabel('Target', { exact: true }).selectOption('pattern');
  await expect(page.getByRole('button', { name: 'Randomize pattern', exact: true })).toBeDisabled();
  for (const motion of ['Pulse', 'Scatter & return']) {
    await selectDialOption(page, 'Movement', motion);
    await page.getByLabel('Loop position').fill('0');
    const start = await canvasPixelProof(page);
    await page.getByLabel('Loop position').fill('3');
    expect((await canvasPixelProof(page)).hash).not.toBe(start.hash);
    await page.getByLabel('Loop position').fill('6');
    expect((await canvasPixelProof(page)).hash).toBe(start.hash);
  }
  const imagePng = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
  expect((await imagePng).suggestedFilename()).toBe('rabi-raster.png');
  const duration = page.getByRole('slider', { name: 'Duration', exact: true });
  await duration.focus();
  await page.keyboard.press('Home');
  await selectDialOption(page, 'Resolution', '0.5× · smaller');
  const loopDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export loop', exact: true }).click();
  expect((await loopDownload).suggestedFilename()).toBe('rabi-raster-loop.webm');
  await expect(page.getByRole('status')).toContainText('48 frames · 2.0s');
  await expectNoUnexpectedConsoleErrors(consoleErrors);
});

test('new patterns, independent mark thickness and seeded variations survive reload', async ({ page }, testInfo) => {
  await page.goto('/');
  await pauseLoop(page);
  await selectDialOption(page, 'Movement', 'Off');
  await page.getByRole('radiogroup', { name: 'Transparent' }).getByRole('radio', { name: 'On' }).click();
  await selectDialOption(page, 'Text space', 'None');
  for (const pattern of ['Contours', 'Orbits', 'Interference']) {
    await selectDialOption(page, 'Pattern', pattern);
    const proof = await canvasPixelProof(page);
    expect(proof.opaquePixels).toBeGreaterThan(1000);
    expect(proof.opaquePixels).toBeLessThan(proof.width * proof.height);
    await page.getByLabel('Raster artwork preview').screenshot({ path: testInfo.outputPath(`${pattern.toLowerCase()}.png`) });
  }
  const density = await page.getByRole('slider', { name: 'Density', exact: true }).getAttribute('aria-valuenow');
  const before = await canvasPixelProof(page);
  const markSize = page.getByRole('slider', { name: 'Mark size', exact: true });
  await markSize.focus();
  await page.keyboard.press('Home');
  expect((await canvasPixelProof(page)).opaquePixels).toBeLessThan(before.opaquePixels);
  await expect(page.getByRole('slider', { name: 'Density', exact: true })).toHaveAttribute('aria-valuenow', density!);
  const seed = await page.getByRole('slider', { name: 'Seed', exact: true }).getAttribute('aria-valuenow');
  await page.getByLabel('Target', { exact: true }).selectOption('pattern');
  await page.getByRole('button', { name: 'Randomize pattern', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Seed', exact: true })).not.toHaveAttribute('aria-valuenow', seed!);
  const randomized = await canvasPixelProof(page);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('rabi-raster:settings:v1')!).values.Source.Seed)).not.toBe(Number(seed));
  await page.reload();
  await pauseLoop(page);
  await expect(page.getByRole('button', { name: /^Pattern/ })).toContainText('Interference');
  expect((await canvasPixelProof(page)).hash).toBe(randomized.hash);
  await selectDialOption(page, 'Video', 'MP4');
  await expect(page.getByRole('button', { name: 'Export loop', exact: true })).toBeDisabled();
  await expect(page.getByRole('note')).toContainText('MP4');
});

test('settings and timeline survive a real reload while the loop remains forward and wraps', async ({ page }) => {
  const consoleErrors = captureUnexpectedConsoleErrors(page);
  await page.goto('/');
  await pauseLoop(page);
  await selectDialOption(page, 'Renderer', 'ASCII');
  await selectDialOption(page, 'Pattern', 'Ring');
  await selectDialOption(page, 'Text space', 'Right');
  await selectDialOption(page, 'Canvas', 'Square');
  await selectDialOption(page, 'Resolution', '2×');
  const duration = page.getByRole('slider', { name: 'Duration' });
  await duration.focus();
  await page.keyboard.press('Home');
  await expect(duration).toHaveAttribute('aria-valuenow', '2');

  await expect.poll(async () => page.evaluate(() => localStorage.getItem('rabi-raster:settings:v1')))
    .toContain('"ascii"');
  await page.reload();
  await pauseLoop(page);
  await expect(page.getByRole('button', { name: /^Renderer/ })).toContainText('ASCII');
  await expect(page.getByRole('button', { name: /^Pattern/ })).toContainText('Ring');
  await expect(page.getByRole('button', { name: /^Text space/ })).toContainText('Right');
  await expect(page.getByRole('button', { name: /^Canvas/ })).toContainText('Square');
  await expect(page.getByRole('button', { name: /^Resolution/ })).toContainText('2×');
  await expect(page.getByRole('slider', { name: 'Duration' })).toHaveAttribute('aria-valuenow', '2');
  await expect(page.getByLabel('Raster artwork preview')).toHaveAttribute('data-logical-width', '1400');
  await expect(page.getByLabel('Raster artwork preview')).toHaveAttribute('data-logical-height', '1400');
  await expect(page.getByLabel('Loop position')).toHaveAttribute('max', '2');

  await page.getByLabel('Loop position').fill('1.95');
  const beforePlay = Number(await page.getByLabel('Raster artwork preview').getAttribute('data-phase'));
  expect(beforePlay).toBeGreaterThan(0.9);
  await page.getByRole('button', { name: 'Play loop' }).click();
  await expect.poll(async () => Number(await page.getByLabel('Raster artwork preview').getAttribute('data-phase')))
    .toBeLessThan(0.15);
  await page.getByRole('button', { name: 'Pause loop' }).click();
  await expectNoUnexpectedConsoleErrors(consoleErrors);
});

test('the UI downloads PNG at the selected output size and exposes a real loop export', async ({ page }) => {
  const consoleErrors = captureUnexpectedConsoleErrors(page);
  await page.goto('/');
  await pauseLoop(page);
  await selectDialOption(page, 'Canvas', 'Portrait');
  await selectDialOption(page, 'Resolution', '1×');

  const pngDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const png = await pngDownload;
  expect(png.suggestedFilename()).toBe('rabi-raster.png');
  const pngPath = await png.path();
  expect(pngPath).not.toBeNull();
  if (!pngPath) throw new Error('Playwright did not retain the PNG download.');
  const pngBytes = await import('node:fs/promises').then(({ readFile }) => readFile(pngPath));
  expect(Array.from(pngBytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(pngBytes.readUInt32BE(16)).toBe(1080);
  expect(pngBytes.readUInt32BE(20)).toBe(1350);
  await expect(page.getByRole('status')).toContainText('1080 × 1350');

  const exportLoop = page.getByRole('button', { name: 'Export loop' });
  await selectDialOption(page, 'Frame rate', '30');
  await expect(exportLoop).toBeEnabled({ timeout: 20_000 });
  const duration = page.getByRole('slider', { name: 'Duration' });
  await duration.focus();
  await page.keyboard.press('Home');
  await expect(duration).toHaveAttribute('aria-valuenow', '2');
  const videoDownload = page.waitForEvent('download', { timeout: 120_000 });
  await exportLoop.click();
  await expect(page.getByRole('progressbar', { name: 'Export progress' })).toBeVisible();
  const video = await videoDownload;
  expect(video.suggestedFilename()).toMatch(/^rabi-raster-loop\.(webm|mp4)$/);
  const videoPath = await video.path();
  expect(videoPath).not.toBeNull();
  if (!videoPath) throw new Error('Playwright did not retain the video download.');
  const videoBytes = await import('node:fs/promises').then(({ readFile }) => readFile(videoPath));
  expect(videoBytes.byteLength).toBeGreaterThan(10_000);
  await expect(page.getByRole('status')).toContainText('60 frames · 2.0s');
  await expectNoUnexpectedConsoleErrors(consoleErrors);
});
