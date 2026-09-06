import { VIDEO_FRAME_RATE, type VideoExportFormat, type VideoFrameRate } from './contracts';

const FILE_EXTENSION = /\.[a-z0-9]+$/i;

export function assertExportDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError('Export width and height must be positive integers.');
  }
  if (width > 8192 || height > 8192 || width * height > 67_108_864) {
    throw new RangeError('Export dimensions exceed the supported 8192 px or 67 megapixel limit.');
  }
}

export function getVideoFrameCount(duration: number, frameRate: VideoFrameRate = VIDEO_FRAME_RATE): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RangeError('Video duration must be a positive number.');
  }

  const frameCount = Math.round(duration * frameRate);
  if (Math.abs(frameCount / frameRate - duration) > 1e-6) {
    throw new RangeError(`Video duration must align to the ${frameRate} FPS frame grid.`);
  }
  return frameCount;
}

export function assertVideoDimensions(width: number, height: number): void {
  assertExportDimensions(width, height);
  if (width % 2 !== 0 || height % 2 !== 0) {
    throw new RangeError('Video width and height must be even numbers.');
  }
}

export function resolveFileName(
  requested: string | undefined,
  extension: 'png' | VideoExportFormat,
): string {
  const base = (requested ?? 'rabi-raster')
    .trim()
    .replace(FILE_EXTENSION, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'rabi-raster'}.${extension}`;
}
