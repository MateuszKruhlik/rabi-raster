export interface DecodedImage {
  data: ImageData;
  name: string;
  width: number;
  height: number;
}

const LOCAL_IMAGE_SOURCE = /^(?:blob:|data:image\/(?:png|jpe?g|webp|gif|avif);base64,)/i;
const MAX_IMAGE_EDGE = 8192;
const MAX_IMAGE_PIXELS = 24_000_000;

export async function decodeLocalImage(dataUrl: string): Promise<DecodedImage | null> {
  if (!dataUrl) return null;
  if (!LOCAL_IMAGE_SOURCE.test(dataUrl)) {
    throw new Error('Only local PNG, JPEG, WebP, GIF, or AVIF images are supported.');
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  try {
    if (
      bitmap.width > MAX_IMAGE_EDGE ||
      bitmap.height > MAX_IMAGE_EDGE ||
      bitmap.width * bitmap.height > MAX_IMAGE_PIXELS
    ) {
      throw new Error('Image is too large. Use an image up to 8192 px per side and 24 megapixels.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas image decoding is unavailable.');
    context.drawImage(bitmap, 0, 0);
    return {
      data: context.getImageData(0, 0, bitmap.width, bitmap.height),
      name: 'Local image',
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}
