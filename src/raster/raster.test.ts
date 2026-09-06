import { describe, expect, it } from 'vitest';
import { DEFAULT_RASTER_SETTINGS, type RasterSettings } from './settings';
import { sampleRasterField, shouldDither, scatterOffset } from './field';
import { renderRasterFrame } from './render';
import { contourMinimumSpacing, getContourAnchors, particlePulseAlpha } from './particles';

const options = (overrides: Partial<RasterSettings> = {}) => ({
  ...DEFAULT_RASTER_SETTINGS, fade: 'none' as const, ...overrides,
});
const sample = (settings: RasterSettings, phase = 0, x = 0.61, y = 0.37, source?: ImageData) =>
  sampleRasterField({ settings, phase, width: 1200, height: 800, source }, x, y);
const rgba = (pixels: number[], width = 1): ImageData => ({
  data: new Uint8ClampedArray(pixels), width, height: pixels.length / 4 / width,
  colorSpace: 'srgb',
});
const PROCEDURAL_SOURCES: RasterSettings['source'][] = [
  'waves', 'ring', 'noise', 'contours', 'orbits', 'interference', 'ribbon', 'organic',
];
const grid = (settings: RasterSettings, phase = 0) =>
  Array.from({ length: 35 }, (_, i) => sample(settings, phase, (i % 7 + 0.5) / 7, (Math.floor(i / 7) + 0.5) / 5).value);
const fieldDifference = (a: number[], b: number[]) =>
  Math.max(...a.map((value, index) => Math.abs(value - b[index])));

function recordingContext() {
  const rects: number[][] = [];
  const arcs: number[][] = [];
  const fills: Array<{ style: string; alpha: number }> = [];
  const clears: number[][] = [];
  const texts: Array<[string, number, number]> = [];
  const context = {
    save() {}, restore() {}, beginPath() {},
    fill() { fills.push({ style: context.fillStyle as string, alpha: context.globalAlpha }); },
    arc: (...args: number[]) => arcs.push(args), roundRect() {},
    fillText: (text: string, x: number, y: number) => texts.push([text, x, y]),
    clearRect: (...args: number[]) => clears.push(args),
    fillRect: (...args: number[]) => rects.push(args),
    fillStyle: '', globalAlpha: 1, textAlign: '', textBaseline: '', font: '',
  } as unknown as CanvasRenderingContext2D;
  return { context, rects, arcs, fills, clears, texts };
}

describe('Raster image and animation contract', () => {
  it('defines the complete new effect contract with backwards-compatible defaults', () => {
    expect(DEFAULT_RASTER_SETTINGS).toMatchObject({
      tone: 'opacity', cutoff: .08, edgeSensitivity: .5, irregularity: .25,
      distributionSeed: 1, accentColor: '#ff75ed', accentColor2: '#ff342f',
      accentAmount: 0, paletteSeed: 1, ribbonCount: 3, ribbonWidth: .2, ribbonTwist: 1.5,
    });
  });

  it('varies a photograph with a motion seed independently of its generator seed', () => {
    const photo = rgba([0,0,0,255, 255,255,255,255], 2);
    const settings = options({ source: 'image', motion: 'wave', motionSeed: 1, amplitude: .7 });
    expect(sample(settings, .31, .5, .5, photo)).not.toEqual(sample({ ...settings, motionSeed: 452 }, .31, .5, .5, photo));
    expect(sample(settings, .31, .5, .5, photo)).toEqual(sample({ ...settings, seed: 452 }, .31, .5, .5, photo));
    for (const motion of ['wave', 'drift', 'pulse', 'scatter'] as const) {
      expect(sample({ ...settings, motion }, 0, .5, .5, photo)).toEqual(sample({ ...settings, motion }, 1, .5, .5, photo));
    }
  });

  it('pulse preserves the photo structure and scatter moves marks then returns exactly', () => {
    const settings = options({ source: 'image', motion: 'pulse', amplitude: .8 });
    const photo = rgba([0,0,0,255]);
    expect(sample(settings, .5, .5, .5, photo).value).toBe(sample(settings, 0, .5, .5, photo).value);
    expect(sample(settings, .5, .5, .5, photo).alpha).toBeLessThan(sample(settings, 0, .5, .5, photo).alpha);
    const input = { width: 800, height: 450, settings: { ...settings, motion: 'scatter' as const }, phase: 0 };
    expect(scatterOffset(input, 5, 6, 10)).toEqual({ x: 0, y: 0 });
    expect(scatterOffset({ ...input, phase: 1 }, 5, 6, 10)).toEqual(scatterOffset(input, 5, 6, 10));
    expect(Math.hypot(...Object.values(scatterOffset({ ...input, phase: .5 }, 5, 6, 10)))).toBeGreaterThan(10);
  });
  it('stitches every procedural source and motion at a full-cycle boundary', () => {
    for (const source of PROCEDURAL_SOURCES) {
      for (const motion of ['wave', 'drift'] as const) {
        const settings = options({ source, motion });
        for (const x of [0.1, 0.4, 0.7, 0.9]) {
          expect(sample(settings, 0, x)).toEqual(sample(settings, 1, x));
          expect(sample(settings, 0.25, x)).toEqual(sample(settings, 2.25, x));
        }
      }
    }
  });

  it('is deterministic and lets seed reshape every procedural source', () => {
    for (const source of PROCEDURAL_SOURCES) {
      const first = options({ source, seed: 143 });
      const repeat = options({ source, seed: 143 });
      const changed = options({ source, seed: 977 });
      const baseline = grid(first, 0.37);
      expect(baseline).toEqual(grid(repeat, 0.37));
      expect(fieldDifference(baseline, grid(changed, 0.37))).toBeGreaterThan(0.05);
    }
  });

  it('lets pattern scale reshape every procedural source without changing the output grid', () => {
    for (const source of PROCEDURAL_SOURCES) {
      const compact = options({ source, patternScale: 0.5 });
      const detailed = options({ source, patternScale: 2.4 });
      expect(fieldDifference(grid(detailed, 0.2), grid(compact, 0.2))).toBeGreaterThan(0.05);
    }
  });

  it('gives the new procedural sources distinct fields', () => {
    const fields = (['contours', 'orbits', 'interference', 'ribbon', 'organic'] as const)
      .map(source => grid(options({ source, seed: 41, patternScale: 1.2 }), 0.31));
    for (let a = 0; a < fields.length; a++) {
      for (let b = a + 1; b < fields.length; b++) {
        expect(fieldDifference(fields[a], fields[b])).toBeGreaterThan(0.12);
      }
    }
  });

  it('lets ribbon controls reshape distinct bands and keeps new source loops seamless', () => {
    const sparse = options({ source: 'ribbon', ribbonCount: 1, ribbonWidth: .08, ribbonTwist: .5 });
    const dense = options({ source: 'ribbon', ribbonCount: 7, ribbonWidth: .4, ribbonTwist: 3.5 });
    expect(fieldDifference(grid(sparse, .3), grid(dense, .3))).toBeGreaterThan(.2);
    for (const source of ['ribbon', 'organic'] as const) {
      const moving = options({ source, motion: 'wave', amplitude: .9 });
      expect(grid(moving, 0)).toEqual(grid(moving, 1));
      expect(grid({ ...moving, amplitude: 0 }, .13)).toEqual(grid({ ...moving, amplitude: 0 }, .71));
    }
  });

  it('keeps the new source fields continuous across the loop seam at every amplitude', () => {
    for (const source of ['ribbon', 'organic'] as const) {
      for (const amplitude of [.25, .8]) {
        for (const motion of ['wave', 'drift'] as const) {
          const settings = options({ source, motion, amplitude });
          expect(fieldDifference(grid(settings, 0), grid(settings, 1 - 1e-6))).toBeLessThan(.001);
        }
      }
    }
  });

  it('keeps paused output stable and animated output visibly different', () => {
    for (const source of PROCEDURAL_SOURCES) {
      const still = options({ source, motion: 'off', amplitude: 1 });
      expect(grid(still, 0)).toEqual(grid(still, 0.37));
    }
    const moving = options({ motion: 'wave', amplitude: 0.8 });
    expect(sample(moving, 0).value).not.toBeCloseTo(sample(moving, 0.37).value, 3);
  });

  it('treats image shadows as ink and invert reverses brightness without changing alpha', () => {
    const settings = options({ source: 'image', motion: 'off', contrast: 1 });
    expect(sample(settings, 0, 0.5, 0.5, rgba([0, 0, 0, 255])).value).toBe(1);
    expect(sample(settings, 0, 0.5, 0.5, rgba([255, 255, 255, 255])).value).toBeCloseTo(0, 12);
    const transparent = sample({ ...settings, invert: true }, 0, 0.5, 0.5, rgba([0, 0, 0, 0]));
    expect(transparent.alpha).toBe(0);
  });

  it('does not fabricate artwork while image input is absent', () => {
    expect(sample(options({ source: 'image' })).alpha).toBe(0);
  });

  it('interpolates transparent edges without mixing invisible white into the ink', () => {
    const settings = options({ source: 'image', motion: 'off', contrast: 1 });
    const image = rgba([255,255,255,0, 0,0,0,255], 2);
    const out = sample(settings, 0, 0.5, 0.5, image);
    expect(out.alpha).toBeCloseTo(0.5);
    expect(out.value).toBe(1);
  });

  it('keeps the source centered with cover cropping for a different canvas aspect ratio', () => {
    // A horizontal 3:1 strip. A square crop should sample only its middle band.
    const source = rgba([255,255,255,255, 0,0,0,255, 255,255,255,255], 3);
    const settings = options({ source: 'image', motion: 'off', contrast: 1 });
    const center = sampleRasterField({settings,phase:0,width:300,height:300,source},0.5,0.5);
    expect(center.value).toBe(1);
  });

  it('fades the selected side to leave clear space for text', () => {
    const left = options({ fade: 'left' });
    expect(sample(left, 0, 0.02).alpha).toBe(0);
    expect(sample(left, 0, 0.95).alpha).toBe(1);
    const right = options({ fade: 'right' });
    expect(sample(right, 0, 0.98).alpha).toBe(0);
    expect(sample(right, 0, 0.05).alpha).toBe(1);
  });

  it('keeps ordered dithering binary and preserves midtone coverage', () => {
    const coverage = (v: number) => Array.from({length:16}, (_, i) => shouldDither(v, i % 4, Math.floor(i / 4))).filter(Boolean).length;
    expect(coverage(0)).toBe(0);
    expect(coverage(0.5)).toBe(8);
    expect(coverage(1)).toBe(16);
  });

  it('produces finite bounded values for all sources across the image', () => {
    for (const source of PROCEDURAL_SOURCES) {
      const settings = options({source,contrast:2,amplitude:1});
      for (let i=0;i<100;i++) {
        const out = sample(settings, i/100, (i%10)/9, Math.floor(i/10)/9);
        expect(Number.isFinite(out.value)).toBe(true);
        expect(out.value).toBeGreaterThanOrEqual(0);
        expect(out.value).toBeLessThanOrEqual(1);
        expect(out.alpha).toBeGreaterThanOrEqual(0);
        expect(out.alpha).toBeLessThanOrEqual(1);
      }
    }
  });

  it('scales dither cells around fixed centers and clears to transparency', () => {
    const source = rgba([0, 0, 0, 255]);
    const full = recordingContext();
    renderRasterFrame(full.context, {
      width: 400, height: 10, phase: 0, source,
      settings: options({ source: 'image', mode: 'dither', columns: 40, markScale: 1 }),
    });
    const half = recordingContext();
    renderRasterFrame(half.context, {
      width: 400, height: 10, phase: 0, source,
      settings: options({ source: 'image', mode: 'dither', columns: 40, markScale: 0.5 }),
    });
    expect(full.clears[0]).toEqual([0, 0, 400, 10]);
    expect(full.rects[0]).toEqual([0, 0, 10, 10]);
    expect(half.rects[0]).toEqual([2.5, 2.5, 5, 5]);
  });

  it('scales halftone marks and ASCII glyphs without moving their cell centers', () => {
    const source = rgba([0, 0, 0, 255]);
    const full = recordingContext();
    renderRasterFrame(full.context, {
      width: 400, height: 14, phase: 0, source,
      settings: options({ source: 'image', mode: 'halftone', mark: 'square', columns: 40, markScale: 1 }),
    });
    const half = recordingContext();
    renderRasterFrame(half.context, {
      width: 400, height: 14, phase: 0, source,
      settings: options({ source: 'image', mode: 'halftone', mark: 'square', columns: 40, markScale: 0.5 }),
    });
    expect(full.rects[0]).toEqual([0.5999999999999996, 0.5999999999999996, 8.8, 8.8]);
    expect(half.rects[0]).toEqual([2.8, 2.8, 4.4, 4.4]);

    const glyph = recordingContext();
    renderRasterFrame(glyph.context, {
      width: 400, height: 14, phase: 0, source,
      settings: options({ source: 'image', mode: 'ascii', columns: 40, markScale: 0.5 }),
    });
    expect(glyph.context.font).toContain('6.4px');
    expect(glyph.texts[0]?.slice(1)).toEqual([5, 7]);
  });

  it('renders matrix dots at a fixed size while tone controls opacity or RGB brightness', () => {
    const gradient = rgba([200,200,200,255, 0,0,0,255], 2);
    const opacity = recordingContext();
    renderRasterFrame(opacity.context, {
      width: 400, height: 10, phase: 0, source: gradient,
      settings: options({ source: 'image', mode: 'matrix', tone: 'opacity', columns: 40,
        cutoff: 0, foreground: 'rgba(120, 80, 40, 0.35)' }),
    });
    expect(opacity.arcs[0][2]).toBe(opacity.arcs.at(-1)?.[2]);
    expect(opacity.fills[0].style).toBe('rgba(120, 80, 40, 0.35)');
    expect(opacity.fills[0].alpha).toBeLessThan(opacity.fills.at(-1)!.alpha);

    const brightness = recordingContext();
    renderRasterFrame(brightness.context, {
      width: 400, height: 10, phase: 0, source: gradient,
      settings: options({ source: 'image', mode: 'matrix', tone: 'brightness', columns: 40,
        cutoff: 0, foreground: 'rgba(120, 80, 40, 0.35)' }),
    });
    expect(brightness.fills[0].alpha).toBeCloseTo(brightness.fills.at(-1)!.alpha);
    expect(brightness.fills[0].style).not.toBe(brightness.fills.at(-1)!.style);
    expect(brightness.fills.every(fill => fill.style.endsWith(', 0.35)'))).toBe(true);
  });

  it('selects palette accents deterministically per point without frame flicker', () => {
    const source = rgba([0,0,0,255]);
    const render = (phase: number, paletteSeed = 83) => {
      const out = recordingContext();
      renderRasterFrame(out.context, { width: 400, height: 40, phase, source,
        settings: options({ source: 'image', mode: 'matrix', motion: 'pulse', amplitude: .8,
          columns: 40, accentAmount: 1, paletteSeed }),
      });
      return out.fills.map(fill => fill.style);
    };
    expect(new Set(render(.2))).toEqual(new Set(['#ff75ed', '#ff342f']));
    expect(render(.2)).toEqual(render(.7));
    expect(render(.2, 83)).not.toEqual(render(.2, 84));
  });

  it('extracts stable, spaced contour anchors from a synthetic alpha silhouette', () => {
    const pixels: number[] = [];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const inside = x >= 8 && x < 24 && y >= 8 && y < 24;
      pixels.push(255, 255, 255, inside ? 255 : 0);
    }
    const source = rgba(pixels, 32);
    const input = { width: 320, height: 320, phase: 0, source,
      settings: options({ source: 'image', mode: 'particles', columns: 64,
        edgeSensitivity: .25, irregularity: .5, distributionSeed: 413 }),
    };
    const anchors = getContourAnchors(input);
    expect(anchors.length).toBeGreaterThan(20);
    expect(getContourAnchors({ ...input, phase: .73 })).toBe(anchors);
    expect(getContourAnchors({ ...input, settings: { ...input.settings, cutoff: .99 } })).toBe(anchors);
    expect(anchors.every(({ u, v }) =>
      Math.min(Math.abs(u - .25), Math.abs(u - .75), Math.abs(v - .25), Math.abs(v - .75)) < .07,
    )).toBe(true);
    const minimum = contourMinimumSpacing(input);
    for (let a = 0; a < anchors.length; a++) for (let b = a + 1; b < anchors.length; b++) {
      expect(Math.hypot((anchors[a].u - anchors[b].u) * input.width,
        (anchors[a].v - anchors[b].v) * input.height)).toBeGreaterThanOrEqual(minimum - 1e-8);
    }
    expect(getContourAnchors({ ...input, settings: { ...input.settings, distributionSeed: 414 } }))
      .not.toEqual(anchors);
  });

  it('uses higher edge sensitivity to include weaker photograph details', () => {
    const pixels: number[] = [];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const inside = x >= 8 && x < 24 && y >= 8 && y < 24;
      const channel = inside ? 220 : 255;
      pixels.push(channel, channel, channel, 255);
    }
    const source = rgba(pixels, 32);
    const base = { width: 320, height: 320, phase: 0, source,
      settings: options({ source: 'image', mode: 'particles', columns: 64, irregularity: .25 }),
    };
    const low = getContourAnchors({ ...base, settings: { ...base.settings, edgeSensitivity: .1 } });
    const high = getContourAnchors({ ...base, settings: { ...base.settings, edgeSensitivity: .9 } });
    expect(high.length).toBeGreaterThan(low.length);
  });

  it('renders procedural particles from stable anchors and loops their motion', () => {
    const settings = options({ source: 'organic', mode: 'particles', motion: 'wave', amplitude: .8,
      columns: 48, edgeSensitivity: .35, irregularity: .6, distributionSeed: 77 });
    const render = (phase: number) => {
      const out = recordingContext();
      renderRasterFrame(out.context, { width: 480, height: 320, phase, settings });
      return out.arcs;
    };
    expect(render(0).length).toBeGreaterThan(10);
    expect(render(0)).toEqual(render(1));
    expect(render(.4)).not.toEqual(render(0));
  });

  it('varies particle pulse timing with Motion Variation while preserving the loop seam', () => {
    const input = { width: 480, height: 320, phase: .31,
      settings: options({ source: 'organic', mode: 'particles', motion: 'pulse', amplitude: .8 }),
    };
    expect(particlePulseAlpha(input)).not.toBe(particlePulseAlpha({
      ...input, settings: { ...input.settings, motionSeed: 452 },
    }));
    expect(particlePulseAlpha({ ...input, phase: 0 })).toBe(particlePulseAlpha({ ...input, phase: 1 }));
    expect(particlePulseAlpha({ ...input, phase: .2, settings: { ...input.settings, amplitude: 0 } }))
      .toBe(particlePulseAlpha({ ...input, phase: .8, settings: { ...input.settings, amplitude: 0 } }));
  });
});
