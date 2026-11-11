import { signal } from '@preact/signals-react';

/** The browser's install prompt (Android / Chrome), not in the DOM typings. */
interface InstallPromptEvent extends Event {
  /** Shows the installation dialog. */
  prompt: () => Promise<unknown>;
  /** Settles when the user answered. */
  userChoice: Promise<unknown>;
}

/** Direct installation offered by the browser, once it fired `beforeinstallprompt`. */
export const installPrompt = signal<InstallPromptEvent | null>(null);

/** Tab shown by the installation guide, once chosen. */
export const guideTab = signal<'ios' | 'android' | null>(null);

/** Address of the site: where the app is served, outside the preview frame. */
export const APP_URL = appUrl();

/** {@link APP_URL} without protocol and final slash. */
export const APP_HOST = APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** Keep the browser's install prompt for the settings page (legacy app.js:3092). */
export function listenForInstallPrompt(): void {
  globalThis.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt.value = event as InstallPromptEvent;
  });
}

/**
 * The app runs from its home screen icon (legacy `isStandalone`).
 * @returns `true` when installed.
 */
export function isStandalone(): boolean {
  return (
    globalThis.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * Phone family of this device (legacy `platform`).
 * @returns `ios`, `android` or `other`.
 */
export function platform(): 'ios' | 'android' | 'other' {
  if (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  ) {
    return 'ios';
  }
  return /android/i.test(navigator.userAgent) ? 'android' : 'other';
}

function appUrl(): string {
  const { origin, pathname, protocol } = globalThis.location;
  if (
    /^https?:$/.test(protocol) &&
    !document.documentElement.classList.contains('in-frame')
  ) {
    return origin + pathname.replace(/[^/]*$/, '');
  }
  return 'https://livredebord.netlify.app';
}
