import { describe, expect, it } from 'vitest';
import { prepareTransparentVideoPixels } from './transparent-pixels';

describe('transparent video pixel preparation', () => {
  it('keeps the compact monochrome path and preserves alpha exactly', () => {
    const pixels = new Uint8ClampedArray([
      1, 2, 3, 0,
      40, 50, 60, 127,
      70, 80, 90, 255,
    ]);

    prepareTransparentVideoPixels(pixels, 3, 1, [240, 120, 30]);

    expect(Array.from(pixels)).toEqual([
      240, 120, 30, 0,
      240, 120, 30, 127,
      240, 120, 30, 255,
    ]);
  });

  it('preserves visible multicolor RGB and fills only nearby fully transparent RGB', () => {
    const pixels = new Uint8ClampedArray(7 * 4);
    pixels.set([250, 20, 30, 192], 0);
    pixels.set([10, 80, 240, 96], 6 * 4);

    prepareTransparentVideoPixels(pixels, 7, 1, null);

    expect(Array.from(pixels.slice(0, 4))).toEqual([250, 20, 30, 192]);
    expect(Array.from(pixels.slice(4, 12))).toEqual([
      250, 20, 30, 0,
      250, 20, 30, 0,
    ]);
    expect(Array.from(pixels.slice(3 * 4, 4 * 4))).toEqual([0, 0, 0, 0]);
    expect(Array.from(pixels.slice(4 * 4, 6 * 4))).toEqual([
      10, 80, 240, 0,
      10, 80, 240, 0,
    ]);
    expect(Array.from(pixels.slice(6 * 4, 7 * 4))).toEqual([10, 80, 240, 96]);
  });

  it('never overwrites RGB or alpha of a semitransparent edge pixel', () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255,
      17, 31, 47, 1,
      0, 0, 0, 0,
    ]);

    prepareTransparentVideoPixels(pixels, 3, 1, null);

    expect(Array.from(pixels.slice(4, 8))).toEqual([17, 31, 47, 1]);
    expect(Array.from(pixels.slice(8, 12))).toEqual([17, 31, 47, 0]);
  });
});
