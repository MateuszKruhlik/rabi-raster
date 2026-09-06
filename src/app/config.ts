import type {
  DialConfig,
  DialKitValueUpdates,
  ResolvedValues,
} from 'dialkit';

import {
  DEFAULT_RASTER_SETTINGS,
  type RasterSettings,
} from '../raster/settings';

export const rasterDialConfig = {
  Source: {
    _collapsed: false,
    Pattern: {
      type: 'select',
      options: [
        { value: 'waves', label: 'Waves' },
        { value: 'ring', label: 'Ring' },
        { value: 'noise', label: 'Noise' },
        { value: 'contours', label: 'Contours' },
        { value: 'orbits', label: 'Orbits' },
        { value: 'interference', label: 'Interference' },
        { value: 'ribbon', label: 'Ribbon' },
        { value: 'organic', label: 'Organic Field' },
        { value: 'image', label: 'Image' },
      ],
      default: 'organic',
    },
    Image: { type: 'image' },
    Seed: [1, 1, 9999, 1],
    'Pattern scale': [1, 0.5, 3, 0.05],
    Ribbon: { _collapsed: true, Count: [3, 1, 8, 1], Width: [.2, .05, .5, .01], Twist: [1.5, .5, 4, .05] },
  },
  Effect: {
    _collapsed: false,
    Renderer: {
      type: 'select',
      options: [
        { value: 'halftone', label: 'Halftone' },
        { value: 'dither', label: 'Dither' },
        { value: 'ascii', label: 'ASCII' },
        { value: 'matrix', label: 'Dot Matrix' },
        { value: 'particles', label: 'Contour Particles' },
      ],
      default: 'dither',
    },
    Tone: { type: 'select', options: ['opacity', 'brightness'], default: 'opacity' },
    Cutoff: [.08, 0, 1, .01],
    Density: [132, 40, 180, 1],
    'Mark size': [1, 0.25, 1.5, 0.05],
    Contrast: [1.7, 0.5, 2, 0.05],
    Foreground: {
      type: 'color',
      default: DEFAULT_RASTER_SETTINGS.foreground,
    },
    Invert: DEFAULT_RASTER_SETTINGS.invert as boolean,
    Mark: {
      type: 'select',
      options: ['circle', 'square', 'pill'],
      default: DEFAULT_RASTER_SETTINGS.mark,
    },
    Glyphs: {
      type: 'text',
      default: DEFAULT_RASTER_SETTINGS.glyphs,
      placeholder: ' .:-=+*#%@',
    },
  },
  Particles: {
    _collapsed: true,
    'Edge sensitivity': [.5, 0, 1, .01],
    Irregularity: [.25, 0, 1, .01],
    'Distribution seed': [1, 1, 9999, 1],
  },
  Palette: {
    _collapsed: true,
    'Accent 1': { type: 'color', default: '#ff75ed' },
    'Accent 2': { type: 'color', default: '#ff342f' },
    'Accent amount': [0, 0, 1, .01],
    'Palette seed': [1, 1, 9999, 1],
  },
  Motion: {
    _collapsed: false,
    Movement: {
      type: 'select',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'wave', label: 'Wave' },
        { value: 'drift', label: 'Drift' },
        { value: 'pulse', label: 'Pulse' },
        { value: 'scatter', label: 'Scatter & return' },
      ],
      default: DEFAULT_RASTER_SETTINGS.motion,
    },
    Amplitude: [DEFAULT_RASTER_SETTINGS.amplitude, 0, 1, 0.01],
    Duration: [6, 2, 12, 0.5],
    Variation: [1, 1, 9999, 1],
    Direction: [0, 0, 360, 5],
    Frequency: [1, 0.5, 2, 0.05],
  },
  Output: {
    _collapsed: false,
    Canvas: {
      type: 'select',
      options: [
        { value: 'wide', label: '1600 × 900' },
        { value: 'square', label: 'Square' },
        { value: 'portrait', label: 'Portrait' },
      ],
      default: 'wide',
    },
    Resolution: {
      type: 'select',
      options: [
        { value: '0.5x', label: '0.5× · smaller' },
        { value: '1x', label: '1×' },
        { value: '2x', label: '2×' },
      ],
      default: '1x',
    },
    Background: { type: 'color', default: '#17161a' },
    Transparent: false as boolean,
    'Text space': {
      type: 'select',
      options: [
        { value: 'none', label: 'None' },
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
      ],
      default: DEFAULT_RASTER_SETTINGS.fade,
    },
    Video: {
      type: 'select',
      options: [
        { value: 'webm', label: 'WebM' },
        { value: 'mp4', label: 'MP4' },
      ],
      default: 'webm',
    },
    Quality: {
      type: 'select',
      options: [
        { value: 'web', label: 'Web · compact' },
        { value: 'high', label: 'High · more detail' },
      ],
      default: 'web',
    },
    'Frame rate': {
      type: 'select', options: ['24', '30'], default: '24',
    },
  },
} satisfies DialConfig;

export type RasterDialValues = ResolvedValues<typeof rasterDialConfig>;
export type RasterDialUpdates = DialKitValueUpdates<typeof rasterDialConfig>;

export type OutputSizeId = 'wide' | 'square' | 'portrait';
export type OutputScale = '0.5x' | '1x' | '2x';
export type VideoFormat = 'webm' | 'mp4';

export const OUTPUT_SIZES: Record<
  OutputSizeId,
  Readonly<{ width: number; height: number; label: string }>
> = {
  wide: { width: 1600, height: 900, label: '1600 × 900' },
  square: { width: 1400, height: 1400, label: '1400 × 1400' },
  portrait: { width: 1080, height: 1350, label: '1080 × 1350' },
};

export interface RasterPreset {
  id: string;
  name: string;
  note: string;
  swatches: readonly [string, string];
  values: RasterDialUpdates;
}

export const RASTER_PRESETS: readonly RasterPreset[] = [
  {
    id: 'dot-matrix', name: 'Dot Matrix', note: 'Fixed dots, tonal image', swatches: ['#eee', '#111'],
    values: { Effect: { Renderer: 'matrix', Density: 95, 'Mark size': .8, Contrast: 1.2, Invert: false, Mark: 'circle', Tone: 'opacity', Cutoff: .08 } },
  },
  {
    id: 'contour-particles', name: 'Contour Particles', note: 'Points along the edges', swatches: ['#eee', '#1313ff'],
    values: { Effect: { Renderer: 'particles', Density: 110, 'Mark size': .7, Contrast: 1.1, Invert: false, Mark: 'circle' } },
  },
  {
    id: 'violet-tide',
    name: 'Soft Dots',
    note: 'Soft halftone texture',
    swatches: ['#aba1fa', '#262132'],
    values: {
      Effect: {
        'Mark size': 1, Glyphs: ' .:-=+*#%@', Renderer: 'halftone', Density: 110, Contrast: 1.1,
        Invert: false, Mark: 'circle',
      },
    },
  },
  {
    id: 'ink-ring',
    name: 'Rounded Dots',
    note: 'Dense rounded marks',
    swatches: ['#f0ece3', '#1b1b19'],
    values: {
      Effect: {
        'Mark size': 1, Glyphs: ' .:-=+*#%@', Renderer: 'halftone', Density: 144, Contrast: 1.45,
        Invert: false, Mark: 'pill',
      },
    },
  },
  {
    id: 'signal-noise',
    name: 'Signal Dither',
    note: 'Electric ordered dither',
    swatches: ['#c7ff4a', '#132018'],
    values: {
      Effect: {
        'Mark size': 1, Glyphs: ' .:-=+*#%@', Renderer: 'dither', Density: 132, Contrast: 1.7,
        Invert: false,
      },
    },
  },
  {
    id: 'mono-grid',
    name: 'Mono Grid',
    note: 'Sharp print texture',
    swatches: ['#111111', '#f3efe5'],
    values: {
      Effect: {
        'Mark size': 1, Glyphs: ' .:-=+*#%@', Renderer: 'dither', Density: 172, Contrast: 1.8,
        Invert: true,
      },
    },
  },
  {
    id: 'type-field',
    name: 'Type Field',
    note: 'ASCII texture study',
    swatches: ['#ff806c', '#2b1720'],
    values: {
      Effect: {
        'Mark size': 1, Renderer: 'ascii', Density: 92, Contrast: 1.25,
        Invert: false, Glyphs: ' .·:+*#@',
      },
    },
  },
  {
    id: 'poster-drift',
    name: 'Large Cells',
    note: 'Large graphic cells',
    swatches: ['#6757ff', '#eee9dd'],
    values: {
      Effect: {
        'Mark size': 1, Glyphs: ' .:-=+*#%@', Renderer: 'halftone', Density: 62, Contrast: 0.85,
        Invert: false, Mark: 'square',
      },
    },
  },
] as const;

const sourceValues = ['waves', 'ring', 'noise', 'contours', 'orbits', 'interference', 'ribbon', 'organic', 'image'] as const;
const rendererValues = ['halftone', 'dither', 'ascii', 'matrix', 'particles'] as const;
const markValues = ['circle', 'square', 'pill'] as const;
const motionValues = ['off', 'wave', 'drift', 'pulse', 'scatter'] as const;
const fadeValues = ['none', 'left', 'right'] as const;
const sizeValues = ['wide', 'square', 'portrait'] as const;
const scaleValues = ['0.5x', '1x', '2x'] as const;
const videoValues = ['webm', 'mp4'] as const;

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && options.includes(value as T);
}

function finiteNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

export function toRasterSettings(values: RasterDialValues): RasterSettings {
  return {
    source: values.Source.Pattern as RasterSettings['source'],
    mode: values.Effect.Renderer as RasterSettings['mode'],
    tone: values.Effect.Tone as RasterSettings['tone'],
    cutoff: values.Effect.Cutoff,
    edgeSensitivity: values.Particles['Edge sensitivity'],
    irregularity: values.Particles.Irregularity,
    distributionSeed: values.Particles['Distribution seed'],
    accentColor: values.Palette['Accent 1'],
    accentColor2: values.Palette['Accent 2'],
    accentAmount: values.Palette['Accent amount'],
    paletteSeed: values.Palette['Palette seed'],
    ribbonCount: values.Source.Ribbon.Count,
    ribbonWidth: values.Source.Ribbon.Width,
    ribbonTwist: values.Source.Ribbon.Twist,
    columns: values.Effect.Density,
    seed: values.Source.Seed,
    patternScale: values.Source['Pattern scale'],
    markScale: values.Effect['Mark size'],
    contrast: values.Effect.Contrast,
    foreground: values.Effect.Foreground,
    invert: values.Effect.Invert,
    mark: values.Effect.Mark as RasterSettings['mark'],
    motion: values.Motion.Movement as RasterSettings['motion'],
    amplitude: values.Motion.Amplitude,
    motionSeed: values.Motion.Variation,
    direction: values.Motion.Direction,
    frequency: values.Motion.Frequency,
    fade: values.Output['Text space'] as RasterSettings['fade'],
    glyphs: values.Effect.Glyphs.trim()
      ? values.Effect.Glyphs
      : DEFAULT_RASTER_SETTINGS.glyphs,
  };
}

export function getOutputSize(values: RasterDialValues) {
  const preset = OUTPUT_SIZES[values.Output.Canvas as OutputSizeId] ?? OUTPUT_SIZES.wide;
  const scale = values.Output.Resolution === '2x' ? 2 : values.Output.Resolution === '0.5x' ? 0.5 : 1;
  // Half of 1080 × 1350 has an odd height. Keep the exact 4:5 composition on an even video grid.
  if (scale === 0.5 && values.Output.Canvas === 'portrait') return { width: 544, height: 680, scale };
  return { width: preset.width * scale, height: preset.height * scale, scale };
}

export function createSettingsDocument(values: RasterDialValues) {
  return {
    version: 1,
    values: {
      Source: { Pattern: values.Source.Pattern, Seed: values.Source.Seed, 'Pattern scale': values.Source['Pattern scale'], Ribbon: { ...values.Source.Ribbon } },
      Effect: { ...values.Effect },
      Particles: { ...values.Particles },
      Palette: { ...values.Palette },
      Motion: { ...values.Motion },
      Output: { ...values.Output },
    },
  } as const;
}

export function parseSettingsDocument(input: unknown): RasterDialUpdates {
  if (!input || typeof input !== 'object') throw new Error('Settings file is not an object.');
  const document = input as Record<string, unknown>;
  if (document.version !== 1 || !document.values || typeof document.values !== 'object') {
    throw new Error('Unsupported Rabi Raster settings version.');
  }
  const values = document.values as Record<string, unknown>;
  const source = values.Source as Record<string, unknown> | undefined;
  const effect = values.Effect as Record<string, unknown> | undefined;
  const motion = values.Motion as Record<string, unknown> | undefined;
  const output = values.Output as Record<string, unknown> | undefined;
  if (!source || !effect || !motion || !output) throw new Error('Settings groups are incomplete.');

  const particles = (values.Particles ?? {}) as Record<string, unknown>;
  const palette = (values.Palette ?? {}) as Record<string, unknown>;
  const ribbon = (source.Ribbon ?? {}) as Record<string, unknown>;
  const tone = effect.Tone ?? 'opacity';
  const cutoff = finiteNumber(effect.Cutoff ?? .08, 0, 1);
  const edgeSensitivity = finiteNumber(particles['Edge sensitivity'] ?? .5, 0, 1);
  const irregularity = finiteNumber(particles.Irregularity ?? .25, 0, 1);
  const distributionSeed = finiteNumber(particles['Distribution seed'] ?? 1, 1, 9999);
  const accentColor = palette['Accent 1'] ?? '#ff75ed';
  const accentColor2 = palette['Accent 2'] ?? '#ff342f';
  const accentAmount = finiteNumber(palette['Accent amount'] ?? 0, 0, 1);
  const paletteSeed = finiteNumber(palette['Palette seed'] ?? 1, 1, 9999);
  const ribbonCount = finiteNumber(ribbon.Count ?? 3, 1, 8);
  const ribbonWidth = finiteNumber(ribbon.Width ?? .2, .05, .5);
  const ribbonTwist = finiteNumber(ribbon.Twist ?? 1.5, .5, 4);

  const density = finiteNumber(effect.Density, 40, 180);
  const contrast = finiteNumber(effect.Contrast, 0.5, 2);
  const amplitude = finiteNumber(motion.Amplitude, 0, 1);
  const duration = finiteNumber(motion.Duration, 2, 12);
  const motionSeed = finiteNumber(motion.Variation ?? 1, 1, 9999);
  const direction = finiteNumber(motion.Direction ?? 0, 0, 360);
  const frequency = finiteNumber(motion.Frequency ?? 1, 0.5, 2);
  // Version 1 files predate these controls. Restore their original rendering/export defaults.
  const seed = finiteNumber(source.Seed === undefined ? 1 : source.Seed, 1, 9999);
  const patternScale = finiteNumber(source['Pattern scale'] === undefined ? 1 : source['Pattern scale'], 0.5, 3);
  const markScale = finiteNumber(effect['Mark size'] === undefined ? 1 : effect['Mark size'], 0.25, 1.5);
  const quality = output.Quality === undefined ? 'high' : output.Quality;
  const frameRate = output['Frame rate'] === undefined ? '30' : output['Frame rate'];

  if (
    !isOneOf(tone, ['opacity', 'brightness']) || cutoff === null ||
    edgeSensitivity === null || irregularity === null || distributionSeed === null || !Number.isInteger(distributionSeed) ||
    typeof accentColor !== 'string' || typeof accentColor2 !== 'string' || accentAmount === null ||
    paletteSeed === null || !Number.isInteger(paletteSeed) || ribbonCount === null || !Number.isInteger(ribbonCount) ||
    ribbonWidth === null || ribbonTwist === null ||
    !isOneOf(source.Pattern, sourceValues) ||
    !isOneOf(effect.Renderer, rendererValues) ||
    density === null ||
    contrast === null ||
    typeof effect.Foreground !== 'string' ||
    typeof effect.Invert !== 'boolean' ||
    !isOneOf(effect.Mark, markValues) ||
    typeof effect.Glyphs !== 'string' ||
    !isOneOf(motion.Movement, motionValues) ||
    amplitude === null ||
    duration === null ||
    motionSeed === null || !Number.isInteger(motionSeed) || direction === null || frequency === null ||
    seed === null || !Number.isInteger(seed) || patternScale === null || markScale === null ||
    !isOneOf(quality, ['web', 'high']) || !isOneOf(frameRate, ['24', '30']) ||
    !isOneOf(output.Canvas, sizeValues) ||
    !isOneOf(output.Resolution, scaleValues) ||
    typeof output.Background !== 'string' ||
    typeof output.Transparent !== 'boolean' ||
    !isOneOf(output['Text space'], fadeValues) ||
    !isOneOf(output.Video, videoValues)
  ) {
    throw new Error('Settings contain invalid or out-of-range values.');
  }

  return {
    Source: { Pattern: source.Pattern, Seed: seed, 'Pattern scale': patternScale, Ribbon: { Count: ribbonCount, Width: ribbonWidth, Twist: ribbonTwist } },
    Particles: { 'Edge sensitivity': edgeSensitivity, Irregularity: irregularity, 'Distribution seed': distributionSeed },
    Palette: { 'Accent 1': accentColor, 'Accent 2': accentColor2, 'Accent amount': accentAmount, 'Palette seed': paletteSeed },
    Effect: {
      Renderer: effect.Renderer, Tone: tone, Cutoff: cutoff,
      Density: density,
      'Mark size': markScale,
      Contrast: contrast,
      Foreground: effect.Foreground,
      Invert: effect.Invert,
      Mark: effect.Mark,
      Glyphs: effect.Glyphs,
    },
    Motion: {
      Movement: motion.Movement,
      Amplitude: amplitude,
      Duration: duration,
      Variation: motionSeed, Direction: direction, Frequency: frequency,
    },
    Output: {
      Canvas: output.Canvas,
      Resolution: output.Resolution,
      Background: output.Background,
      Transparent: output.Transparent,
      'Text space': output['Text space'],
      Video: output.Video,
      Quality: quality,
      'Frame rate': frameRate,
    },
  };
}
