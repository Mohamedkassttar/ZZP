/**
 * Image Compression Utilities
 *
 * Aggressive client-side image compression for AI analysis
 * Reduces payload from ~2.5MB to ~50KB for faster processing
 */

export const compressImage = async (file: File): Promise<string> => {
  // For PDFs, we can't easily resize, return base64 of original
  if (file.type === 'application/pdf') {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  // For images: Resize via Canvas
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);

        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maximum 1000px wide or high (enough for AI OCR)
        const MAX_SIZE = 1000;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw image with anti-aliasing for better quality at smaller size
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG 60% quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

        console.log(
          `📦 Image Compression: Original ${(file.size / 1024).toFixed(0)}KB → Compressed ${(dataUrl.length / 1024).toFixed(0)}KB (${Math.round((dataUrl.length / file.size) * 100)}%)`
        );

        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
};

/**
 * Convert File to Base64 without compression
 * Used for non-image files or when compression is not desired
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Get file type category for handling logic
 */
export const getFileCategory = (file: File): 'image' | 'pdf' | 'other' => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  return 'other';
};
