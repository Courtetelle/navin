import type L from 'leaflet';

import { ctlAutoAttach } from './ctlAuto.ts';
import { lpAttach } from './longPress.ts';
import { followMapTexts } from './mapTexts.ts';

/** The Leaflet library. */
export type LeafletLibrary = typeof L;

let library: LeafletLibrary | null = null;
let loading: Promise<LeafletLibrary> | null = null;

/**
 * The loaded library, for code that runs once a map exists.
 * @returns Leaflet.
 */
export function leaflet(): LeafletLibrary {
  if (!library) throw new Error('leaflet');
  return library;
}

/**
 * Load Leaflet on demand (legacy `loadLeaflet`). It reads `window` when
 * imported, so nothing may import it statically (node tests load the barrel).
 * Its stylesheet goes last in the head: `style.css` counts on being overridden.
 * @returns The library.
 */
export function loadLeaflet(): Promise<LeafletLibrary> {
  if (library) return Promise.resolve(library);
  loading ??= Promise.all([
    import('leaflet'),
    import('leaflet/dist/leaflet.css?inline'),
  ])
    .then(([{ default: loaded }, { default: css }]) => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.append(style);
      library = loaded;
      return loaded;
    })
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });
  return loading;
}

/**
 * Create a map with the long press menu and the hidden column of buttons, which
 * every map of the app has (legacy `L.Map.addInitHook`, marks.js:191).
 * @param box - Its container.
 * @param options - Leaflet options.
 * @returns The map.
 */
export function createMap(box: HTMLElement, options: L.MapOptions): L.Map {
  const map = leaflet().map(box, options);
  lpAttach(map);
  ctlAutoAttach(map);
  followMapTexts(map);
  return map;
}
