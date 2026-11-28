import { effect } from '@preact/signals-react';

import { setLakeOpen } from '../../shell/routing.ts';
import type { TrackPoint } from '../../state/index.ts';
import {
  endTraceVoyage,
  startTraceVoyage,
  state,
  traceCutTimes,
} from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { openIsLake } from './voyageWords.ts';

// The back button of an outing goes to « Sorties lacustres ».
setLakeOpen(openIsLake);

// A trace recorded while a cruise or outing is active is classed in it.
let recording: string | null = null;
effect(() => {
  const tracking = state.view.tracking.value;
  const cruise = state.data.cruise.peek();
  if (tracking && cruise && recording !== cruise.id) {
    recording = cruise.id;
    startTraceVoyage(
      cruise.id,
      Date.now(),
      state.data.voyageStore.peek().active,
    );
  } else if (!tracking && recording) {
    const id = recording;
    recording = null;
    const track = store.get<TrackPoint[]>(`ldb.track.${id}`, []);
    const first = track[0]?.[0];
    endTraceVoyage([
      ...(typeof first === 'number' ? [first] : []),
      ...traceCutTimes(id),
    ]);
  }
});
