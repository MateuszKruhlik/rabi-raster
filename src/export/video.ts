import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  VideoSample,
  VideoSampleSource,
  WebMOutputFormat,
  canEncodeVideo,
  type VideoCodec,
} from 'mediabunny';
import { renderRasterFrame } from '../raster/render';
import type { RasterSettings } from '../raster/settings';
import {
  VIDEO_FRAME_RATE,
  type VideoExportCapabilities,
  type VideoExportCapabilityOptions,
  type VideoExportFormat,
  type VideoExportOptions,
  type VideoExportResult,
  type VideoFormatCapability,
} from './contracts';
import { assertVideoDimensions, getVideoFrameCount, resolveFileName } from './validation';
import {
  createTransparentPixelWorkspace,
  prepareTransparentVideoPixels,
} from './transparent-pixels';

const DEFAULT_CAPABILITY_SIZE = { width: 1280, height: 720 };
const BITS_PER_PIXEL_PER_FRAME = {
  web: 0.04,
  high: 0.1,
} as const;

function abortError(): DOMException {
  return new DOMException('Video export was canceled.', 'AbortError');
}

function qualityForProfile(
  profile: NonNullable<VideoExportOptions['quality']>,
  width: number,
  height: number,
  frameRate: number,
): Quality {
  const bitrate = Math.max(
    100_000,
    Math.round(width * height * frameRate * BITS_PER_PIXEL_PER_FRAME[profile]),
  );
  return new Quality({ bitrate, bitrateMode: 'variable' });
}

function resolveCanvasColor(color: string): readonly [number, number, number] {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.');
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const pixels = context.getImageData(0, 0, 1, 1).data;
  return [pixels[0], pixels[1], pixels[2]];
}

function preservesRenderedRgb(settings: RasterSettings): boolean {
  return settings.accentAmount > 0 || (settings.mode === 'matrix' && settings.tone === 'brightness');
}

async function firstSupportedCodec(
  codecs: readonly VideoCodec[],
  width: number,
  height: number,
  transparent: boolean,
): Promise<VideoCodec | null> {
  for (const codec of codecs) {
    try {
      if (await canEncodeVideo(codec, {
        width,
        height,
        quality: new Quality('high'),
        alpha: transparent ? 'keep' : 'discard',
      })) return codec;
    } catch {
      // A browser may reject a codec probe even though WebCodecs exists.
    }
  }
  return null;
}

async function capabilityFor(
  format: VideoExportFormat,
  width: number,
  height: number,
  transparent: boolean,
): Promise<VideoFormatCapability> {
  if (transparent && format === 'mp4') {
    return {
      supported: false,
      codec: null,
      reason: 'Transparent video export is available only as VP9 WebM.',
    };
  }

  if (typeof VideoEncoder === 'undefined') {
    return {
      supported: false,
      codec: null,
      reason: 'WebCodecs video encoding is unavailable in this browser.',
    };
  }

  const codec = await firstSupportedCodec(
    format === 'webm' ? (transparent ? ['vp9'] : ['vp9', 'vp8']) : ['avc'],
    width,
    height,
    transparent,
  );
  if (!codec) {
    return {
      supported: false,
      codec: null,
      reason: transparent
        ? 'This browser has no compatible VP9 alpha encoder.'
        : format === 'mp4'
        ? 'This browser has no compatible AVC encoder. Choose WebM instead.'
        : 'This browser has no compatible VP9 or VP8 encoder.',
    };
  }
  return { supported: true, codec: codec as VideoFormatCapability['codec'] };
}

export async function getVideoExportCapabilities(
  options: VideoExportCapabilityOptions = {},
): Promise<VideoExportCapabilities> {
  const width = options.width ?? DEFAULT_CAPABILITY_SIZE.width;
  const height = options.height ?? DEFAULT_CAPABILITY_SIZE.height;
  const transparent = options.transparent ?? false;
  const [webm, mp4] = await Promise.all([
    capabilityFor('webm', width, height, transparent),
    capabilityFor('mp4', width, height, transparent),
  ]);
  return { webm, mp4 };
}

async function cancelOutput(output: Output): Promise<void> {
  if (output.state === 'pending' || output.state === 'started') {
    try {
      await output.cancel();
    } catch {
      // Preserve the original render, encode, or cancellation failure.
    }
  }
}

export async function exportVideo(options: VideoExportOptions): Promise<VideoExportResult> {
  const { width, height, format } = options;
  const transparent = options.transparent ?? false;
  const frameRate = options.frameRate ?? VIDEO_FRAME_RATE;
  const quality = options.quality ?? 'high';
  assertVideoDimensions(width, height);
  const frameCount = getVideoFrameCount(options.duration, frameRate);
  if (options.signal?.aborted) throw abortError();

  if (transparent && format !== 'webm') {
    throw new Error('Transparent video export is available only as VP9 WebM.');
  }

  const capability = await capabilityFor(format, width, height, transparent);
  if (!capability.supported || !capability.codec) {
    throw new Error(capability.reason ?? `The ${format.toUpperCase()} encoder is unavailable.`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: transparent });
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.');

  const target = new BufferTarget();
  const output = new Output({
    format: format === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat(),
    target,
  });
  const encodingConfig = {
    codec: capability.codec,
    quality: qualityForProfile(quality, width, height, frameRate),
    latencyMode: 'quality',
    alpha: transparent ? 'keep' : 'discard',
    keyFrameInterval: 2,
  } as const;
  const transparentSource = transparent ? new VideoSampleSource(encodingConfig) : null;
  const canvasSource = transparent ? null : new CanvasSource(canvas, encodingConfig);
  const source = transparentSource ?? canvasSource!;
  const foregroundRgb = transparent && !preservesRenderedRgb(options.settings)
    ? resolveCanvasColor(options.settings.foreground)
    : null;
  const transparentPixelWorkspace = transparent && !foregroundRgb
    ? createTransparentPixelWorkspace(width * height)
    : undefined;
  output.addVideoTrack(source, { frameRate });

  let aborted = false;
  const handleAbort = () => {
    aborted = true;
    void cancelOutput(output);
  };
  options.signal?.addEventListener('abort', handleAbort, { once: true });

  try {
    options.onProgress?.(0);
    await output.start();

    for (let frame = 0; frame < frameCount; frame += 1) {
      if (aborted || options.signal?.aborted) throw abortError();

      renderRasterFrame(context, {
        width,
        height,
        settings: options.settings,
        source: options.source,
        phase: frame / frameCount,
      });

      if (!transparent) {
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'destination-over';
        context.fillStyle = options.background;
        context.fillRect(0, 0, width, height);
        context.fillStyle = '#000000';
        context.fillRect(0, 0, width, height);
        context.restore();
      }

      const timestamp = frame / frameRate;
      const frameDuration = 1 / frameRate;
      const encodeOptions = { keyFrame: frame % (frameRate * 2) === 0 };
      if (transparentSource) {
        // Canvas-backed VideoFrames premultiply RGB by alpha before Mediabunny splits VP9 color and alpha,
        // which makes playback apply alpha twice. Raw RGBA preserves straight color. Monochrome frames keep
        // their compact constant-RGB representation; multicolor frames retain rendered RGB and only bleed it
        // into nearby alpha-zero pixels to protect edges from VP9 chroma subsampling.
        const pixels = context.getImageData(0, 0, width, height);
        prepareTransparentVideoPixels(
          pixels.data,
          width,
          height,
          foregroundRgb,
          transparentPixelWorkspace,
        );
        const sample = new VideoSample(pixels.data, {
          format: 'RGBA',
          codedWidth: width,
          codedHeight: height,
          timestamp,
          duration: frameDuration,
        });
        try {
          await transparentSource.add(sample, encodeOptions);
        } finally {
          sample.close();
        }
      } else {
        await canvasSource!.add(timestamp, frameDuration, encodeOptions);
      }
      options.onProgress?.(((frame + 1) / frameCount) * 0.95);
    }

    if (aborted || options.signal?.aborted) throw abortError();
    await output.finalize();
    if (!target.buffer) throw new Error('The video encoder returned no output data.');
    options.onProgress?.(1);

    return {
      blob: new Blob([target.buffer], { type: output.format.mimeType }),
      width,
      height,
      duration: frameCount / frameRate,
      frameCount,
      format,
      fileName: resolveFileName(options.fileName, format),
    };
  } catch (error) {
    await cancelOutput(output);
    if (aborted || options.signal?.aborted) throw abortError();
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', handleAbort);
  }
}
