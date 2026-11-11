import type { ReactNode } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { TzTime } from '../../components/shared/TzTime.tsx';
import { EmergencyCalls } from '../../features/safety/EmergencyCalls.tsx';
import { SosEndButton } from '../../features/safety/SosEndButton.tsx';
import type { MobKind } from '../../features/safety/mobDefaults.ts';
import { MOB_KINDS } from '../../features/safety/mobDefaults.ts';
import { mobActive, mobLog } from '../../features/safety/mobLog.ts';
import { mobScreen } from '../../features/safety/mobPrepare.ts';
import { openView } from '../../features/safety/openView.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtPos } from '../../lib/geo.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';

import { MobHistory } from './MobHistory.tsx';
import { MobLive } from './MobLive.tsx';
import { MobPosBox } from './MobPosBox.tsx';
import { MobPositionRow } from './MobPositionRow.tsx';
import { MobSteps } from './MobSteps.tsx';

/** The confirmation under the buttons after « Noter la position MOB ». */
export interface MobNote {
  position: { lat: number; lon: number };
  at: Date;
  training: boolean;
}

/** Props of {@link MobMain}. */
interface MobMainProps {
  note: MobNote | null;
  /** Redraws the screen, keeping a confirmation. */
  onRedraw: (note?: MobNote | null) => void;
  onKind: (kind: MobKind) => void;
  onEdit: () => void;
}

/**
 * The procedure, drawn from the log at this moment (legacy `VIEWS.mob`): live
 * banner, lake calls, steps, position buttons and log.
 * @param props - Screen actions.
 * @returns The screen content.
 */
export function MobMain({ note, onRedraw, onKind, onEdit }: MobMainProps) {
  const tr = useTr();
  const { log, kind, lake, hasCruise, french } = mobScreen.peek();
  const training = kind === 'train';
  return (
    <>
      <PageBack
        label={hasCruise ? '◀ Sécurité' : '◀ Plus'}
        data-go={hasCruise ? 'sos' : 'more'}
        onClick={() => openView(hasCruise ? 'sos' : 'more')}
      >
        {tr(hasCruise ? '◀ Sécurité' : '◀ Plus')}
      </PageBack>
      <h1 className="sos-title red">{tr('🛟 Homme à la mer')}</h1>
      <ButtonRow className="row c2 ck-tabs" choice>
        {(Object.keys(MOB_KINDS) as MobKind[]).map((item) => (
          <Button
            key={item}
            className={item === kind ? 'btn on' : 'btn'}
            data-kind={item}
            choice
            onClick={() => {
              buzz();
              onKind(item);
            }}
          >
            {tr(MOB_KINDS[item])}
          </Button>
        ))}
      </ButtonRow>
      {log ? (
        <MobLive
          log={log}
          training={training}
          lake={lake}
          onRedraw={onRedraw}
        />
      ) : null}
      {lake ? (
        <>
          <MobPosBox />
          <EmergencyCalls
            french={french}
            dataKey="data-mcall"
            onCall={(label, number) => {
              if (!mobActive()) return;
              const name = label.replace(/^\S+\s/, '');
              mobLog(`📞 Appel ${name} (${number})`, { type: 'note' });
            }}
          />
          <HelpText>
            Si le premier appel n’aboutit pas, essayez le suivant. Les numéros
            courts suisses ne passent que sur un réseau suisse ; le 112 passe
            partout.
          </HelpText>
        </>
      ) : null}
      <HelpText>
        Touchez chaque action quand elle est faite : elle passe en vert avec
        l’heure et la position. Un nouveau toucher l’annule (c’est noté aussi).
      </HelpText>
      <MobSteps log={log} onRedraw={onRedraw} />
      {hasCruise ? (
        <MobPositionRow lake={lake} training={training} onRedraw={onRedraw} />
      ) : (
        <HelpText>
          Position MOB dans le journal et MAYDAY : disponibles une fois une
          navigation ouverte.
        </HelpText>
      )}
      <HelpText id="mobNote">{note ? <NoteText note={note} /> : null}</HelpText>
      <MobHistory log={log} />
      <ButtonRow>
        <Button
          className="btn"
          id="mobEdit"
          onClick={() => {
            buzz();
            onEdit();
          }}
        >
          {tr(
            `✎ Modifier la procédure ${training ? 'd’entraînement' : 'cas réel'}`,
          )}
        </Button>
      </ButtonRow>
      <SosEndButton onEnded={() => onRedraw()} />
    </>
  );
}

function NoteText({ note }: { note: MobNote }): ReactNode {
  return (
    <>
      <b>
        Position MOB {fmtPos(note.position)} à <TzTime date={note.at} seconds />
      </b>
      , notée dans le journal et le log
      {note.training ? ' (entraînement)' : ''}.
    </>
  );
}
