import heic2any from 'heic2any';
import type { PhotoItem } from '../../types/project';

const MAX_LONG_EDGE = 2304;

/**
 * Checks if a file is an Apple HEIC/HEIF image.
 */
export function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.heic') ||
    name.endsWith('.heif') ||
    file.type === 'image/heic' ||
    file.type === 'image/heif'
  );
}

/**
 * Converts a HEIC file to JPEG blob using heic2any.
 */
async function convertHeicToJpeg(file: File): Promise<Blob> {
  const result = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.92,
  });
  if (Array.isArray(result)) {
    return result[0];
  }
  return result;
}

/**
 * Loads and downscales an image file to a maximum long edge of 2304px with EXIF orientation correction.
 */
export async function loadAndProcessImage(file: File): Promise<PhotoItem> {
  let blob: Blob = file;

  // 1. Handle HEIC conversion if needed
  if (isHeicFile(file)) {
    try {
      blob = await convertHeicToJpeg(file);
    } catch (err) {
      console.error('HEIC conversion error:', err);
      throw new Error(
        `iPhone写真(${file.name})のデコードに失敗しました。JPEG形式への変換をお試しください。`
      );
    }
  }

  // 2. Decode Image and get natural dimensions
  let bitmap: ImageBitmap | HTMLCanvasElement;
  let originalWidth = 0;
  let originalHeight = 0;

  try {
    // Try createImageBitmap with automatic orientation
    const rawBitmap = await createImageBitmap(blob, {
      imageOrientation: 'from-image',
    });
    originalWidth = rawBitmap.width;
    originalHeight = rawBitmap.height;

    // Calculate downscaled dimensions
    const maxDim = Math.max(originalWidth, originalHeight);
    if (maxDim > MAX_LONG_EDGE) {
      const scale = MAX_LONG_EDGE / maxDim;
      const targetW = Math.round(originalWidth * scale);
      const targetH = Math.round(originalHeight * scale);

      bitmap = await createImageBitmap(blob, {
        imageOrientation: 'from-image',
        resizeWidth: targetW,
        resizeHeight: targetH,
        resizeQuality: 'high',
      });
      rawBitmap.close();
    } else {
      bitmap = rawBitmap;
    }
  } catch {
    // Fallback using HTMLImageElement and Canvas
    const img = new Image();
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`画像(${file.name})の読み込みに失敗しました。`));
      img.src = url;
    });

    originalWidth = img.naturalWidth;
    originalHeight = img.naturalHeight;

    const maxDim = Math.max(originalWidth, originalHeight);
    const scale = maxDim > MAX_LONG_EDGE ? MAX_LONG_EDGE / maxDim : 1.0;
    const targetW = Math.round(originalWidth * scale);
    const targetH = Math.round(originalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvasの作成に失敗しました。');
    ctx.drawImage(img, 0, 0, targetW, targetH);
    bitmap = canvas;
    URL.revokeObjectURL(url);
  }

  const previewUrl = URL.createObjectURL(blob);
  const id = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    id,
    file,
    name: file.name,
    originalWidth,
    originalHeight,
    previewUrl,
    bitmap,
  };
}
