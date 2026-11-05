import { signal } from '@preact/signals-react';

import { buzz } from '../../lib/dom.ts';

import { showOverlays } from './overlayRoot.ts';

/** One picture of the full-screen viewer. */
export interface PhotoViewItem {
  /** Photo id. */
  id: string;
  /** Image source. */
  src: string;
  /** Caption for pictures outside the cruise photos (`data-cap`). */
  caption: string;
}

/** The series shown full screen. */
export interface PhotoViewState {
  items: PhotoViewItem[];
  index: number;
}

/** The series open in the viewer, null when closed. */
export const photoView = signal<PhotoViewState | null>(null);

/**
 * Touching a thumbnail of any `.photo-strip` opens it full screen with the
 * previous and next pictures of the same series. Every domain renders such
 * strips, so one listener serves them all.
 */
export function installPhotoViewer(): void {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const image = target.closest<HTMLImageElement>(
      '.photo-strip img[data-photo]',
    );
    if (!image?.src || target.closest('.photo-view')) return;
    buzz();
    openStrip(image);
  });
}

function openStrip(image: HTMLImageElement): void {
  const strip = image.closest('.photo-strip');
  if (!strip) return;
  const items: PhotoViewItem[] = [];
  let index = 0;
  for (const element of strip.querySelectorAll<HTMLImageElement>(
    'img[data-photo]',
  )) {
    if (!element.src) continue;
    if (element === image) index = items.length;
    items.push({
      id: element.dataset.photo ?? '',
      src: element.src,
      caption: element.dataset.cap ?? '',
    });
  }
  showOverlays();
  photoView.value = { items, index };
}
