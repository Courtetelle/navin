import type { SyntheticEvent } from 'react';
import { useState } from 'react';

/**
 * Caption contrast of a captioned photo (nav.js:1337-1348): when the image
 * loads, the brightness of its bottom fifth decides the class `cap-light`
 * (dark text) of the `<figure>`. Put `onLoad` on the `<img>` and `className`
 * on the figure (legacy did it only for figures with a `<figcaption>`).
 * @param className - Classes of the figure.
 * @returns The figure class and the image load handler.
 */
export function useCaptionLight(className: string): {
  className: string;
  onLoad: (event: SyntheticEvent<HTMLImageElement>) => void;
} {
  const [light, setLight] = useState(false);
  return {
    className: light ? `${className} cap-light` : className,
    onLoad: (event) => setLight(isBottomLight(event.currentTarget)),
  };
}

/**
 * Average luminance of the bottom 22 % of an image above 0.58.
 * @param image - Loaded image.
 * @returns `true` for a light bottom (false when unreadable).
 */
export function isBottomLight(image: HTMLImageElement): boolean {
  try {
    const canvas = document.createElement('canvas');
    const width = 40;
    const height = 12;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    const { naturalWidth, naturalHeight } = image;
    if (!context || !naturalWidth || !naturalHeight) return false;
    context.drawImage(
      image,
      0,
      naturalHeight * 0.78,
      naturalWidth,
      naturalHeight * 0.22,
      0,
      0,
      width,
      height,
    );
    const { data } = context.getImageData(0, 0, width, height);
    let sum = 0;
    for (let index = 0; index < data.length; index += 4) {
      sum +=
        0.2126 * (data[index] ?? 0) +
        0.7152 * (data[index + 1] ?? 0) +
        0.0722 * (data[index + 2] ?? 0);
    }
    return sum / (data.length / 4) / 255 > 0.58;
  } catch {
    return false;
  }
}
