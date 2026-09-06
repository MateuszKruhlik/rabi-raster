const MULTICOLOR_BLEED_RADIUS = 2;

export interface TransparentPixelWorkspace {
  distance: Uint8Array;
  queue: Int32Array;
}

export function createTransparentPixelWorkspace(pixelCount: number): TransparentPixelWorkspace {
  return {
    distance: new Uint8Array(pixelCount),
    queue: new Int32Array(pixelCount),
  };
}

/**
 * Prepares straight RGBA for VP9 alpha encoding.
 *
 * Monochrome frames keep one RGB value across the whole frame. Multicolor frames keep every
 * visible pixel untouched and pad nearby fully transparent pixels with the closest visible RGB.
 * The padding gives VP9's subsampled chroma useful edge colors without applying alpha twice.
 */
export function prepareTransparentVideoPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  monochromeRgb: readonly [number, number, number] | null,
  workspace: TransparentPixelWorkspace = createTransparentPixelWorkspace(width * height),
): void {
  if (monochromeRgb) {
    for (let offset = 0; offset < pixels.length; offset += 4) {
      pixels[offset] = monochromeRgb[0];
      pixels[offset + 1] = monochromeRgb[1];
      pixels[offset + 2] = monochromeRgb[2];
    }
    return;
  }

  const pixelCount = width * height;
  if (pixels.length !== pixelCount * 4) {
    throw new RangeError('RGBA pixel data does not match its dimensions.');
  }
  if (workspace.distance.length < pixelCount || workspace.queue.length < pixelCount) {
    throw new RangeError('Transparent pixel workspace is smaller than the frame.');
  }

  const { distance, queue } = workspace;
  distance.fill(0, 0, pixelCount);
  let head = 0;
  let tail = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (pixels[pixel * 4 + 3] > 0) {
      distance[pixel] = 1;
      queue[tail++] = pixel;
    }
  }

  while (head < tail) {
    const sourcePixel = queue[head++];
    const sourceDistance = distance[sourcePixel];
    if (sourceDistance > MULTICOLOR_BLEED_RADIUS) continue;

    const sourceX = sourcePixel % width;
    const sourceY = Math.floor(sourcePixel / width);
    const sourceOffset = sourcePixel * 4;
    for (let y = Math.max(0, sourceY - 1); y <= Math.min(height - 1, sourceY + 1); y += 1) {
      for (let x = Math.max(0, sourceX - 1); x <= Math.min(width - 1, sourceX + 1); x += 1) {
        const targetPixel = y * width + x;
        if (distance[targetPixel] !== 0) continue;

        const targetOffset = targetPixel * 4;
        pixels[targetOffset] = pixels[sourceOffset];
        pixels[targetOffset + 1] = pixels[sourceOffset + 1];
        pixels[targetOffset + 2] = pixels[sourceOffset + 2];
        distance[targetPixel] = sourceDistance + 1;
        queue[tail++] = targetPixel;
      }
    }
  }
}
