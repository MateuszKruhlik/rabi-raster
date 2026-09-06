import { expect, type Page } from '@playwright/test';

export interface CanvasPixelProof {
  alphaLeft: number;
  alphaRight: number;
  hash: number;
  height: number;
  opaquePixels: number;
  width: number;
}

export function captureUnexpectedConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

export async function expectNoUnexpectedConsoleErrors(errors: string[]): Promise<void> {
  expect(errors, errors.join('\n')).toEqual([]);
}

export async function waitForCanvasInk(page: Page, canvasSelector = 'canvas[aria-label="Raster artwork preview"]'): Promise<number> {
  return page.locator(canvasSelector).evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonTransparent = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) nonTransparent += 1;
    }
    return nonTransparent;
  });
}

export async function canvasPixelProof(page: Page): Promise<CanvasPixelProof> {
  return page.getByLabel('Raster artwork preview').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let alphaLeft = 0;
    let alphaRight = 0;
    let hash = 2166136261;
    let opaquePixels = 0;
    for (let index = 0; index < data.length; index += 4) {
      const pixel = index / 4;
      const x = pixel % canvas.width;
      const alpha = data[index + 3];
      if (alpha > 0) opaquePixels += 1;
      if (x < canvas.width / 2) alphaLeft += alpha;
      else alphaRight += alpha;
      hash = Math.imul(hash ^ data[index], 16777619);
      hash = Math.imul(hash ^ data[index + 1], 16777619);
      hash = Math.imul(hash ^ data[index + 2], 16777619);
      hash = Math.imul(hash ^ alpha, 16777619);
    }
    return {
      alphaLeft,
      alphaRight,
      hash: hash >>> 0,
      height: canvas.height,
      opaquePixels,
      width: canvas.width,
    };
  });
}

export async function selectDialOption(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
  await page.getByRole('listbox', { name: label }).getByRole('option', { name: option, exact: true }).click();
}

export async function pauseLoop(page: Page): Promise<void> {
  const pause = page.getByRole('button', { name: 'Pause loop' });
  if (await pause.isVisible()) await pause.click();
  await expect(page.getByRole('button', { name: 'Play loop' })).toBeVisible();
}
