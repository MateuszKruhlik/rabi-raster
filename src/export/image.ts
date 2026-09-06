import { renderRasterFrame } from '../raster/render';
import type { ImageExportOptions, ImageExportResult } from './contracts';
import { assertExportDimensions, resolveFileName } from './validation';

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode the PNG export.'));
    }, 'image/png');
  });
}

export async function exportImage(options: ImageExportOptions): Promise<ImageExportResult> {
  const { width, height } = options;
  assertExportDimensions(width, height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.');

  renderRasterFrame(context, {
    width,
    height,
    settings: options.settings,
    source: options.source,
    phase: options.phase,
  });

  if (!options.transparent) {
    context.save();
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = options.background;
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#000000';
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  return {
    blob: await canvasToPngBlob(canvas),
    width,
    height,
    fileName: resolveFileName(options.fileName, 'png'),
  };
}
