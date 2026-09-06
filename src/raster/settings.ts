export interface RasterSettings {
  source: 'waves' | 'ring' | 'noise' | 'contours' | 'orbits' | 'interference' | 'ribbon' | 'organic' | 'image';
  mode: 'halftone' | 'dither' | 'ascii' | 'matrix' | 'particles';
  columns: number;
  contrast: number;
  seed: number;
  patternScale: number;
  markScale: number;
  foreground: string;
  invert: boolean;
  mark: 'circle' | 'square' | 'pill';
  motion: 'off' | 'wave' | 'drift' | 'pulse' | 'scatter';
  motionSeed: number;
  direction: number;
  frequency: number;
  amplitude: number;
  fade: 'none' | 'left' | 'right';
  glyphs: string;
  tone: 'opacity' | 'brightness';
  cutoff: number;
  edgeSensitivity: number;
  irregularity: number;
  distributionSeed: number;
  accentColor: string;
  accentColor2: string;
  accentAmount: number;
  paletteSeed: number;
  ribbonCount: number;
  ribbonWidth: number;
  ribbonTwist: number;
}

export const DEFAULT_RASTER_SETTINGS: RasterSettings = {
  source: 'waves', mode: 'halftone', columns: 110, contrast: 1.1,
  seed: 1, patternScale: 1, markScale: 1,
  foreground: '#aba1fa', invert: false, mark: 'circle',
  motionSeed: 1, direction: 0, frequency: 1,
  motion: 'wave', amplitude: 0.25, fade: 'left', glyphs: ' .:-=+*#%@',
  tone: 'opacity', cutoff: .08, edgeSensitivity: .5, irregularity: .25,
  distributionSeed: 1, accentColor: '#ff75ed', accentColor2: '#ff342f',
  accentAmount: 0, paletteSeed: 1,
  ribbonCount: 3, ribbonWidth: .2, ribbonTwist: 1.5,
};

export interface RasterFrameInput {
  width: number;
  height: number;
  phase: number;
  settings: RasterSettings;
  source?: ImageData | null;
}
