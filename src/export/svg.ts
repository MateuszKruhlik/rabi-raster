import { renderRasterFrame } from '../raster/render';
import type { ImageExportOptions } from './contracts';
import { assertExportDimensions } from './validation';

export interface SvgExportOptions extends ImageExportOptions {}

export interface SvgExportResult {
  blob: Blob;
  width: number;
  height: number;
  fileName: string;
  elementCount: number;
}

interface DrawingState {
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
}

interface Paint {
  fill: string;
  opacity: number;
}

type PathPart =
  | { kind: 'circle'; cx: number; cy: number; radius: number }
  | { kind: 'arc'; cx: number; cy: number; radius: number; start: number; end: number; anticlockwise: boolean }
  | { kind: 'roundRect'; x: number; y: number; width: number; height: number; rx: number; ry: number };

type SvgPrimitive =
  | ({ kind: 'circle'; cx: number; cy: number; radius: number } & Paint)
  | ({ kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number; ry?: number } & Paint)
  | ({
      kind: 'text';
      value: string;
      x: number;
      y: number;
      font: string;
      textAlign: CanvasTextAlign;
      textBaseline: CanvasTextBaseline;
    } & Paint)
  | ({ kind: 'path'; data: string } & Paint);

const TAU = Math.PI * 2;
const NUMBER_PRECISION = 6;
const FILE_EXTENSION = /\.[a-z0-9]+$/i;
const HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;
const NAMED_COLOR = /^(?:transparent|black|silver|gray|white|maroon|red|purple|fuchsia|green|lime|olive|yellow|navy|blue|teal|aqua|orange|rebeccapurple)$/i;
const FUNCTION_COLOR = /^rgba?\([\deE\s.,+\-/%]+\)$/i;

function safeCssColor(value: string, fallback: string): string {
  const color = value.trim();
  if (/\b(?:url|var)\s*\(/i.test(color)) return fallback;
  return HEX_COLOR.test(color) || NAMED_COLOR.test(color) || FUNCTION_COLOR.test(color)
    ? color
    : fallback;
}

function xmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function xmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function number(value: number): string {
  const rounded = Number(value.toFixed(NUMBER_PRECISION));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function resolveSvgFileName(requested: string | undefined): string {
  const base = (requested ?? 'rabi-raster')
    .trim()
    .replace(FILE_EXTENSION, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'rabi-raster'}.svg`;
}

function paintAttributes(paint: Paint): string {
  const opacity = paint.opacity < 1 ? ` fill-opacity="${number(paint.opacity)}"` : '';
  return `fill="${xmlAttribute(paint.fill)}"${opacity}`;
}

function textAnchor(align: CanvasTextAlign): 'start' | 'middle' | 'end' {
  if (align === 'center') return 'middle';
  if (align === 'right' || align === 'end') return 'end';
  return 'start';
}

function dominantBaseline(baseline: CanvasTextBaseline): string {
  switch (baseline) {
    case 'top': return 'text-before-edge';
    case 'hanging': return 'hanging';
    case 'middle': return 'central';
    case 'ideographic': return 'ideographic';
    case 'bottom': return 'text-after-edge';
    default: return 'alphabetic';
  }
}

function serializePrimitive(primitive: SvgPrimitive): string {
  const paint = paintAttributes(primitive);
  if (primitive.kind === 'circle') {
    return `<circle cx="${number(primitive.cx)}" cy="${number(primitive.cy)}" r="${number(primitive.radius)}" ${paint}/>`;
  }
  if (primitive.kind === 'rect') {
    const radius = primitive.rx === undefined ? '' : ` rx="${number(primitive.rx)}" ry="${number(primitive.ry ?? primitive.rx)}"`;
    return `<rect x="${number(primitive.x)}" y="${number(primitive.y)}" width="${number(primitive.width)}" height="${number(primitive.height)}"${radius} ${paint}/>`;
  }
  if (primitive.kind === 'path') return `<path d="${xmlAttribute(primitive.data)}" ${paint}/>`;
  return `<text x="${number(primitive.x)}" y="${number(primitive.y)}" text-anchor="${textAnchor(primitive.textAlign)}" dominant-baseline="${dominantBaseline(primitive.textBaseline)}" style="font:${xmlAttribute(primitive.font)}" ${paint}>${xmlText(primitive.value)}</text>`;
}

function scalarRadius(radius: number | DOMPointInit | undefined): number {
  if (typeof radius === 'number') return Math.max(0, radius);
  return Math.max(0, radius?.x ?? 0);
}

function normalizedRoundRect(
  x: number,
  y: number,
  width: number,
  height: number,
  radii: number | DOMPointInit | Iterable<number | DOMPointInit> = 0,
): Extract<PathPart, { kind: 'roundRect' }> {
  const first = typeof radii === 'number' || !(Symbol.iterator in Object(radii))
    ? radii as number | DOMPointInit
    : Array.from(radii as Iterable<number | DOMPointInit>)[0];
  const radius = scalarRadius(first);
  const normalizedX = width < 0 ? x + width : x;
  const normalizedY = height < 0 ? y + height : y;
  const normalizedWidth = Math.abs(width);
  const normalizedHeight = Math.abs(height);
  const clamped = Math.min(radius, normalizedWidth / 2, normalizedHeight / 2);
  return {
    kind: 'roundRect',
    x: normalizedX,
    y: normalizedY,
    width: normalizedWidth,
    height: normalizedHeight,
    rx: clamped,
    ry: clamped,
  };
}

function isFullCircle(part: Extract<PathPart, { kind: 'arc' }>): boolean {
  return Math.abs(part.end - part.start) >= TAU - 1e-8;
}

function arcPath(part: Extract<PathPart, { kind: 'arc' }>): string {
  const startX = part.cx + Math.cos(part.start) * part.radius;
  const startY = part.cy + Math.sin(part.start) * part.radius;
  const endX = part.cx + Math.cos(part.end) * part.radius;
  const endY = part.cy + Math.sin(part.end) * part.radius;
  const delta = Math.abs(part.end - part.start) % TAU;
  const largeArc = delta > Math.PI ? 1 : 0;
  const sweep = part.anticlockwise ? 0 : 1;
  return `M ${number(startX)} ${number(startY)} A ${number(part.radius)} ${number(part.radius)} 0 ${largeArc} ${sweep} ${number(endX)} ${number(endY)} Z`;
}

class SvgRecordingContext {
  readonly primitives: SvgPrimitive[] = [];
  private readonly stack: DrawingState[] = [];
  private currentPath: PathPart[] = [];
  private state: DrawingState = {
    fillStyle: '#000000',
    globalAlpha: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  };

  constructor(private readonly width: number, private readonly height: number) {}

  get fillStyle(): string | CanvasGradient | CanvasPattern { return this.state.fillStyle; }
  set fillStyle(value: string | CanvasGradient | CanvasPattern) {
    if (typeof value === 'string') {
      const previous = typeof this.state.fillStyle === 'string' ? this.state.fillStyle : '#000000';
      this.state.fillStyle = safeCssColor(value, previous);
    } else {
      this.state.fillStyle = value;
    }
  }
  get globalAlpha(): number { return this.state.globalAlpha; }
  set globalAlpha(value: number) {
    if (Number.isFinite(value) && value >= 0 && value <= 1) this.state.globalAlpha = value;
  }
  get font(): string { return this.state.font; }
  set font(value: string) { this.state.font = value; }
  get textAlign(): CanvasTextAlign { return this.state.textAlign; }
  set textAlign(value: CanvasTextAlign) { this.state.textAlign = value; }
  get textBaseline(): CanvasTextBaseline { return this.state.textBaseline; }
  set textBaseline(value: CanvasTextBaseline) { this.state.textBaseline = value; }

  save(): void {
    this.stack.push({ ...this.state });
  }

  restore(): void {
    const restored = this.stack.pop();
    if (restored) this.state = restored;
  }

  clearRect(x: number, y: number, width: number, height: number): void {
    if (x <= 0 && y <= 0 && x + width >= this.width && y + height >= this.height) {
      this.primitives.length = 0;
      return;
    }
    throw new Error('SVG export only supports clearing the complete output frame.');
  }

  beginPath(): void {
    this.currentPath = [];
  }

  arc(cx: number, cy: number, radius: number, start: number, end: number, anticlockwise = false): void {
    this.currentPath.push({ kind: 'arc', cx, cy, radius, start, end, anticlockwise });
  }

  roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radii?: number | DOMPointInit | Iterable<number | DOMPointInit>,
  ): void {
    this.currentPath.push(normalizedRoundRect(x, y, width, height, radii));
  }

  fill(): void {
    const paint = this.paint();
    for (const part of this.currentPath) {
      if (part.kind === 'circle') {
        this.primitives.push({ ...part, ...paint });
      } else if (part.kind === 'roundRect') {
        this.primitives.push({
          kind: 'rect', x: part.x, y: part.y, width: part.width, height: part.height,
          rx: part.rx, ry: part.ry, ...paint,
        });
      } else if (isFullCircle(part)) {
        this.primitives.push({ kind: 'circle', cx: part.cx, cy: part.cy, radius: part.radius, ...paint });
      } else {
        this.primitives.push({ kind: 'path', data: arcPath(part), ...paint });
      }
    }
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    const normalizedX = width < 0 ? x + width : x;
    const normalizedY = height < 0 ? y + height : y;
    this.primitives.push({
      kind: 'rect',
      x: normalizedX,
      y: normalizedY,
      width: Math.abs(width),
      height: Math.abs(height),
      ...this.paint(),
    });
  }

  fillText(value: string, x: number, y: number): void {
    this.primitives.push({
      kind: 'text',
      value,
      x,
      y,
      font: this.state.font,
      textAlign: this.state.textAlign,
      textBaseline: this.state.textBaseline,
      ...this.paint(),
    });
  }

  private paint(): Paint {
    if (typeof this.state.fillStyle !== 'string') {
      throw new Error('SVG export supports CSS color strings, not Canvas gradients or patterns.');
    }
    return { fill: this.state.fillStyle, opacity: this.state.globalAlpha };
  }
}

/**
 * Exports the selected frame as standalone vector markup. ASCII remains editable
 * SVG text, so its exact metrics depend on fonts available where the file is opened.
 */
export async function exportSvg(options: SvgExportOptions): Promise<SvgExportResult> {
  const { width, height } = options;
  assertExportDimensions(width, height);

  const recorder = new SvgRecordingContext(width, height);
  renderRasterFrame(recorder as unknown as CanvasRenderingContext2D, {
    width,
    height,
    settings: options.settings,
    source: options.source,
    phase: options.phase,
  });

  const elements: string[] = [];
  if (!options.transparent) {
    const background = safeCssColor(options.background, '#000000');
    elements.push(`<rect data-svg-background="fallback" x="0" y="0" width="${number(width)}" height="${number(height)}" fill="#000000"/>`);
    elements.push(`<rect data-svg-background="chosen" x="0" y="0" width="${number(width)}" height="${number(height)}" fill="${xmlAttribute(background)}"/>`);
  }
  elements.push(...recorder.primitives.map(serializePrimitive));

  const markup = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${number(width)}" height="${number(height)}" viewBox="0 0 ${number(width)} ${number(height)}">`,
    ...elements.map((element) => `  ${element}`),
    '</svg>',
  ].join('\n');

  return {
    blob: new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }),
    width,
    height,
    fileName: resolveSvgFileName(options.fileName),
    elementCount: elements.length,
  };
}
