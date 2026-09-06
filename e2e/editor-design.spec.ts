import { test, expect } from '@playwright/test';
import { pauseLoop, selectDialOption } from './raster-test-helpers';

test('style previews are distinct, selected state follows edits, and targets explain restrictions', async ({ page }) => {
  await page.goto('/');
  await pauseLoop(page);
  const previews = page.locator('.preset-swatch canvas');
  await expect(previews).toHaveCount(8);
  const images = await previews.evaluateAll(canvases => canvases.map(canvas => (canvas as HTMLCanvasElement).toDataURL()));
  expect(new Set(images).size).toBe(8);
  const style = page.getByRole('button', { name: 'Soft Dots Soft halftone texture', exact: true });
  await style.click();
  await expect(style).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('slider', { name: 'Density', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(style).toHaveAttribute('aria-pressed', 'false');
  const target = page.getByLabel('Target', { exact: true });
  await target.selectOption('distribution');
  await expect(page.getByRole('button', { name: 'Randomize points', exact: true })).toBeDisabled();
  await expect(page.locator('#variation-hint')).toHaveText('Choose Contour Particles to randomize points.');
  await selectDialOption(page, 'Movement', 'Off');
  await target.selectOption('motion');
  await expect(page.getByRole('button', { name: 'Randomize motion', exact: true })).toBeDisabled();
  await expect(page.locator('#variation-hint')).toHaveText('Turn motion on to randomize it.');
  await target.selectOption('pattern');
  await expect(page.getByRole('button', { name: 'Randomize pattern', exact: true })).toBeEnabled();
});

test('desktop keeps export reachable and mobile avoids horizontal page overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await pauseLoop(page);
  await selectDialOption(page, 'Pattern', 'Organic Field');
  await page.getByRole('button', { name: 'Signal Dither Electric ordered dither', exact: true }).click();
  // A deterministic generated composition keeps documentation free of source photos.
  await page.evaluate(() => {
    const key = 'rabi-raster:settings:v1';
    const doc = JSON.parse(localStorage.getItem(key)!);
    doc.values.Source.Seed = 8036;
    doc.values.Source['Pattern scale'] = 1.3;
    doc.values.Effect.Density = 84;
    doc.values.Effect.Contrast = .85;
    doc.values.Effect['Mark size'] = .8;
    localStorage.setItem(key, JSON.stringify(doc));
  });
  await page.reload();
  await pauseLoop(page);
  await page.getByLabel('Loop position').fill('1.5');
  await page.getByRole('heading', { name: 'Edit artwork' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Export loop', exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('editor-desktop.png') });
  for (const size of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 320, height: 700 }]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (size.width > 980) await expect(page.getByRole('button', { name: 'Export loop', exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`editor-${size.width}.png`), fullPage: true });
  }
});


test('new sessions and Reset use Organic Field and Signal Dither with built-in glyphs', async ({ page }) => {
  await page.goto('/');
  await pauseLoop(page);
  await expect(page.getByRole('button', { name: /^Pattern/ })).toContainText('Organic Field');
  await expect(page.getByRole('button', { name: /^Renderer/ })).toContainText('Dither');
  const style = page.getByRole('button', { name: 'Signal Dither Electric ordered dither', exact: true });
  await expect(style).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Glyphs', exact: true })).toHaveValue(' .:-=+*#%@');
  await selectDialOption(page, 'Pattern', 'Ring');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Pattern/ })).toContainText('Organic Field');
  await expect(style).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByLabel('Target', { exact: true }).selectOption('colors');
  const size = await page.getByLabel('Target', { exact: true }).evaluate((select) => {
    const css = getComputedStyle(select);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    context.font = css.font;
    return { available: select.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight), text: context.measureText('Accents').width };
  });
  expect(size.available).toBeGreaterThan(size.text);
  await page.getByLabel('Target', { exact: true }).screenshot({ path: 'test-results/variation-select-mobile.png' });
});
