import { describe, expect, it } from 'vitest';
import { assertExportDimensions, assertVideoDimensions, getVideoFrameCount, resolveFileName } from './validation';

describe('export validation', () => {
  it('accepts exact 30 FPS durations and derives their frame counts', () => {
    expect(getVideoFrameCount(6)).toBe(180);
    expect(getVideoFrameCount(1 / 30)).toBe(1);
    expect(() => getVideoFrameCount(1.01)).toThrow(/30 FPS frame grid/);
  });

  it('accepts exact 24 FPS durations when that frame rate is selected', () => {
    expect(getVideoFrameCount(6, 24)).toBe(144);
    expect(getVideoFrameCount(1 / 24, 24)).toBe(1);
    expect(() => getVideoFrameCount(1 / 30, 24)).toThrow(/24 FPS frame grid/);
  });

  it('requires safe raster dimensions and even video dimensions', () => {
    expect(() => assertExportDimensions(1920, 1080)).not.toThrow();
    expect(() => assertExportDimensions(0, 1080)).toThrow(/positive integers/);
    expect(() => assertExportDimensions(8193, 1080)).toThrow(/supported/);
    expect(() => assertVideoDimensions(1921, 1080)).toThrow(/even numbers/);
  });

  it('normalizes download names and replaces an existing extension', () => {
    expect(resolveFileName('  Portfolio Loop.mov ', 'webm')).toBe('Portfolio-Loop.webm');
    expect(resolveFileName('', 'png')).toBe('rabi-raster.png');
  });
});
