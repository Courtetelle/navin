import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { lemanVecVersion } from '../../features/map/lemanVector.ts';
import { applyMapDay } from '../../features/map/mapDayState.ts';
import type { PageProps } from '../../shell/pageTypes.ts';

import { MapContent } from './MapContent.tsx';

/**
 * Screen `map`: the track and the entries of a day or of the whole cruise
 * (legacy `VIEWS.map`). The legacy screen rewrote itself at each change of day.
 * @param props - Page props: `arg` is a day, or `'all'`.
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function MapPage({ arg }: PageProps) {
  useSignals();
  const [day, setDay] = useState(() => applyMapDay(arg));
  const [version, setVersion] = useState(0);
  return (
    <MapContent
      key={`${version}-${lemanVecVersion.value}`}
      day={day}
      onShowDay={(next) => {
        setDay(applyMapDay(next));
        setVersion((value) => value + 1);
      }}
    />
  );
}
