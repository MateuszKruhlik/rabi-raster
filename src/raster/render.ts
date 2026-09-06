import { sampleRasterField, shouldDither, scatterOffset } from './field';
import { getContourAnchors, particleMotionOffset, particlePulseAlpha } from './particles';
import type { RasterFrameInput } from './settings';

export type { RasterFrameInput, RasterSettings } from './settings';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function hash(x: number, y: number) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function pointColor(input: RasterFrameInput, x: number, y: number) {
  const settings = input.settings;
  const amount = clamp(settings.accentAmount ?? 0);
  if (amount === 0) return settings.foreground;
  const seed = Math.max(1, Math.min(9999, Math.round(settings.paletteSeed ?? 1)));
  if (hash(x + seed * 17, y + seed * 31) >= amount) return settings.foreground;
  return hash(x + seed * 43, y + seed * 59) < .5
    ? settings.accentColor
    : settings.accentColor2;
}

interface ParsedColor { r: number; g: number; b: number; a: number }

const parsedColorCache = new Map<string, ParsedColor | null>();
let colorContext: CanvasRenderingContext2D | null | undefined;

function parseCssColor(color: string): ParsedColor | null {
  if (parsedColorCache.has(color)) return parsedColorCache.get(color)!;
  const hex = color.trim().match(/^#([\da-f]{3,8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? Array.from(hex, char => char + char).join('') : hex;
    if (expanded.length === 6 || expanded.length === 8) {
      const parsed = {
      r: parseInt(expanded.slice(0, 2), 16),
      g: parseInt(expanded.slice(2, 4), 16),
      b: parseInt(expanded.slice(4, 6), 16),
      a: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
      };
      parsedColorCache.set(color, parsed);
      return parsed;
    }
  }
  const rgb = color.trim().match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)%?)?\s*\)$/i);
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]) * (color.includes('%') ? .01 : 1);
    const parsed = { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: clamp(alpha) };
    parsedColorCache.set(color, parsed);
    return parsed;
  }

  if (typeof document === 'undefined') {
    parsedColorCache.set(color, null);
    return null;
  }
  if (typeof CSS !== 'undefined' && CSS.supports && !CSS.supports('color', color)) {
    parsedColorCache.set(color, null);
    return null;
  }
  if (colorContext === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    colorContext = canvas.getContext('2d', { willReadFrequently: true });
  }
  if (!colorContext) {
    parsedColorCache.set(color, null);
    return null;
  }
  colorContext.clearRect(0, 0, 1, 1);
  colorContext.globalAlpha = 1;
  colorContext.fillStyle = color;
  colorContext.fillRect(0, 0, 1, 1);
  const pixel = colorContext.getImageData(0, 0, 1, 1).data;
  const parsed = { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] / 255 };
  parsedColorCache.set(color, parsed);
  return parsed;
}

/** Matrix brightness changes RGB channels while leaving the supplied color alpha untouched. */
export function brightnessTone(color: string, value: number) {
  const parsed = parseCssColor(color);
  if (!parsed) return color;
  const tone = clamp(value);
  const channel = (number: number) => Math.round(number * tone * 1000) / 1000;
  return `rgba(${channel(parsed.r)}, ${channel(parsed.g)}, ${channel(parsed.b)}, ${Math.round(parsed.a * 1000) / 1000})`;
}

function fadeAlpha(input: RasterFrameInput, u: number) {
  const edge = (value: number) => {
    const t = clamp((value - .18) / .5);
    return t * t * (3 - 2 * t);
  };
  if (input.settings.fade === 'left') return edge(u);
  if (input.settings.fade === 'right') return edge(1 - u);
  return 1;
}

function renderParticles(ctx: CanvasRenderingContext2D, input: RasterFrameInput, step: number, markScale: number) {
  const anchors = getContourAnchors(input);
  const pulse = particlePulseAlpha(input);
  const irregularity = clamp(input.settings.irregularity ?? .25);
  for (const anchor of anchors) {
    const offset = particleMotionOffset(input, anchor, step);
    const x = anchor.u * input.width + offset.x;
    const y = anchor.v * input.height + offset.y;
    const sizeVariation = .78 + hash(anchor.id + 97, Math.round((input.settings.distributionSeed ?? 1) * 13)) * irregularity * .55;
    const radius = step * markScale * (.13 + anchor.strength * .16) * sizeVariation;
    const alpha = fadeAlpha(input, anchor.u) * pulse * (.42 + anchor.strength * .58);
    if (alpha < .003 || radius <= 0) continue;
    ctx.fillStyle = pointColor(input, anchor.id, anchor.id * 7 + 3);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draws transparent artwork in logical output coordinates; the caller supplies any background. */
export function renderRasterFrame(ctx: CanvasRenderingContext2D, input: RasterFrameInput): void {
  const { width, height, settings } = input;
  if (!(width > 0 && height > 0)) return;
  const columns = Math.max(40, Math.min(180, Math.round(settings.columns)));
  const step = width / columns;
  const markScale = Math.max(0.25, Math.min(1.5, Number.isFinite(settings.markScale) ? settings.markScale : 1));
  const cellHeight = settings.mode === 'ascii' ? step * 1.4 : step;
  const rows = Math.ceil(height / cellHeight);
  const glyphs = Array.from(settings.glyphs || ' .:-=+*#%@').slice(0, 64);
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = settings.foreground;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 ${step * 1.28 * markScale}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  if (settings.mode === 'particles') {
    renderParticles(ctx, input, step, markScale);
    ctx.restore();
    return;
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const sx = (col + .5) * step, sy = (row + .5) * cellHeight;
      const { value, alpha } = sampleRasterField(input, sx / width, sy / height);
      const offset = scatterOffset(input, col, row, step);
      const x = sx + offset.x, y = sy + offset.y;
      if (alpha < 0.003 || (settings.mode !== 'matrix' && value < 0.008)) continue;
      const color = pointColor(input, col, row);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      if (settings.mode === 'ascii') {
        const char = glyphs[Math.min(glyphs.length - 1, Math.floor(value * glyphs.length))];
        if (char.trim()) ctx.fillText(char, x, y);
      } else if (settings.mode === 'dither') {
        if (shouldDither(value, col, row)) {
          const size = step * markScale;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      } else if (settings.mode === 'matrix') {
        const cutoff = clamp(settings.cutoff ?? .08);
        if (value < cutoff) continue;
        const radius = step * .22 * markScale;
        if (settings.tone === 'brightness') {
          ctx.fillStyle = brightnessTone(color, value);
        } else {
          ctx.globalAlpha = alpha * value;
        }
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const size = step * 0.88 * Math.sqrt(value) * markScale;
        if (settings.mark === 'square') {
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        } else if (settings.mark === 'pill') {
          ctx.beginPath();
          ctx.roundRect(x - size / 2, y - size * 0.32, size, size * 0.64, size * 0.32);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  ctx.restore();
}
