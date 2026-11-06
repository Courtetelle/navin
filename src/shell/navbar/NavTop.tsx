import { signal } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';
import type { ReactNode, RefObject } from 'react';
import { useLayoutEffect, useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { useAutoRoll } from '../../components/shared/useAutoRoll.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { state } from '../../state/index.ts';
import { hasBodyClass, setBodyClass } from '../bodyClass.ts';

import { PrepLine } from './PrepLine.tsx';
import {
  navBack,
  navExit,
  navNext,
  navOk,
  navPillClick,
} from './navActions.ts';
import {
  fieldOwners,
  firstInDocument,
  navBackLabel,
  navBarShown,
  navEdit,
  navSteps,
  pageBackTarget,
  prepLineContent,
  validateTargets,
} from './navBarState.ts';
import { useExitHold } from './useExitHold.ts';

/** What legacy only refreshes while the bar is shown (nav.js:48 returns early). */
interface StickyNav {
  backLabel: string;
  hasSteps: boolean;
  pills: ReactNode;
  nextShown: boolean;
  lineHidden: boolean;
}

const sticky = signal<StickyNav>({
  backLabel: 'Retour',
  hasSteps: false,
  pills: null,
  nextShown: false,
  lineHidden: true,
});

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 21l1.2-5.2L15.6 4.4a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L8.2 19.8 3 21zm3-4.2-.5 2.7 2.7-.5L17.6 9.6l-2.2-2.2L6 16.8z"
      />
    </svg>
  );
}

/**
 * The nav bar under the top bar (`#navtop`, nav.js:10-96 and 1242-1336):
 * « ◀ Retour » (the page's own back button or the history), the PréP pills and
 * ▶, the green ✔ that validates a sheet, « Sortir » to the tab root, and the
 * PréP step line.
 * @returns The nav bar.
 */
export function NavTop() {
  useSignals();
  const tr = useTr();
  const shown = navBarShown.value;
  const view = state.view.currentView.value;
  const prepOn = hasBodyClass('prep-on');
  const steps = navSteps.value;
  const prepBar = prepOn ? steps?.prepBar : undefined;
  const validate = firstInDocument(validateTargets.value);
  const okShown =
    shown &&
    (Boolean(steps) ||
      Boolean(validate) ||
      (!prepOn && view !== 'prep' && fieldOwners.value > 0));
  const reference = useRef<HTMLDivElement>(null);
  const exitHold = useExitHold(Boolean(steps), () => steps?.onReset());
  const previous = sticky.value;
  const live: StickyNav = {
    backLabel: navBackLabel(pageBackTarget(), prepOn),
    hasSteps: Boolean(steps),
    pills: steps ? steps.pills : previous.pills,
    nextShown: Boolean(prepBar?.onNext),
    lineHidden: !steps,
  };
  const nav = shown ? live : previous;
  const backLabel = tr(nav.backLabel);
  const backReference = useRef<HTMLButtonElement>(null);
  const backRoll = useAutoRoll(
    backReference,
    backLabel,
    backLabel,
    nav.backLabel,
    okShown,
  );

  useLayoutEffect(() => {
    setBodyClass('has-navtop', shown);
    if (shown) setBodyClass('prep-top', Boolean(prepBar));
    if (shown && !sameSticky(live, sticky.peek())) sticky.value = live;
  });
  useNavHeight(reference, shown);

  const classes = [nav.hasSteps && 'has-steps', okShown && 'has-ok']
    .filter(Boolean)
    .join(' ');
  const lineContent = prepLineContent.value;
  return (
    <div
      id="navtop"
      hidden={!shown}
      className={classes || undefined}
      ref={reference}
    >
      <Button
        className={backRoll.className ? `btn ${backRoll.className}` : 'btn'}
        id="navBack"
        ref={backReference}
        onClick={navBack}
      >
        {backRoll.content}
      </Button>
      <div
        id="navMid"
        className="prep-steps"
        hidden
        onClick={(event) => navPillClick(event.target)}
      >
        {nav.pills}
      </div>
      <Button
        className="btn"
        id="navNext"
        hidden={!nav.nextShown}
        onClick={navNext}
      >
        {tr('Suivant')}
      </Button>
      <Button
        className={navEdit.value ? 'btn nav-edit' : 'btn'}
        id="navOk"
        hidden={!okShown}
        aria-label={navEdit.value ? 'Modifier' : 'Valider'}
        onClick={(event) => {
          event.stopPropagation();
          navOk();
        }}
      >
        {navEdit.value ? <PencilIcon /> : '✔'}
      </Button>
      <Button
        className={exitHold.holding ? 'btn holding' : 'btn'}
        id="navExit"
        onClick={(event) => {
          if (!exitHold.consumeClick(event)) navExit();
        }}
        {...exitHold.handlers}
      >
        {tr('Sortir')}
      </Button>
      <Button className="btn primary" id="navAct" hidden />
      {lineContent === null ? null : (
        <PrepLine hidden={nav.lineHidden}>{lineContent}</PrepLine>
      )}
    </div>
  );
}

function sameSticky(first: StickyNav, second: StickyNav): boolean {
  return (
    first.backLabel === second.backLabel &&
    first.hasSteps === second.hasSteps &&
    first.pills === second.pills &&
    first.nextShown === second.nextShown &&
    first.lineHidden === second.lineHidden
  );
}

/**
 * Keep `--navtop-h` equal to the bar height, 0 when hidden (nav.js:1317-1321).
 * @param reference - The bar element.
 * @param shown - The bar is visible.
 */
function useNavHeight(
  reference: RefObject<HTMLDivElement | null>,
  shown: boolean,
): void {
  useLayoutEffect(() => {
    const bar = reference.current;
    if (!bar) return undefined;
    const set = () =>
      document.documentElement.style.setProperty(
        '--navtop-h',
        `${bar.hidden ? 0 : bar.offsetHeight}px`,
      );
    set();
    if (!globalThis.ResizeObserver) return undefined;
    const observer = new ResizeObserver(set);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [reference, shown]);
}
