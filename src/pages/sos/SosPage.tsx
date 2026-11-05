import { useEffect, useState } from 'react';

import { sosRefresh } from '../../features/safety/safetyState.ts';
import type { SosKind } from '../../features/safety/sosScripts.ts';
import { useRedraw } from '../../features/safety/useRedraw.ts';
import type { PageProps } from '../../shell/pageTypes.ts';
import { state } from '../../state/index.ts';

import { SosAll } from './SosAll.tsx';
import { SosMain } from './SosMain.tsx';
import { SosScript } from './SosScript.tsx';

/** Argument of `go('sos')` that opens a message directly. */
export interface SosScriptTarget {
  script: SosKind;
  nature: number | null;
}

type Screen = 'main' | 'all' | SosScriptTarget;

/**
 * Screen `sos` (legacy `VIEWS.sos`): safety tools of the zone; `arg === 'all'`
 * shows the lake and sea tools; a radio message replaces the screen in place.
 * @param props - Page props.
 * @returns The screen content.
 */
export function SosPage({ arg }: PageProps) {
  const { version, redraw: redrawScreen } = useRedraw();
  const [screen, setScreen] = useState<Screen>(() => firstScreen(arg));
  const redraw = (next: Screen = 'main', scrollTop?: number) => {
    setScreen(next);
    redrawScreen(scrollTop);
  };
  useEffect(() => {
    let subscribed = false;
    return sosRefresh.subscribe(() => {
      if (subscribed) {
        setScreen('main');
        redrawScreen();
      }
      subscribed = true;
    });
  }, [redrawScreen]);
  if (typeof screen === 'object') {
    return (
      <SosScript
        key={version}
        kind={screen.script}
        nature={screen.nature}
        onNature={(nature) => redraw({ script: screen.script, nature }, 0)}
        onBack={() => redraw()}
      />
    );
  }
  const openScript = (script: SosKind) => {
    if (state.data.cruise.peek()) setScreen({ script, nature: null });
  };
  if (screen === 'all') {
    return (
      <SosAll
        key={version}
        onScript={openScript}
        onRedraw={() => redraw('all')}
        onEnded={() => redraw()}
      />
    );
  }
  return (
    <SosMain key={version} onScript={openScript} onRedraw={() => redraw()} />
  );
}

function firstScreen(arg: unknown): Screen {
  if (arg === 'all') return 'all';
  if (typeof arg === 'object' && arg !== null && 'script' in arg) {
    return arg as SosScriptTarget;
  }
  return 'main';
}
