import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { mobWatchFix } from '../../features/safety/mobLog.ts';
import { mobPrepare } from '../../features/safety/mobPrepare.ts';
import { mobZone } from '../../features/safety/mobProcedures.ts';
import { useRedraw } from '../../features/safety/useRedraw.ts';

import { MobEditList } from './MobEditList.tsx';
import { MobEditSection } from './MobEditSection.tsx';
import type { MobNote } from './MobMain.tsx';
import { MobMain } from './MobMain.tsx';

/** Sub-screen: the procedure, the list of sections, or one section. */
type Screen = 'main' | 'sections' | number;

/**
 * Screen `mob` (legacy `VIEWS.mob`): the man overboard procedure of the zone,
 * its log and its editor. Opening the screen starts the SOS procedure and the
 * log (`mobPrepare`, run by the navigation listener of the domain).
 * @returns The screen content.
 */
export function MobPage() {
  useSignals();
  const [screen, setScreen] = useState<Screen>('main');
  const { version, redraw: redrawScreen } = useRedraw();
  const [note, setNote] = useState<MobNote | null>(null);
  const [freshTitle, setFreshTitle] = useState(true);
  const redraw = (
    arg?: unknown,
    noStart = false,
    kept: MobNote | null = null,
  ) => {
    mobPrepare(arg, noStart);
    setNote(kept);
    setScreen('main');
    redrawScreen();
  };
  const open = (next: Screen) => {
    setFreshTitle(next !== screen);
    setScreen(next);
    redrawScreen();
  };
  useLakeWatch(screen === 'main' && mobZone.value === 'lac');
  if (screen === 'sections') {
    return (
      <MobEditList
        key={version}
        freshTitle={freshTitle}
        onBack={() => redraw()}
        onSection={open}
        onRedraw={() => open('sections')}
      />
    );
  }
  if (typeof screen === 'number') {
    return (
      <MobEditSection
        key={version}
        index={screen}
        onBack={() => open('sections')}
        onRedraw={() => open(screen)}
      />
    );
  }
  return (
    <MobMain
      key={version}
      note={note}
      onRedraw={(kept) => redraw(undefined, false, kept)}
      onKind={(kind) => redraw(kind, true)}
      onEdit={() => open('sections')}
    />
  );
}

function useLakeWatch(active: boolean): void {
  useEffect(() => {
    if (!active || !('geolocation' in navigator)) return undefined;
    const watch = navigator.geolocation.watchPosition(
      (fix) => {
        mobWatchFix({ lat: fix.coords.latitude, lon: fix.coords.longitude });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [active]);
}
