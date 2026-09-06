import { describe, expect, it } from 'vitest';

import {
  createSettingsDocument,
  getOutputSize,
  parseSettingsDocument,
  toRasterSettings,
  RASTER_PRESETS,
  type RasterDialValues,
} from './config';
import { createVariation } from './variation';

const values: RasterDialValues = {
  Source: { _collapsed: false, Pattern: 'waves', Seed: 1, 'Pattern scale': 1, Ribbon: { _collapsed: true, Count: 3, Width: .2, Twist: 1.5 }, Image: 'data:image/png;base64,large-binary-placeholder' },
  Effect: {
    _collapsed: false,
    Renderer: 'ascii', Tone: 'opacity', Cutoff: .08,
    Density: 110,
    'Mark size': 1,
    Contrast: 1.1,
    Foreground: '#aba1fa',
    Invert: false,
    Mark: 'circle',
    Glyphs: ' .:-=+*#%@',
  },
  Particles: { _collapsed: true, 'Edge sensitivity': .5, Irregularity: .25, 'Distribution seed': 1 },
  Palette: { _collapsed: true, 'Accent 1': '#ff75ed', 'Accent 2': '#ff342f', 'Accent amount': 0, 'Palette seed': 1 },
  Motion: { _collapsed: false, Movement: 'wave', Amplitude: 0.25, Duration: 6, Variation: 1, Direction: 0, Frequency: 1 },
  Output: {
    _collapsed: false,
    Canvas: 'wide',
    Resolution: '1x',
    Background: '#17161a',
    Transparent: false,
    'Text space': 'left',
    Video: 'webm',
    Quality: 'web',
    'Frame rate': '24',
  },
};

describe('Rabi Raster editor settings', () => {
  it('styles own only effect controls and preserve source, palette, motion and output', () => {
    for (const preset of RASTER_PRESETS) {
      expect(Object.keys(preset.values)).toEqual(['Effect']);
      expect(preset.values.Effect).not.toHaveProperty('Foreground');
    }
  });

  it('look and motion variations are independent, reversible and never capture image data', () => {
    for (const kind of ['look', 'motion', 'pattern', 'distribution', 'colors'] as const) {
      const { updates, undo } = createVariation(values, kind, new Uint32Array([47, 19, 31, 23]));
      const group = kind === 'look' ? 'Effect' : kind === 'motion' ? 'Motion' : kind === 'distribution' ? 'Particles' : kind === 'colors' ? 'Palette' : 'Source';
      expect(Object.keys(updates)).toEqual([group]);
      const changed = { ...values, [group]: { ...values[group], ...updates[group] } };
      const restored = { ...changed, [group]: { ...changed[group], ...undo[group] } };
      expect(restored).toEqual(values);
      expect(changed.Output).toEqual(values.Output);
      expect(changed.Source.Image).toEqual(values.Source.Image);
      expect(changed.Effect.Foreground).toEqual(values.Effect.Foreground);
      expect(changed.Motion.Movement).toEqual(values.Motion.Movement);
      expect(changed.Motion.Duration).toEqual(values.Motion.Duration);
    }
  });

  it('restores missing motion controls from earlier settings and saves new variants', () => {
    const document = JSON.parse(JSON.stringify(createSettingsDocument(values)));
    delete document.values.Motion.Variation;
    delete document.values.Motion.Direction;
    delete document.values.Motion.Frequency;
    expect(parseSettingsDocument(document).Motion).toMatchObject({ Variation: 1, Direction: 0, Frequency: 1 });
    document.values.Motion = { ...document.values.Motion, Movement: 'scatter', Variation: 921, Direction: 120, Frequency: 1.5 };
    expect(parseSettingsDocument(document).Motion).toMatchObject({ Movement: 'scatter', Variation: 921, Direction: 120, Frequency: 1.5, Duration: 6 });
  });
  it('preserves the leading blank in the ASCII luminance ramp', () => {
    expect(toRasterSettings(values).glyphs).toBe(' .:-=+*#%@');
  });

  it('keeps image bytes out of saved settings while preserving small controls', () => {
    const document = createSettingsDocument(values);
    expect(JSON.stringify(document)).not.toContain('large-binary-placeholder');
    expect(document.values.Source).toMatchObject({ Pattern: 'waves', Seed: 1, 'Pattern scale': 1, Ribbon: { Count: 3 } });
    expect(parseSettingsDocument(document)).toMatchObject({
      Source: { Pattern: 'waves' },
      Motion: { Duration: 6 },
    });
  });

  it('maps selected canvas and export resolution to actual pixels', () => {
    expect(getOutputSize(values)).toEqual({ width: 1600, height: 900, scale: 1 });
    expect(getOutputSize({
      ...values,
      Output: { ...values.Output, Canvas: 'portrait', Resolution: '2x' },
    })).toEqual({ width: 2160, height: 2700, scale: 2 });
    expect(getOutputSize({ ...values, Output: { ...values.Output, Resolution: '0.5x' } }))
      .toEqual({ width: 800, height: 450, scale: 0.5 });
    expect(getOutputSize({ ...values, Output: { ...values.Output, Canvas: 'portrait', Resolution: '0.5x' } }))
      .toEqual({ width: 544, height: 680, scale: 0.5 });
  });

  it('migrates earlier settings without losing their visual and export defaults', () => {
    const document = JSON.parse(JSON.stringify(createSettingsDocument(values)));
    delete document.values.Source.Seed;
    delete document.values.Source['Pattern scale'];
    delete document.values.Effect['Mark size'];
    delete document.values.Output.Quality;
    delete document.values.Output['Frame rate'];
    expect(parseSettingsDocument(document)).toMatchObject({
      Source: { Seed: 1, 'Pattern scale': 1 }, Effect: { 'Mark size': 1 },
      Output: { Quality: 'high', 'Frame rate': '30' },
    });
  });

  it('preserves a custom seeded pattern and transparent export through a saved file', () => {
    const custom: RasterDialValues = {
      ...values, Source: { ...values.Source, Pattern: 'contours', Seed: 4321, 'Pattern scale': 2.2 },
      Effect: { ...values.Effect, 'Mark size': 0.55 }, Output: { ...values.Output, Transparent: true },
    };
    const restored = parseSettingsDocument(JSON.parse(JSON.stringify(createSettingsDocument(custom))));
    expect(restored).toMatchObject({
      Source: { Pattern: 'contours', Seed: 4321, 'Pattern scale': 2.2 },
      Effect: { 'Mark size': 0.55 }, Output: { Transparent: true, Quality: 'web', 'Frame rate': '24' },
    });
  });

  it('rejects out-of-range settings instead of silently accepting them', () => {
    const document = createSettingsDocument(values);
    expect(() => parseSettingsDocument({
      ...document,
      values: {
        ...document.values,
        Effect: { ...document.values.Effect, Density: 999 },
      },
    })).toThrow('invalid or out-of-range');
  });
});


describe('extended visual controls persistence', () => {
  it('migrates old files with accents off and preserves new controls through JSON', () => {
    const old = JSON.parse(JSON.stringify(createSettingsDocument(values)));
    delete old.values.Palette; delete old.values.Particles; delete old.values.Source.Ribbon;
    delete old.values.Effect.Tone; delete old.values.Effect.Cutoff;
    expect(parseSettingsDocument(old)).toMatchObject({ Palette: { 'Accent amount': 0 }, Particles: { 'Distribution seed': 1 }, Effect: { Tone: 'opacity', Cutoff: .08 } });
    const current = createSettingsDocument({ ...values, Source: { ...values.Source, Pattern: 'ribbon' }, Palette: { ...values.Palette, 'Accent amount': .2 }, Effect: { ...values.Effect, Renderer: 'particles' } });
    expect(parseSettingsDocument(current)).toMatchObject({ Source: { Pattern: 'ribbon' }, Palette: { 'Accent amount': .2 }, Effect: { Renderer: 'particles' } });
  });
  it('rejects invalid new control ranges', () => {
    const doc = createSettingsDocument(values);
    expect(() => parseSettingsDocument({ ...doc, values: { ...doc.values, Particles: { Irregularity: 9 } } })).toThrow();
  });
});
