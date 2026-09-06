import { expect, test } from '@playwright/test';
import { canvasPixelProof, pauseLoop, selectDialOption, captureUnexpectedConsoleErrors, expectNoUnexpectedConsoleErrors } from './raster-test-helpers';

test('reference styles preserve a local photo, independently vary points and accents, and export SVG', async ({ page }, testInfo) => {
  const errors = captureUnexpectedConsoleErrors(page);
  await page.goto('/');
  await pauseLoop(page);
  await selectDialOption(page, 'Movement', 'Off');
  await selectDialOption(page, 'Text space', 'None');
  await page.getByRole('radiogroup', { name: 'Transparent' }).getByRole('radio', { name: 'On' }).click();
  const photo = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'white'; ctx.fillRect(0,0,320,180);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(160,90, 60,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#888'; ctx.fillRect(210,45,60,90);
    return c.toDataURL('image/jpeg').split(',')[1];
  });
  await page.getByRole('button', { name: /Choose image image/ }).click();
  await page.locator('input[type="file"][accept^="image"]').setInputFiles({ name:'silhouette.jpg', mimeType:'image/jpeg', buffer:Buffer.from(photo,'base64') });
  await expect(page.getByLabel('Raster artwork preview')).toHaveAttribute('data-source-ready','true');
  await page.getByRole('button', { name:'Dot Matrix Fixed dots, tonal image' }).click();
  await expect(page.getByRole('button', { name:/^Pattern/ })).toContainText('Image');
  const matrix = await canvasPixelProof(page);
  expect(matrix.opaquePixels).toBeGreaterThan(1000);
  await selectDialOption(page, 'Tone', 'Brightness');
  expect((await canvasPixelProof(page)).hash).not.toBe(matrix.hash);
  await page.getByRole('button', { name:'Contour Particles Points along the edges' }).click();
  const particles = await canvasPixelProof(page);
  expect(particles.opaquePixels).toBeGreaterThan(100);
  expect(particles.opaquePixels).toBeLessThan(matrix.opaquePixels);
  await page.getByLabel('Target', { exact: true }).selectOption('distribution');
  await page.getByRole('button', { name:'Randomize points',exact:true }).click();
  expect((await canvasPixelProof(page)).hash).not.toBe(particles.hash);
  await page.getByRole('button', { name:'Undo variation' }).click();
  expect((await canvasPixelProof(page)).hash).toBe(particles.hash);
  await page.getByLabel('Target', { exact: true }).selectOption('colors');
  await page.getByRole('button', { name:'Randomize accents',exact:true }).click();
  expect((await canvasPixelProof(page)).hash).not.toBe(particles.hash);
  await page.getByRole('button', { name:'Undo variation' }).click();
  expect((await canvasPixelProof(page)).hash).toBe(particles.hash);
  await page.getByLabel('Target', { exact: true }).selectOption('colors');
  await page.getByRole('button', { name:'Randomize accents',exact:true }).click();
  await page.getByLabel('Raster artwork preview').screenshot({path:testInfo.outputPath('photo-contours.png')});
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name:'Export SVG',exact:true }).click();
  const svg = await download;
  expect(svg.suggestedFilename()).toBe('rabi-raster.svg');
  const stream = await svg.createReadStream();
  const chunks:Buffer[]=[]; for await(const chunk of stream!) chunks.push(chunk);
  const xml = Buffer.concat(chunks).toString();
  expect(xml).toContain('<circle'); expect(xml).not.toContain('<image');
  expect(xml).not.toContain('<script');
  await expectNoUnexpectedConsoleErrors(errors);
});

test('Ribbon and Organic Field animate with exact loop seams and restore through settings', async ({page}, testInfo) => {
  await page.goto('/'); await pauseLoop(page);
  await selectDialOption(page,'Text space','None');
  await selectDialOption(page,'Renderer','ASCII');
  await selectDialOption(page,'Movement','Wave');
  for (const pattern of ['Ribbon','Organic Field']) {
    await selectDialOption(page,'Pattern',pattern);
    await page.getByLabel('Loop position').fill('0');
    const first = await canvasPixelProof(page);
    expect(first.opaquePixels).toBeGreaterThan(1000);
    await page.getByLabel('Loop position').fill('2');
    expect((await canvasPixelProof(page)).hash).not.toBe(first.hash);
    await page.getByLabel('Raster artwork preview').screenshot({path:testInfo.outputPath(`${pattern}.png`)});
    await page.getByLabel('Loop position').fill('6');
    expect((await canvasPixelProof(page)).hash).toBe(first.hash);
  }
  await selectDialOption(page,'Movement','Off');
  const before = await canvasPixelProof(page);
  await page.reload(); await pauseLoop(page);
  await expect(page.getByRole('button',{name:/^Pattern/})).toContainText('Organic Field');
  expect((await canvasPixelProof(page)).hash).toBe(before.hash);
});
