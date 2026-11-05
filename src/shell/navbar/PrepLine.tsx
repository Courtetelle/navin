import type { ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

interface PrepLineProps {
  hidden: boolean;
  children: ReactNode;
}

interface LineFit {
  over: boolean;
  moreLeft: boolean;
  moreRight: boolean;
}

const FITS: LineFit = { over: false, moreLeft: false, moreRight: false };

/**
 * `#prepLine`, the line of PréP step titles in the nav bar: when it does not
 * fit, it scrolls with the finger, the current step is centred and a fade
 * shows the side where more steps are (legacy `prepLineFit`, prep.js:540).
 * @param props - Visibility and step titles.
 * @returns The line element.
 */
export function PrepLine({ hidden, children }: PrepLineProps) {
  const reference = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<LineFit>(FITS);
  useLayoutEffect(() => {
    const line = reference.current;
    if (!line || hidden) return;
    const cut = [...line.children].some(
      (child) => child.scrollWidth > child.clientWidth + 1,
    );
    if (!cut && line.scrollWidth <= line.clientWidth + 1) {
      setFit(FITS);
      return;
    }
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
    setFit(measure(line));
  }, [hidden, children]);
  const classes = [
    fit.over && 'pl-over',
    fit.moreLeft && 'pl-more-l',
    fit.moreRight && 'pl-more-r',
  ].filter(Boolean);
  return (
    <div
      id="prepLine"
      ref={reference}
      hidden={hidden}
      className={classes.length > 0 ? classes.join(' ') : undefined}
      onScroll={(event) => {
        if (fit.over) setFit(measure(event.currentTarget));
      }}
    >
      {children}
    </div>
  );
}

function measure(line: HTMLElement): LineFit {
  return {
    over: true,
    moreLeft: line.scrollLeft > 4,
    moreRight: line.scrollLeft + line.clientWidth < line.scrollWidth - 4,
  };
}
