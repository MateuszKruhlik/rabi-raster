import {
  DEFAULT_RASTER_SETTINGS,
  type RasterSettings,
} from '../raster/settings';

export interface VisualChoiceOption {
  readonly value: string;
  readonly label: string;
  readonly description: string;
  readonly preview: RasterSettings | null;
}

const PREVIEW_FOREGROUND = '#d8d7de';

const PREVIEW_BASE: RasterSettings = {
  ...DEFAULT_RASTER_SETTINGS,
  source: 'organic',
  mode: 'halftone',
  columns: 48,
  contrast: 1.4,
  seed: 583,
  patternScale: 1.25,
  markScale: 1.1,
  foreground: PREVIEW_FOREGROUND,
  motion: 'off',
  amplitude: 0,
  fade: 'none',
  edgeSensitivity: .9,
  irregularity: .32,
  distributionSeed: 583,
  accentColor: PREVIEW_FOREGROUND,
  accentColor2: PREVIEW_FOREGROUND,
  accentAmount: 0,
};

function patternPreview(source: Exclude<RasterSettings['source'], 'image'>): RasterSettings {
  return { ...PREVIEW_BASE, source, mode: 'halftone' };
}

function rendererPreview(mode: RasterSettings['mode']): RasterSettings {
  const modeAdjustments: Partial<RasterSettings> = mode === 'matrix'
    ? { markScale: 1.5, cutoff: .05, tone: 'opacity' }
    : mode === 'particles'
      ? { columns: 40, markScale: 1.5, edgeSensitivity: .98 }
      : mode === 'ascii'
        ? { columns: 44, markScale: 1.25 }
        : mode === 'dither'
          ? { markScale: 1.2 }
          : {};

  return { ...PREVIEW_BASE, ...modeAdjustments, mode };
}

export const PATTERN_OPTIONS = [
  {
    value: 'waves',
    label: 'Waves',
    description: 'Creates flowing bands from layered waves.',
    preview: patternPreview('waves'),
  },
  {
    value: 'ring',
    label: 'Ring',
    description: 'Builds a textured circular band around a shifted center.',
    preview: patternPreview('ring'),
  },
  {
    value: 'noise',
    label: 'Noise',
    description: 'Blends two noise layers into a soft granular field.',
    preview: patternPreview('noise'),
  },
  {
    value: 'contours',
    label: 'Contours',
    description: 'Turns terrain-like noise into repeated contour bands.',
    preview: patternPreview('contours'),
  },
  {
    value: 'orbits',
    label: 'Orbits',
    description: 'Overlaps three ripple fields to create clusters of rings.',
    preview: patternPreview('orbits'),
  },
  {
    value: 'interference',
    label: 'Interference',
    description: 'Crosses two wave directions to create a dense moire pattern.',
    preview: patternPreview('interference'),
  },
  {
    value: 'ribbon',
    label: 'Ribbon',
    description: 'Multiple woven strands cross and exchange position.',
    preview: patternPreview('ribbon'),
  },
  {
    value: 'organic',
    label: 'Organic Field',
    description: 'Blends warped noise layers into irregular islands.',
    preview: patternPreview('organic'),
  },
  {
    value: 'image',
    label: 'Image',
    description: 'Choose a local image; it stays in this browser.',
    preview: null,
  },
] as const satisfies readonly VisualChoiceOption[];

export const RENDERER_OPTIONS = [
  {
    value: 'halftone',
    label: 'Halftone',
    description: 'Changes the size of dots and shapes to show light and shade.',
    preview: rendererPreview('halftone'),
  },
  {
    value: 'dither',
    label: 'Dither',
    description: 'Builds tonal detail from a crisp pattern of square pixels.',
    preview: rendererPreview('dither'),
  },
  {
    value: 'ascii',
    label: 'ASCII',
    description: 'Turns light and shade into characters from a custom glyph set.',
    preview: rendererPreview('ascii'),
  },
  {
    value: 'matrix',
    label: 'Dot Matrix',
    description: 'Shows tone through a regular grid of brighter or softer dots.',
    preview: rendererPreview('matrix'),
  },
  {
    value: 'particles',
    label: 'Contour Particles',
    description: 'Traces detected edges with an irregular field of dots.',
    preview: rendererPreview('particles'),
  },
] as const satisfies readonly VisualChoiceOption[];
