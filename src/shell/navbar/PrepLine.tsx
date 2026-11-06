import type { ReactNode } from 'react';
import { useLayoutEffect, useRef } from 'react';

interface PrepLineProps {
  hidden: boolean;
  children: ReactNode;
}

/**
 * `#prepLine`, the line of PréP step titles in the nav bar: when it does not
 * fit, it scrolls with the finger, the current step is centred and a fade
 * shows the side where more steps are (legacy `prepLineFit`, prep.js:540).
 * @param props - Visibility and step titles.
 * @returns The line element.
 */
export function PrepLine({ hidden, children }: PrepLineProps) {
  const reference = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (reference.current && !hidden) fitLine(reference.current);
  }, [hidden, children]);
  return (
    <div
      id="prepLine"
      ref={reference}
      hidden={hidden}
      onScroll={(event) => {
        const line = event.currentTarget;
        if (line.classList.contains('pl-over')) markSides(line);
      }}
    >
      {children}
    </div>
  );
}

// The classes change the size of the items, so each measure needs the element
// in the right state: they are set on the element, between the measures.
function fitLine(line: HTMLElement): void {
  line.classList.remove('pl-over', 'pl-more-l', 'pl-more-r');
  const cut = [...line.children].some(
    (child) => child.scrollWidth > child.clientWidth + 1,
  );
  if (!cut && line.scrollWidth <= line.clientWidth + 1) return;
  line.classList.add('pl-over');
  const current = line.querySelector('.pl-cur');
  if (current) {
    const itemBox = current.getBoundingClientRect();
    const lineBox = line.getBoundingClientRect();
    line.scrollLeft = Math.max(
      0,
      line.scrollLeft +
        itemBox.left -
        lineBox.left -
        (line.clientWidth - itemBox.width) / 2,
    );
  }
  markSides(line);
}

function markSides(line: HTMLElement): void {
  line.classList.toggle('pl-more-l', line.scrollLeft > 4);
  line.classList.toggle(
    'pl-more-r',
    line.scrollLeft + line.clientWidth < line.scrollWidth - 4,
  );
}
