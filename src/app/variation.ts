import type { RasterDialUpdates, RasterDialValues } from './config';

export type VariationKind = 'look' | 'motion' | 'pattern' | 'distribution' | 'colors';

/** Each variation captures only its own controls, so undo never replaces the photograph or output. */
export function createVariation(values: RasterDialValues, kind: VariationKind, random: Uint32Array): {
  updates: RasterDialUpdates; undo: RasterDialUpdates;
} {
  const nextSeed = (seed: number) => 1 + ((seed - 1 + 1 + random[0] % 9998) % 9999);
  if (kind === 'distribution') return {
    updates: { Particles: { 'Distribution seed': nextSeed(values.Particles['Distribution seed']), Irregularity: .1 + random[1] % 61 * .01 } },
    undo: { Particles: { 'Distribution seed': values.Particles['Distribution seed'], Irregularity: values.Particles.Irregularity } },
  };
  if (kind === 'colors') {
    const accents = [['#ff75ed', '#ff342f'], ['#b5ff61', '#ffae42'], ['#7be8ff', '#d9a5ff'], ['#ffe28b', '#ff7499']];
    const pair = accents[random[1] % accents.length];
    return { updates: { Palette: { 'Accent 1': pair[0], 'Accent 2': pair[1], 'Accent amount': .03 + random[2] % 23 * .01, 'Palette seed': nextSeed(values.Palette['Palette seed']) } },
      undo: { Palette: { ...values.Palette } } };
  }
  if (kind === 'pattern') return {
    updates: { Source: { Seed: nextSeed(values.Source.Seed), 'Pattern scale': .65 + random[1] % 38 * .05 } },
    undo: { Source: { Seed: values.Source.Seed, 'Pattern scale': values.Source['Pattern scale'] } },
  };
  if (kind === 'motion') return {
    updates: { Motion: { Variation: nextSeed(values.Motion.Variation), Direction: random[1] % 72 * 5,
      Amplitude: .15 + random[2] % 56 * .01, Frequency: .5 + random[3] % 31 * .05 } },
    undo: { Motion: { Variation: values.Motion.Variation, Direction: values.Motion.Direction,
      Amplitude: values.Motion.Amplitude, Frequency: values.Motion.Frequency } },
  };
  return {
    updates: { Effect: { Density: 60 + random[0] % 111, 'Mark size': .4 + random[1] % 18 * .05,
      Contrast: .75 + random[2] % 21 * .05,
      ...(values.Effect.Renderer === 'halftone' ? { Mark: ['circle', 'square', 'pill'][random[3] % 3] } : {}) } },
    undo: { Effect: { Density: values.Effect.Density, 'Mark size': values.Effect['Mark size'],
      Contrast: values.Effect.Contrast, Mark: values.Effect.Mark } },
  };
}
