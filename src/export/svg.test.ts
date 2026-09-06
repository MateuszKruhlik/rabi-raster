import { describe, expect, it } from 'vitest';
import { DEFAULT_RASTER_SETTINGS, type RasterSettings } from '../raster/settings';
import { exportSvg } from './svg';

const settings = (overrides: Partial<RasterSettings> = {}): RasterSettings => ({
  ...DEFAULT_RASTER_SETTINGS,
  source: 'image',
  motion: 'off',
  fade: 'none',
  columns: 40,
  ...overrides,
});

const image = (value: number, alpha = 255): ImageData => ({
  data: new Uint8ClampedArray([value, value, value, alpha]),
  width: 1,
  height: 1,
  colorSpace: 'srgb',
});

describe('SVG export', () => {
  it('exports real vector geometry with dimensions, color, alpha, and no embedded bitmap', async () => {
    const result = await exportSvg({
      width: 400,
      height: 14,
      settings: settings({ mark: 'circle', foreground: 'rgba(255, 32, 78, 0.6)' }),
      source: image(0, 128),
      phase: 0.375,
      background: '#102030',
      transparent: true,
      fileName: ' vector proof.png ',
    });
    const svg = await result.blob.text();

    expect(result.blob.type).toBe('image/svg+xml;charset=utf-8');
    expect(result.fileName).toBe('vector-proof.svg');
    expect([result.width, result.height]).toEqual([400, 14]);
    expect(result.elementCount).toBeGreaterThan(0);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="14" viewBox="0 0 400 14">');
    expect(svg).toContain('<circle ');
    expect(svg).toContain('fill="rgba(255, 32, 78, 0.6)"');
    expect(svg).toMatch(/fill-opacity="0\.50[0-9]+"/);
    expect(svg).not.toMatch(/<image\b|data:image|<script\b/i);
  });

  it('records square, pill, and literal ASCII geometry and escapes XML text', async () => {
    const makeSvg = async (overrides: Partial<RasterSettings>) => (await exportSvg({
      width: 400,
      height: 14,
      settings: settings(overrides),
      source: image(0),
      phase: 0,
      background: '#fff',
      transparent: true,
    })).blob.text();

    expect(await makeSvg({ mode: 'halftone', mark: 'square' })).toContain('<rect ');
    expect(await makeSvg({ mode: 'halftone', mark: 'pill' })).toMatch(/<rect [^>]* rx="[^"]+"/);
    const ascii = await makeSvg({ mode: 'ascii', glyphs: '<' });
    expect(ascii).toContain('<text ');
    expect(ascii).toContain('>&lt;</text>');
    expect(ascii).not.toContain('><</text>');

    const hostileAttribute = await makeSvg({ foreground: 'url(https://example.com/paint.svg#ink)' });
    expect(hostileAttribute).toContain('fill="#000000"');
    expect(hostileAttribute).not.toMatch(/fill="url\(|example\.com|<script|onload=/i);
  });

  it('renders the requested phase deterministically', async () => {
    const makeSvg = async (phase: number) => (await exportSvg({
      width: 400,
      height: 100,
      settings: {
        ...DEFAULT_RASTER_SETTINGS,
        source: 'waves',
        mode: 'halftone',
        motion: 'wave',
        fade: 'none',
        columns: 40,
      },
      phase,
      background: '#fff',
      transparent: true,
    })).blob.text();

    expect(await makeSvg(0.37)).toBe(await makeSvg(0.37));
    expect(await makeSvg(0.37)).not.toBe(await makeSvg(0.62));
  });

  it('records Matrix and Particles through the shared renderer contract', async () => {
    const matrix = await exportSvg({
      width: 400,
      height: 80,
      settings: settings({ mode: 'matrix', cutoff: 0, tone: 'brightness' }),
      source: image(0),
      phase: 0.2,
      background: '#fff',
      transparent: true,
    });

    const silhouettePixels: number[] = [];
    for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
      silhouettePixels.push(0, 0, 0, x >= 8 && x < 24 && y >= 8 && y < 24 ? 255 : 0);
    }
    const particles = await exportSvg({
      width: 320,
      height: 320,
      settings: settings({ mode: 'particles', columns: 64, edgeSensitivity: 0.25 }),
      source: {
        data: new Uint8ClampedArray(silhouettePixels),
        width: 32,
        height: 32,
        colorSpace: 'srgb',
      },
      phase: 0.4,
      background: '#fff',
      transparent: true,
    });

    expect(matrix.elementCount).toBeGreaterThan(100);
    expect(await matrix.blob.text()).toContain('<circle ');
    expect(particles.elementCount).toBeGreaterThan(10);
    expect(await particles.blob.text()).toContain('<circle ');
  });

  it('omits every background layer when transparent and adds an opaque fallback otherwise', async () => {
    const options = {
      width: 80,
      height: 40,
      settings: settings(),
      source: image(255, 0),
      phase: 0,
      background: 'rgba(32, 64, 96, 0.35)',
    };
    const transparent = await (await exportSvg({ ...options, transparent: true })).blob.text();
    const opaque = await (await exportSvg({ ...options, transparent: false })).blob.text();

    expect(transparent).not.toContain('data-svg-background');
    expect(opaque).toContain('<rect data-svg-background="fallback" x="0" y="0" width="80" height="40" fill="#000000"/>');
    expect(opaque).toContain('<rect data-svg-background="chosen" x="0" y="0" width="80" height="40" fill="rgba(32, 64, 96, 0.35)"/>');

    const externalPaint = await (await exportSvg({
      ...options,
      transparent: false,
      background: 'var(--remote-paint)',
    })).blob.text();
    expect(externalPaint).not.toContain('var(');
    expect(externalPaint.match(/data-svg-background/g)).toHaveLength(2);
    expect(externalPaint.match(/fill="#000000"/g)).toHaveLength(2);
  });
});
