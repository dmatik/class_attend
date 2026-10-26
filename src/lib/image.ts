/**
 * Image processing utilities for class_attend.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Resizes and compresses an image file using an HTML5 Canvas.
 * - Caps maximum dimension at maxWidth x maxHeight (default: 512x512).
 * - Preserves aspect ratio without upscaling smaller images.
 * - Compresses JPEG/WebP or resizes PNG, producing a compact Base64 data URL.
 * - Gracefully falls back to the original Data URL if Canvas 2D is unavailable.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<string> {
  const { maxWidth = 512, maxHeight = 512, quality = 0.85 } = options;

  if (!file.type.startsWith("image/")) {
    throw new Error("Invalid image file");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        reject(new Error("Empty image data"));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.onload = () => {
        let { width, height } = img;

        // Downscale while preserving aspect ratio (never upscale)
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Graceful fallback if Canvas 2D context is not available (e.g. headless/test environment)
          resolve(dataUrl);
          return;
        }

        const isPng = file.type === "image/png";
        const isWebp = file.type === "image/webp";

        // For formats without alpha transparency support (e.g., JPEG), fill background with white
        if (!isPng && !isWebp) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        const outputMime = isPng ? "image/png" : isWebp ? "image/webp" : "image/jpeg";
        try {
          const result = canvas.toDataURL(outputMime, quality);
          resolve(result);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

