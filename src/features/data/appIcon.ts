import { store } from '../../storage/store.ts';

/** Icon of every installation: the icon choice left the settings. */
const ICON_ID = 'navin1';

/** Icon kept for the next start (`ldb.iconData`). */
interface KeptIcon {
  id: string;
  url: string;
}

/**
 * Apply the app icon (legacy `applyIcon`): the touch icon goes into the page
 * itself as a data URL, kept in `ldb.iconData` for the next starts; the page
 * icon and the web manifest follow.
 */
export function applyIcon(): void {
  const kept = store.get<KeptIcon | null>('ldb.iconData', null);
  if (kept?.id === ICON_ID) setTouchIcon(kept.url);
  else void fetchTouchIcon();
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icon) icon.href = `icons/${ICON_ID}.svg`;
  const manifest = document.querySelector<HTMLLinkElement>(
    'link[rel="manifest"]',
  );
  if (manifest) manifest.href = `icons/manifest-${ICON_ID}.webmanifest`;
}

async function fetchTouchIcon(): Promise<void> {
  try {
    const response = await fetch(`icons/${ICON_ID}-180.png`);
    if (!response.ok) throw new Error(`icon: ${response.status}`);
    const url = await readAsDataUrl(await response.blob());
    store.set('ldb.iconData', { id: ICON_ID, url });
    setTouchIcon(url);
  } catch {
    setTouchIcon(`icons/${ICON_ID}-180.png`);
  }
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      resolve(reader.result as string);
    });
    reader.addEventListener('error', () => {
      reject(new Error('icon not read'));
    });
    reader.readAsDataURL(blob);
  });
}

// A new link element: Safari only reads the touch icon of an element it has not seen.
function setTouchIcon(url: string): void {
  const link = document.createElement('link');
  link.rel = 'apple-touch-icon';
  link.href = url;
  document.querySelector('link[rel="apple-touch-icon"]')?.replaceWith(link);
}
