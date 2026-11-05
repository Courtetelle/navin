import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { GpsButton } from '../../features/safety/GpsButton.tsx';
import { mobLog } from '../../features/safety/mobLog.ts';
import { openView } from '../../features/safety/openView.ts';
import { SOS } from '../../features/safety/sosScripts.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { uid } from '../../lib/format.ts';
import { go } from '../../shell/router.ts';
import { addEntry, state } from '../../state/index.ts';

import type { MobNote } from './MobMain.tsx';

/** Props of {@link MobPositionRow}. */
export interface MobPositionRowProps {
  lake: boolean;
  training: boolean;
  /** Redraws the screen with a confirmation. */
  onRedraw: (note: MobNote) => void;
}

/**
 * Note the MOB position in the journal, then the emergency numbers on a lake or
 * the MAYDAY at sea.
 * @param props - Context and redraw.
 * @returns The buttons.
 */
export function MobPositionRow({
  lake,
  training,
  onRedraw,
}: MobPositionRowProps) {
  const tr = useTr();
  return (
    <ButtonRow className="row c2">
      <GpsButton
        className="btn big primary"
        id="mobPos"
        onPosition={(fix) => {
          const position = {
            lat: fix.coords.latitude,
            lon: fix.coords.longitude,
          };
          notePosition(position, training);
          onRedraw({ position, at: new Date(), training });
        }}
      >
        {tr('📍 Noter la position MOB')}
      </GpsButton>
      {lake ? (
        <Button
          className="btn big"
          data-go="sos"
          onClick={() => openView('sos')}
        >
          {tr('📞 Numéros d’urgence')}
        </Button>
      ) : (
        <Button
          className="btn big danger"
          id="mobMayday"
          onClick={() => {
            buzz();
            sendMayday();
          }}
        >
          {tr('MAYDAY homme à la mer')}
        </Button>
      )}
    </ButtonRow>
  );
}

function notePosition(
  position: { lat: number; lon: number },
  training: boolean,
): void {
  const at = new Date().toISOString();
  state.view.sosPos.value = { ...position, at };
  addEntry({
    id: uid(),
    t: at,
    v: {
      evt: ['Homme à la mer'],
      pos: position,
      ...(training ? { note: 'Entraînement' } : {}),
    },
  });
  mobLog('📍 Position MOB notée', { type: 'pos', pos: position });
}

function sendMayday(): void {
  mobLog('MAYDAY lancé', { type: 'mayday' });
  const nature = SOS.mayday.natures?.findIndex(
    (item) => item[0] === 'Homme à la mer',
  );
  go('sos', { script: 'mayday', nature });
}
