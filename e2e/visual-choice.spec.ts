import { test, expect } from '@playwright/test';
import { pauseLoop } from './raster-test-helpers';

test.setTimeout(30_000);

test('visual menus provide static previews, descriptions and full keyboard selection', async ({ page }, testInfo) => {
  await page.goto('/');
  await pauseLoop(page);
  const pattern = page.getByRole('button', { name: /^Pattern/ });
  await pattern.click();
  const list = page.getByRole('listbox', { name: 'Pattern', exact: true });
  await expect(list.getByRole('option')).toHaveCount(9);
  await expect(list.locator('canvas')).toHaveCount(8);
  await expect(list.getByRole('option', { name: 'Organic Field', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.screenshot({ path: testInfo.outputPath('pattern-menu.png') });
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(pattern).toContainText('Waves');
  await expect(pattern).toBeFocused();
  await pattern.press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(pattern).toContainText('Image');
  await pattern.click();
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(pattern).toBeFocused();
  await pattern.click();
  await page.keyboard.press('r');
  await page.keyboard.press('Enter');
  await expect(pattern).toContainText(/Ring|Ribbon/);

  const renderer = page.getByRole('button', { name: /^Renderer/ });
  await renderer.click();
  const renderers = page.getByRole('listbox', { name: 'Renderer', exact: true });
  await expect(renderers.getByRole('option')).toHaveCount(5);
  await expect(renderers.locator('canvas')).toHaveCount(5);
  await page.screenshot({ path: testInfo.outputPath('renderer-menu.png') });
  await renderers.getByRole('option', { name: 'ASCII', exact: true }).click();
  await expect(renderer).toContainText('ASCII');
  await expect(renderer).toBeFocused();
  await renderer.click();
  await page.keyboard.press('Tab');
  await expect(renderers).toHaveCount(0);
});

test('visual menu stays within a narrow viewport and closes on outside interaction', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await pauseLoop(page);
  const trigger = page.getByRole('button', { name: /^Pattern/ });
  await trigger.click();
  const menu = page.getByRole('listbox', { name: 'Pattern', exact: true });
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(701);
  await page.screenshot({ path: testInfo.outputPath('menu-mobile.png') });
  await page.mouse.click(2, 2);
  await expect(menu).toHaveCount(0);
});
