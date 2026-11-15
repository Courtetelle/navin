/**
 * Links to other sites open in Chrome, beside NavIn installed on the device
 * (its own window): the site and NavIn side by side (Split View on the iPad,
 * two windows on the tablet), never a page laid over NavIn.
 */

/** The device, for the way of opening Chrome. */
export type LinkDevice = 'ios' | 'android' | 'other';

/**
 * The address that opens a link in the Chrome app.
 * @param href - The link, `http(s)://…`.
 * @param device - The device.
 * @returns The address, or null where Chrome cannot be asked for.
 */
export function chromeUrl(href: string, device: LinkDevice): string | null {
  const match = /^(?<scheme>https?):\/\/(?<rest>.+)$/iu.exec(href);
  if (!match?.groups) return null;
  const { scheme, rest } = match.groups;
  const secure = scheme?.toLowerCase() === 'https';
  if (device === 'ios') {
    return `${secure ? 'googlechromes' : 'googlechrome'}://${rest}`;
  }
  if (device === 'android') {
    return `intent://${rest}#Intent;scheme=${secure ? 'https' : 'http'};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
  }
  return null;
}

function device(): LinkDevice {
  const { userAgent, maxTouchPoints } = navigator;
  if (/iPad|iPhone|iPod/u.test(userAgent)) return 'ios';
  // The iPad says it is a Mac, with a touch screen.
  if (userAgent.includes('Macintosh') && maxTouchPoints > 1) return 'ios';
  if (userAgent.includes('Android')) return 'android';
  return 'other';
}

function installed(): boolean {
  return (
    globalThis.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** Without Chrome on the iPhone or the iPad, the link opens as before. */
const NO_CHROME_MS = 1500;

function openInChrome(event: MouseEvent): void {
  if (event.defaultPrevented || !(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>('a[href]');
  if (!link || !/^https?:/iu.test(link.href)) return;
  if (new URL(link.href).origin === globalThis.location.origin) return;
  if (!installed()) return;
  const kind = device();
  const target = chromeUrl(link.href, kind);
  if (!target) return;
  event.preventDefault();
  const { href } = link;
  globalThis.location.href = target;
  if (kind !== 'ios') return;
  // Chrome opened: NavIn went to the background. Still here: no Chrome.
  setTimeout(() => {
    if (document.visibilityState === 'visible') {
      globalThis.open(href, '_blank', 'noopener');
    }
  }, NO_CHROME_MS);
}

/**
 * Every link to another site opens in Chrome while NavIn runs installed.
 * @returns Removes the listener.
 */
export function installChromeLinks(): () => void {
  document.addEventListener('click', openInChrome);
  return () => document.removeEventListener('click', openInChrome);
}
