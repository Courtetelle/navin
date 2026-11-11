import { signal } from '@preact/signals-react';

import { inFrenchLeman } from '../../model/contacts.ts';
import {
  lastKnownPos,
  navZone,
  sosLogActive,
  state,
} from '../../state/index.ts';

import type { MobKind } from './mobDefaults.ts';
import type { MobLogRecord } from './mobLog.ts';
import { mobActive, mobEventPositions, mobLive, mobLog } from './mobLog.ts';
import { mobAllure, mobKind, mobSections, mobZone } from './mobProcedures.ts';
import { sosLogStart } from './sosLogStart.ts';

/** What the page shows, read when it is drawn: a GPS answer waits for the next redraw. */
interface MobScreen {
  log: MobLogRecord | null;
  kind: MobKind;
  lake: boolean;
  hasCruise: boolean;
  /** Position on the French side: French services first. */
  french: boolean;
}

/** State of the page at its last draw. */
export const mobScreen = signal<MobScreen>({
  log: null,
  kind: 'real',
  lake: true,
  hasCruise: false,
  french: false,
});

/**
 * Prepare the page before it is drawn (top of legacy `VIEWS.mob`). Opening the
 * page starts the SOS procedure and the log; a redraw (`arg` undefined) or a
 * change of procedure (`noStart`) does not.
 * @param arg - Page argument: `real`, `train`, `lac`, `mer`, null, or undefined for a redraw.
 * @param noStart - Do not start the logs.
 */
export function mobPrepare(arg?: unknown, noStart = false): void {
  if (arg === 'real' || arg === 'train') {
    mobKind.value = arg;
    mobAllure.value = 0;
  }
  const open = mobActive();
  if (arg === 'lac' || arg === 'mer') {
    mobZone.value = arg;
    mobAllure.value = 0;
  } else if (open?.zone) {
    mobZone.value = open.zone;
  } else {
    mobZone.value = navZone();
  }
  if (arg !== undefined && !noStart) {
    if (!sosLogActive()) sosLogStart('Homme à la mer ouvert');
    if (!mobActive()) mobLog('Log démarré', { type: 'note' });
  }
  state.view.tzLocalOnly.value = mobZone.value === 'lac';
  let allures = 0;
  for (const section of mobSections()) if (section.allure) allures++;
  if (mobAllure.value >= allures) mobAllure.value = 0;
  mobEventPositions.value = {};
  const current = mobLive.value ?? lastKnownPos();
  mobScreen.value = {
    log: mobActive(),
    kind: mobKind.value,
    lake: mobZone.value === 'lac',
    hasCruise: state.data.cruise.value !== null,
    french: inFrenchLeman(current),
  };
}
