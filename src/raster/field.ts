import type { RasterFrameInput } from './settings';

const TAU = Math.PI * 2;
const BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, value: number) => {
  const t = clamp((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function hash(x: number, y: number) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

const boundedSeed = (seed: number) => Math.max(1, Math.min(9999, Math.round(Number.isFinite(seed) ? seed : 1)));
const seeded = (seed: number, salt: number) => hash(boundedSeed(seed), salt);
// Seed 1 is the compatibility baseline, so the defaults retain the original fields.
const seedDelta = (seed: number, salt: number) => seeded(seed, salt) - seeded(1, salt);

function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const tx = smoothstep(0, 1, x - ix), ty = smoothstep(0, 1, y - iy);
  return mix(mix(hash(ix, iy), hash(ix + 1, iy), tx),
    mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), tx), ty);
}

function imageSample(input: RasterFrameInput, u: number, v: number) {
  const image = input.source;
  if (!image?.width || !image.height) return { value: 0, alpha: 0 };
  const outputRatio = input.width / input.height;
  const sourceRatio = image.width / image.height;
  // Centered cover crop; source pixels never determine the output dimensions.
  const scaleX = Math.min(1, outputRatio / sourceRatio);
  const scaleY = Math.min(1, sourceRatio / outputRatio);
  const px = clamp((u - 0.5) * scaleX + 0.5) * (image.width - 1);
  const py = clamp((v - 0.5) * scaleY + 0.5) * (image.height - 1);
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const x1 = Math.min(x0 + 1, image.width - 1), y1 = Math.min(y0 + 1, image.height - 1);
  const dx = px - x0, dy = py - y0;
  let alpha = 0, luminance = 0;
  for (let corner = 0; corner < 4; corner++) {
    const x = corner & 1 ? x1 : x0;
    const y = corner & 2 ? y1 : y0;
    const weight = (corner & 1 ? dx : 1 - dx) * (corner & 2 ? dy : 1 - dy);
    const i = (y * image.width + x) * 4;
    const a = image.data[i + 3] / 255;
    alpha += a * weight;
    luminance += (image.data[i] * 0.2126 + image.data[i + 1] * 0.7152 + image.data[i + 2] * 0.0722) / 255 * a * weight;
  }
  return { value: alpha > 0 ? 1 - luminance / alpha : 0, alpha };
}

/** Pure, repeatable sampling. Phase 1 is exactly phase 0, with no mutable simulation. */
export function sampleRasterField(input: RasterFrameInput, u: number, v: number) {
  const { settings } = input;
  const seed = boundedSeed(settings.seed);
  const scale = Math.max(0.5, Math.min(3, Number.isFinite(settings.patternScale) ? settings.patternScale : 1));
  const phase = settings.motion === 'off' ? 0 : input.phase - Math.floor(input.phase);
  const variation = settings.motion === 'off' ? 0 : seedDelta(settings.motionSeed ?? 1, 73) * TAU;
  const t = phase * TAU + variation;
  const angle = (settings.direction ?? 0) * Math.PI / 180;
  const frequency = settings.frequency ?? 1;
  const amount = settings.motion === 'off' ? 0 : settings.amplitude;
  let su = u, sv = v;
  if (settings.motion === 'drift') {
    su += Math.cos(t + angle) * 0.12 * amount;
    sv += Math.sin(t + angle) * 0.12 * amount;
  } else if (settings.motion === 'wave') {
    const a = (u - .5) * Math.cos(angle) + (v - .5) * Math.sin(angle) + .5;
    const b = -(u - .5) * Math.sin(angle) + (v - .5) * Math.cos(angle) + .5;
    const dx = Math.sin(b * 8 * frequency - t) * .07 * amount;
    const dy = Math.cos(a * 7 * frequency + t) * .07 * amount;
    su += dx * Math.cos(angle) - dy * Math.sin(angle);
    sv += dx * Math.sin(angle) + dy * Math.cos(angle);
  }
  const x = (su - 0.5) * input.width / input.height;
  const y = sv - 0.5;
  let value = 0, alpha = 1;
  const fieldAmount = settings.motion === 'pulse' || settings.motion === 'scatter' ? 0 : amount;
  if (settings.source === 'image') {
    ({ value, alpha } = imageSample(input, su, sv));
  } else if (settings.source === 'ring') {
    const centerX = seedDelta(seed, 11) * 0.24;
    const centerY = seedDelta(seed, 12) * 0.18;
    const angle = Math.atan2(y - centerY, x - centerX);
    const radius = Math.hypot(x - centerX, y - centerY);
    const seedPhase = seedDelta(seed, 13) * TAU;
    const ringRadius = 0.3 + seedDelta(seed, 14) * 0.1;
    const deformation = Math.sin(angle * 3 + t) * 0.025 * fieldAmount + Math.cos(angle * 5 - t) * 0.014 * fieldAmount;
    const band = Math.exp(-Math.pow((radius - ringRadius - deformation) / (0.072 / Math.sqrt(scale)), 2));
    const threads = 0.67 + 0.33 * Math.cos(radius * 200 * scale + seedPhase + Math.sin(angle * 3 - t) * fieldAmount * 2);
    value = band * threads;
  } else if (settings.source === 'noise') {
    const offsetX = seedDelta(seed, 21) * 31;
    const offsetY = seedDelta(seed, 22) * 31;
    value = noise(x * 5 * scale + 3.4 + offsetX, y * 5 * scale + 2.1 + offsetY) * 0.64
      + noise(x * 11 * scale + 4.1 - offsetY, y * 11 * scale + 8.7 + offsetX) * 0.36;
    value = smoothstep(0.2, 0.82, value);
  } else if (settings.source === 'contours') {
    const offsetX = seeded(seed, 31) * 19;
    const offsetY = seeded(seed, 32) * 19;
    const travelX = Math.cos(t) * 0.35 * fieldAmount;
    const travelY = Math.sin(t) * 0.35 * fieldAmount;
    const broad = noise(x * 2.15 * scale + offsetX + travelX, y * 2.15 * scale + offsetY + travelY);
    const detail = noise(x * 5.4 * scale - offsetY - travelY, y * 5.4 * scale + offsetX + travelX);
    const terrain = broad * 0.76 + detail * 0.24;
    const contour = 0.5 + 0.5 * Math.cos((terrain * (6.5 + scale) + seeded(seed, 33)) * TAU);
    value = smoothstep(0.48, 0.94, contour);
  } else if (settings.source === 'orbits') {
    let ripples = 0;
    for (let orbit = 0; orbit < 3; orbit++) {
      const direction = orbit % 2 ? -1 : 1;
      const orbitPhase = seeded(seed, 41 + orbit * 3) * TAU;
      const centerX = (seeded(seed, 42 + orbit * 3) - 0.5) * 0.68
        + Math.cos(t * direction + orbitPhase) * 0.035 * fieldAmount;
      const centerY = (seeded(seed, 43 + orbit * 3) - 0.5) * 0.48
        + Math.sin(t * direction + orbitPhase) * 0.035 * fieldAmount;
      const radius = Math.hypot(x - centerX, y - centerY);
      const wave = 0.5 + 0.5 * Math.cos(radius * TAU * (6.2 + orbit * 1.1) * scale + orbitPhase + Math.sin(t * direction) * fieldAmount);
      const rings = smoothstep(0.58, 0.96, wave) * (1 - orbit * 0.12);
      ripples = Math.max(ripples, rings);
    }
    value = ripples;
  } else if (settings.source === 'interference') {
    const angleA = -0.72 + seedDelta(seed, 51) * 1.2;
    const angleB = 0.63 + seedDelta(seed, 52) * 1.2;
    const phaseA = seeded(seed, 53) * TAU;
    const phaseB = seeded(seed, 54) * TAU;
    const lineA = x * Math.cos(angleA) + y * Math.sin(angleA);
    const lineB = x * Math.cos(angleB) + y * Math.sin(angleB);
    const waveA = Math.sin(lineA * TAU * 5.4 * scale + phaseA + Math.sin(t) * fieldAmount * 1.8);
    const waveB = Math.sin(lineB * TAU * 5.9 * scale + phaseB + Math.cos(t) * fieldAmount * 1.8);
    const crossing = 0.5 + 0.5 * waveA * waveB;
    const moire = 0.5 + 0.5 * Math.cos((waveA - waveB) * Math.PI + seedDelta(seed, 55) * TAU);
    value = smoothstep(0.28, 0.88, crossing * 0.72 + moire * 0.28);
  } else if (settings.source === 'ribbon') {
    const count = Math.max(1, Math.min(8, Math.round(settings.ribbonCount ?? 3)));
    const width = Math.max(.05, Math.min(.5, settings.ribbonWidth ?? .2));
    const twist = Math.max(.5, Math.min(4, settings.ribbonTwist ?? 1.5));
    const seedOffset = seedDelta(seed, 71);
    const halfWidth = width * (.16 + .025 * Math.sqrt(count));
    const axisPhase = seedOffset * 1.2;
    const axis = Math.sin(x * TAU * (.42 + twist * .07) + axisPhase) * .1;
    const openWave = .5 + .5 * Math.cos(x * TAU * (.32 + twist * .09) + axisPhase + .65);
    // A shared envelope pulls every strand through the same tight nodes, then
    // opens enough for phase-shifted strands to cross and exchange order.
    const envelope = .055 + .36 * Math.pow(openWave, 1.25);
    for (let ribbonIndex = 0; ribbonIndex < count; ribbonIndex++) {
      const position = count === 1 ? 0 : ribbonIndex / (count - 1) - .5;
      const ribbonPhase = ribbonIndex / Math.max(1, count) * TAU
        + seedDelta(seed, 72 + ribbonIndex * 3) * .9;
      const travel = Math.sin(t) * (ribbonIndex % 2 ? -1 : 1) * 1.8 * fieldAmount;
      const crossing = position * .85
        + Math.sin(x * TAU * (.62 + twist * .34) * scale + ribbonPhase + travel) * .58;
      const center = axis + envelope * crossing
        + Math.sin(x * TAU * (1.1 + twist * .16) - ribbonPhase * .45 - travel) * .018;
      const distance = Math.abs(y - center);
      const band = 1 - smoothstep(halfWidth * .58, halfWidth, distance);
      const woven = .78 + .22 * Math.cos(x * TAU * (2.2 + twist) * scale
        + ribbonPhase + y * 14 + seedOffset * TAU);
      value = Math.max(value, band * woven);
    }
  } else if (settings.source === 'organic') {
    const offsetX = seeded(seed, 81) * 27;
    const offsetY = seeded(seed, 82) * 27;
    const travelX = Math.cos(t + seeded(seed, 83) * TAU) * .28 * fieldAmount;
    const travelY = Math.sin(t + seeded(seed, 84) * TAU) * .22 * fieldAmount;
    const broad = noise(x * 2.35 * scale + offsetX + travelX, y * 2.35 * scale + offsetY + travelY);
    const warpX = noise(x * 3.1 * scale + offsetY, y * 3.1 * scale - offsetX) - .5;
    const warpY = noise(x * 3.1 * scale - offsetX, y * 3.1 * scale + offsetY) - .5;
    const islands = noise((x + warpX * .22) * 4.1 * scale + offsetX - travelY,
      (y + warpY * .22) * 4.1 * scale + offsetY + travelX);
    const detail = noise(x * 9.5 * scale - offsetY, y * 9.5 * scale + offsetX);
    const terrain = broad * .56 + islands * .34 + detail * .1;
    value = smoothstep(.42, .69, terrain);
  } else {
    const seedPhase = seedDelta(seed, 61) * TAU;
    const skew = seedDelta(seed, 62) * 2.4;
    const folds = Math.sin(x * (5 + skew) * scale + y * 7 * scale + seedPhase + Math.sin(y * 5 * scale + t) * 1.4 * fieldAmount);
    const ribbon = Math.sin(y * 10 * scale - x * (2 - skew * 0.3) * scale + seedPhase * 0.7 + folds * 1.7);
    const cyclicLight = 0.55 + 0.45 * Math.cos(x * 3 * scale - y * 4 * scale - seedPhase + Math.sin(t) * fieldAmount);
    value = smoothstep(-0.72, 0.95, ribbon) * cyclicLight;
  }
  value = clamp((value - 0.5) * settings.contrast + 0.5);
  if (settings.invert) value = 1 - value;
  if (settings.motion === 'pulse') alpha *= 1 - amount * .85 * (.5 - .5 * Math.cos(t));
  if (settings.fade === 'left') alpha *= smoothstep(0.18, 0.68, u);
  if (settings.fade === 'right') alpha *= smoothstep(0.18, 0.68, 1 - u);
  return { value, alpha };
}

/** Ordered 4x4 Bayer dither, fixed in the output grid to avoid temporal flicker. */
export function shouldDither(value: number, x: number, y: number) {
  const index = ((y % 4 + 4) % 4) * 4 + (x % 4 + 4) % 4;
  return value > (BAYER[index] + 0.5) / 16;
}

/** Move sampled marks, rather than resampling the photograph: every point returns to its origin. */
export function scatterOffset(input: RasterFrameInput, col: number, row: number, step: number) {
  if (input.settings.motion !== 'scatter') return { x: 0, y: 0 };
  const phase = input.phase - Math.floor(input.phase);
  const spread = (.5 - .5 * Math.cos(phase * TAU)) * input.settings.amplitude * step * 12;
  if (spread === 0) return { x: 0, y: 0 };
  const seed = input.settings.motionSeed ?? 1;
  const angle = hash(col + boundedSeed(seed), row + 81) * TAU + (input.settings.direction ?? 0) * Math.PI / 180;
  const radius = .25 + hash(col + 31, row + boundedSeed(seed)) * .75;
  return { x: Math.cos(angle) * radius * spread, y: Math.sin(angle) * radius * spread };
}
