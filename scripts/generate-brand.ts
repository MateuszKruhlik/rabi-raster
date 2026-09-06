import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { sampleRasterField, shouldDither } from '../src/raster/field.ts';
import type { RasterSettings } from '../src/raster/settings.ts';

const VIEWBOX = 48;
const GRID = 12;
const CELL = 3;
const OFFSET = 6;
const LIGHT = '#F2F2F4';
const INK = '#171719';

type Variant = Readonly<{
  id: 'seed' | 'notch' | 'drift';
  label: string;
  seed: number;
  patternScale: number;
  sampleOffsetX: number;
  sampleOffsetY: number;
  biasX: number;
  biasY: number;
  notch: boolean;
}>;

const variants: readonly Variant[] = [
  {
    id: 'seed', label: 'Seed', seed: 218, patternScale: 1.05,
    sampleOffsetX: -.08, sampleOffsetY: .03, biasX: -.06, biasY: -.02, notch: false,
  },
  {
    id: 'notch', label: 'Notch', seed: 583, patternScale: .82,
    sampleOffsetX: .02, sampleOffsetY: -.04, biasX: -.02, biasY: .02, notch: true,
  },
  {
    id: 'drift', label: 'Drift', seed: 947, patternScale: 1.24,
    sampleOffsetX: -.04, sampleOffsetY: -.1, biasX: .07, biasY: -.04, notch: false,
  },
];

const selectedVariant = variants[1];

const baseSettings: RasterSettings = {
  source: 'organic', mode: 'dither', columns: 40, contrast: 1.35,
  seed: 1, patternScale: 1, markScale: 1, foreground: LIGHT,
  invert: false, mark: 'square', motion: 'off', motionSeed: 1,
  direction: 0, frequency: 1, amplitude: 0, fade: 'none',
  glyphs: ' .:-=+*#%@', tone: 'opacity', cutoff: .08,
  edgeSensitivity: .5, irregularity: .25, distributionSeed: 1,
  accentColor: LIGHT, accentColor2: LIGHT, accentAmount: 0,
  paletteSeed: 1, ribbonCount: 3, ribbonWidth: .2, ribbonTwist: 1.5,
};

type Cell = Readonly<{ x: number; y: number }>;

function cellsForVariant(variant: Variant): Cell[] {
  const settings: RasterSettings = {
    ...baseSettings,
    seed: variant.seed,
    patternScale: variant.patternScale,
  };
  const input = { width: VIEWBOX, height: VIEWBOX, phase: 0, settings };
  const cells: Cell[] = [];

  for (let row = 0; row < GRID; row += 1) {
    for (let col = 0; col < GRID; col += 1) {
      const u = (col + .5) / GRID;
      const v = (row + .5) / GRID;
      const dx = u - .5 - variant.biasX;
      const dy = v - .5 - variant.biasY;
      const superellipse = (Math.abs(dx) / .49) ** 2.55 + (Math.abs(dy) / .47) ** 2.55;
      if (superellipse > 1) continue;

      // The field supplies the irregular mass; the envelope keeps the mark compact.
      const sample = sampleRasterField(
        input,
        u + variant.sampleOffsetX,
        v + variant.sampleOffsetY,
      ).value;
      const envelope = Math.max(0, 1 - superellipse);
      const directionalWeight = .08 * (1 - u) + .04 * v;
      const value = Math.min(1, sample * .68 + envelope * .62 + directionalWeight);

      // The selected version has a deliberate, square-cut counter rather than a letterform.
      const inNotch = variant.notch
        && col >= 6 && col <= 8
        && row >= 4 && row <= 6
        && !(col === 6 && row === 6);
      if (!inNotch && shouldDither(value, col, row)) cells.push({ x: col, y: row });
    }
  }

  return cells;
}

function cellRects(cells: readonly Cell[], fill: string) {
  return cells.map(({ x, y }) => (
    `<rect x="${OFFSET + x * CELL}" y="${OFFSET + y * CELL}" width="${CELL}" height="${CELL}"/>`
  )).join('');
}

function markSvg(cells: readonly Cell[], fill = LIGHT) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" role="img" aria-labelledby="title"><title id="title">Rabi Raster mark</title><g fill="${fill}" shape-rendering="crispEdges">${cellRects(cells, fill)}</g></svg>\n`;
}

function faviconSvg(cells: readonly Cell[]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" role="img" aria-labelledby="title"><title id="title">Rabi Raster</title><rect width="48" height="48" rx="9" fill="${INK}"/><g fill="${LIGHT}" shape-rendering="crispEdges">${cellRects(cells, LIGHT)}</g></svg>\n`;
}

function wordmarkSvg(cells: readonly Cell[]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 252 48" role="img" aria-labelledby="title"><title id="title">Rabi Raster</title><g fill="${INK}" shape-rendering="crispEdges">${cellRects(cells, INK)}</g><text x="60" y="31" fill="${INK}" font-family="Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="22" font-weight="600" letter-spacing="-.45">Rabi Raster</text></svg>\n`;
}

function previewSvg(variant: Variant, cells: readonly Cell[]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 168" role="img" aria-labelledby="title"><title id="title">Rabi Raster ${variant.label} mark candidate</title><rect width="144" height="168" rx="12" fill="${INK}"/><g transform="translate(48 34)" fill="${LIGHT}" shape-rendering="crispEdges">${cellRects(cells, LIGHT)}</g><text x="72" y="128" fill="${LIGHT}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="600" text-anchor="middle">${variant.label}</text><text x="72" y="148" fill="#8D8D94" font-family="ui-monospace, monospace" font-size="10" text-anchor="middle">${variant.seed} / ${variant.patternScale}</text></svg>\n`;
}

function asciiPreview(cells: readonly Cell[]) {
  const occupied = new Set(cells.map(({ x, y }) => `${x}:${y}`));
  return Array.from({ length: GRID }, (_, row) => (
    Array.from({ length: GRID }, (_, col) => occupied.has(`${col}:${row}`) ? '██' : '  ').join('')
  )).join('\n');
}

async function main() {
  const projectRoot = path.resolve(import.meta.dirname, '..');
  const brandDirectory = path.join(projectRoot, 'public', 'brand');
  const previewDirectory = process.argv.includes('--previews')
    ? path.join(projectRoot, '.brand-previews')
    : null;
  const selectedCells = cellsForVariant(selectedVariant);

  await mkdir(brandDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(brandDirectory, 'mark.svg'), markSvg(selectedCells)),
    writeFile(path.join(brandDirectory, 'mark-dark.svg'), markSvg(selectedCells, INK)),
    writeFile(path.join(brandDirectory, 'wordmark.svg'), wordmarkSvg(selectedCells)),
    writeFile(path.join(projectRoot, 'public', 'favicon.svg'), faviconSvg(selectedCells)),
  ]);

  if (previewDirectory) {
    await mkdir(previewDirectory, { recursive: true });
    await Promise.all(variants.map((variant) => {
      const cells = cellsForVariant(variant);
      return writeFile(path.join(previewDirectory, `${variant.id}.svg`), previewSvg(variant, cells));
    }));
  }

  for (const variant of variants) {
    console.log(`\n${variant.id}${variant === selectedVariant ? ' (selected)' : ''}\n${asciiPreview(cellsForVariant(variant))}`);
  }
}

await main();
