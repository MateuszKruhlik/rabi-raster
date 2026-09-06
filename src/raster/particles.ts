import { sampleRasterField } from './field';
import type { RasterFrameInput } from './settings';

const TAU = Math.PI * 2;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const boundedSeed = (seed: number) => Math.max(1, Math.min(9999,
  Math.round(Number.isFinite(seed) ? seed : 1)));

function hash(x: number, y: number) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export interface ContourAnchor {
  u: number;
  v: number;
  strength: number;
  id: number;
}

interface GradientCell {
  magnitude: number;
  gx: number;
  gy: number;
}

const imageCache = new WeakMap<object, Map<string, readonly ContourAnchor[]>>();
const proceduralCache = new Map<string, readonly ContourAnchor[]>();

function dimensions(input: RasterFrameInput) {
  const columns = Math.max(24, Math.min(180, Math.round(input.settings.columns)));
  const rows = Math.max(12, Math.round(columns * input.height / input.width));
  return { columns, rows };
}

export function contourMinimumSpacing(input: RasterFrameInput) {
  const columns = dimensions(input).columns;
  const irregularity = clamp(input.settings.irregularity ?? .25);
  return input.width / columns * (.65 + irregularity * .85);
}

function cacheKey(input: RasterFrameInput) {
  const settings = input.settings;
  return JSON.stringify([
    input.width, input.height, settings.source, settings.columns, settings.contrast,
    settings.invert, settings.seed, settings.patternScale,
    settings.edgeSensitivity, settings.irregularity, settings.distributionSeed,
    settings.ribbonCount, settings.ribbonWidth, settings.ribbonTwist,
  ]);
}

function sampleStableMap(input: RasterFrameInput, columns: number, rows: number) {
  const stableInput: RasterFrameInput = {
    ...input,
    phase: 0,
    settings: { ...input.settings, motion: 'off', amplitude: 0, fade: 'none' },
  };
  const ink = new Float32Array(columns * rows);
  const silhouette = new Float32Array(columns * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const sample = sampleRasterField(stableInput, x / (columns - 1), y / (rows - 1));
      const index = y * columns + x;
      ink[index] = sample.value * sample.alpha;
      silhouette[index] = sample.alpha;
    }
  }
  return { ink, silhouette };
}

function sobel(channel: Float32Array, x: number, y: number, width: number) {
  const top = (y - 1) * width;
  const middle = y * width;
  const bottom = (y + 1) * width;
  const gx = -channel[top + x - 1] + channel[top + x + 1]
    - 2 * channel[middle + x - 1] + 2 * channel[middle + x + 1]
    - channel[bottom + x - 1] + channel[bottom + x + 1];
  const gy = -channel[top + x - 1] - 2 * channel[top + x] - channel[top + x + 1]
    + channel[bottom + x - 1] + 2 * channel[bottom + x] + channel[bottom + x + 1];
  return { gx, gy, magnitude: Math.hypot(gx, gy) / 4 };
}

function gradientMap(ink: Float32Array, silhouette: Float32Array, columns: number, rows: number) {
  const output: GradientCell[] = Array.from({ length: columns * rows }, () => ({ magnitude: 0, gx: 0, gy: 0 }));
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < columns - 1; x++) {
      const inkGradient = sobel(ink, x, y, columns);
      const alphaGradient = sobel(silhouette, x, y, columns);
      output[y * columns + x] = alphaGradient.magnitude > inkGradient.magnitude
        ? alphaGradient : inkGradient;
    }
  }
  return output;
}

function comparisonOffsets(gx: number, gy: number, columns: number): [number, number] {
  const angle = (Math.atan2(gy, gx) + Math.PI) % Math.PI;
  if (angle < Math.PI / 8 || angle >= Math.PI * 7 / 8) return [-1, 1];
  if (angle < Math.PI * 3 / 8) return [-columns - 1, columns + 1];
  if (angle < Math.PI * 5 / 8) return [-columns, columns];
  return [-columns + 1, columns - 1];
}

function detectContourAnchors(input: RasterFrameInput): readonly ContourAnchor[] {
  const { columns, rows } = dimensions(input);
  const { ink, silhouette } = sampleStableMap(input, columns, rows);
  const gradients = gradientMap(ink, silhouette, columns, rows);
  const sensitivity = clamp(input.settings.edgeSensitivity ?? .5);
  // Higher sensitivity intentionally admits weaker gradients and reveals more detail.
  const threshold = .325 - Math.pow(sensitivity, .8) * .3;
  const irregularity = clamp(input.settings.irregularity ?? .25);
  const seed = boundedSeed(input.settings.distributionSeed ?? 1);
  const candidates: Array<ContourAnchor & { priority: number }> = [];

  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < columns - 1; x++) {
      const index = y * columns + x;
      const gradient = gradients[index];
      if (gradient.magnitude < threshold) continue;
      const [before, after] = comparisonOffsets(gradient.gx, gradient.gy, columns);
      if (gradient.magnitude < gradients[index + before].magnitude
        || gradient.magnitude < gradients[index + after].magnitude) continue;
      let localPresence = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const near = index + oy * columns + ox;
        localPresence = Math.max(localPresence, ink[near], silhouette[near]);
      }
      if (localPresence < .003) continue;
      const magnitude = Math.min(1, gradient.magnitude);
      const normalLength = Math.hypot(gradient.gx, gradient.gy) || 1;
      const tangentX = -gradient.gy / normalLength;
      const tangentY = gradient.gx / normalLength;
      const jitter = (hash(x + seed * 7, y + seed * 13) * 2 - 1) * irregularity * .48;
      const id = y * columns + x;
      candidates.push({
        u: clamp(x / (columns - 1) + tangentX * jitter / columns),
        v: clamp(y / (rows - 1) + tangentY * jitter / rows),
        strength: magnitude,
        id,
        priority: magnitude * (1 - irregularity * .3)
          + hash(id + seed * 17, seed * 29) * irregularity * .3,
      });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority || a.id - b.id);
  const accepted: ContourAnchor[] = [];
  const minimum = contourMinimumSpacing(input);
  const minimumSquared = minimum * minimum;
  const buckets = new Map<string, ContourAnchor[]>();
  for (const candidate of candidates) {
    const x = candidate.u * input.width;
    const y = candidate.v * input.height;
    const bucketX = Math.floor(x / minimum);
    const bucketY = Math.floor(y / minimum);
    let overlaps = false;
    for (let oy = -1; oy <= 1 && !overlaps; oy++) for (let ox = -1; ox <= 1 && !overlaps; ox++) {
      const near = buckets.get(`${bucketX + ox}:${bucketY + oy}`);
      overlaps = near?.some(anchor => {
        const dx = anchor.u * input.width - x;
        const dy = anchor.v * input.height - y;
        return dx * dx + dy * dy < minimumSquared;
      }) ?? false;
    }
    if (overlaps) continue;
    const anchor = { u: candidate.u, v: candidate.v, strength: candidate.strength, id: candidate.id };
    accepted.push(anchor);
    const bucketKey = `${bucketX}:${bucketY}`;
    const bucket = buckets.get(bucketKey);
    if (bucket) bucket.push(anchor);
    else buckets.set(bucketKey, [anchor]);
  }
  return accepted;
}

/** Stable anchors are cached by image identity and all settings that affect edge extraction. */
export function getContourAnchors(input: RasterFrameInput): readonly ContourAnchor[] {
  const key = cacheKey(input);
  if (input.source) {
    let entries = imageCache.get(input.source);
    if (!entries) {
      entries = new Map();
      imageCache.set(input.source, entries);
    }
    const cached = entries.get(key);
    if (cached) return cached;
    const anchors = detectContourAnchors(input);
    if (entries.size >= 24) entries.delete(entries.keys().next().value!);
    entries.set(key, anchors);
    return anchors;
  }
  const cached = proceduralCache.get(key);
  if (cached) return cached;
  const anchors = detectContourAnchors(input);
  if (proceduralCache.size >= 32) proceduralCache.delete(proceduralCache.keys().next().value!);
  proceduralCache.set(key, anchors);
  return anchors;
}

export function particleMotionOffset(input: RasterFrameInput, anchor: ContourAnchor, step: number) {
  const settings = input.settings;
  const amount = clamp(settings.amplitude);
  if (settings.motion === 'off' || settings.motion === 'pulse' || amount === 0) return { x: 0, y: 0 };
  const phase = input.phase - Math.floor(input.phase);
  const motionSeed = boundedSeed(settings.motionSeed ?? 1);
  const seedPhase = (hash(motionSeed, 73) - hash(1, 73)) * TAU;
  const t = phase * TAU + seedPhase;
  const direction = (settings.direction ?? 0) * Math.PI / 180;
  const frequency = settings.frequency ?? 1;
  if (settings.motion === 'drift') {
    return {
      x: Math.cos(t + direction) * step * 4 * amount,
      y: Math.sin(t + direction) * step * 4 * amount,
    };
  }
  if (settings.motion === 'wave') {
    const projected = anchor.u * Math.cos(direction) + anchor.v * Math.sin(direction);
    const wave = Math.sin(projected * TAU * 3.5 * frequency - t) * step * 2.6 * amount;
    return { x: -Math.sin(direction) * wave, y: Math.cos(direction) * wave };
  }
  const spread = (.5 - .5 * Math.cos(phase * TAU)) * amount * step * 12;
  const angle = hash(anchor.id + motionSeed, 181) * TAU + direction;
  const radius = .25 + hash(anchor.id + 31, motionSeed + 211) * .75;
  return { x: Math.cos(angle) * radius * spread, y: Math.sin(angle) * radius * spread };
}

export function particlePulseAlpha(input: RasterFrameInput) {
  if (input.settings.motion !== 'pulse') return 1;
  const phase = input.phase - Math.floor(input.phase);
  const motionSeed = boundedSeed(input.settings.motionSeed ?? 1);
  const seedPhase = (hash(motionSeed, 73) - hash(1, 73)) * TAU;
  return 1 - clamp(input.settings.amplitude) * .85
    * (.5 - .5 * Math.cos(phase * TAU + seedPhase));
}
