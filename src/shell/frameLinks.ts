/**
 * In a framed preview (`html.in-frame`), call and mail links open outside the
 * frame (nav.js:139-143).
 * @returns Removes the listener.
 */
export function installFrameLinks(): () => void {
  document.addEventListener('click', openOutsideFrame, true);
  return () => document.removeEventListener('click', openOutsideFrame, true);
}

function openOutsideFrame(event: MouseEvent): void {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>(
    'a[href^="tel:"], a[href^="mailto:"]',
  );
  if (!link || !document.documentElement.classList.contains('in-frame')) return;
  link.target = '_blank';
  link.rel = 'noopener';
}
