/**
 * Short vibration on a touch (legacy `buzz`), ignored where unsupported.
 */
export function buzz(): void {
  try {
    navigator.vibrate?.(15);
  } catch {
    // No vibration on this device.
  }
}

/**
 * Open a `tel:` / `mailto:` / web link through a real anchor click; inside a
 * frame the link opens in a new tab (legacy `openLink`).
 * @param url - The link.
 */
export function openLink(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener';
  if (document.documentElement.classList.contains('in-frame')) {
    anchor.target = '_blank';
  }
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
