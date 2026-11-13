import { untracked } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import {
  ListPublishRow,
  openListPublish,
} from '../../features/publish/index.ts';
import { SosEndButton } from '../../features/safety/SosEndButton.tsx';
import { useRedraw } from '../../features/safety/useRedraw.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { go } from '../../shell/router.ts';
import { sosLogActive, state } from '../../state/index.ts';

import { EndedLog } from './EndedLog.tsx';
import { ActiveHeading, SosEvents } from './SosEvents.tsx';

/**
 * Screen `soslogs` (legacy `VIEWS.soslogs`): the running procedure and the
 * ended logs, whose deletion asks for a password.
 * @returns The screen content.
 */
export function SoslogsPage() {
  useSignals();
  useNavFields();
  const { version, redraw: redrawScreen } = useRedraw();
  const [openLog, setOpenLog] = useState<string | null>(null);
  const redraw = (open: string | null = null) => {
    setOpenLog(open);
    redrawScreen();
  };
  return <SosLogsContent key={version} openLog={openLog} onRedraw={redraw} />;
}

interface SosLogsContentProps {
  /** Log whose details stay open. */
  openLog: string | null;
  onRedraw: (open?: string | null) => void;
}

function SosLogsContent({ openLog, onRedraw }: SosLogsContentProps) {
  const tr = useTr();
  const { active, ended } = untracked(readScreen);
  return (
    <>
      <PageBack
        label="◀ data"
        data-go="more"
        onClick={() => {
          buzz();
          go('more');
        }}
      >
        {tr('◀ data')}
      </PageBack>
      <PageTitle
        helps={[
          'Dès qu’on touche SOS, un log démarre tout seul et note chaque action avec l’heure et la position. Si on quitte l’appli, il se met en pause et repart à la réouverture. Seule la « Fin de procédure SOS » (appui long, puis confirmer) l’arrête.',
          ...(ended.length === 0 && !active
            ? ['Aucun log SOS pour l’instant.']
            : []),
        ]}
      >
        🆘 SOS · logs
      </PageTitle>
      {active ? (
        <div className="mob-live">
          <ActiveHeading log={active} />
          <SosEvents log={active} />
          <ButtonRow className="row ck-pub-row">
            <ShareButton
              data-share={active.id}
              onShare={(format) =>
                openListPublish('soslogs', active.id, format)
              }
            />
          </ButtonRow>
          <SosEndButton onEnded={() => onRedraw()} />
        </div>
      ) : null}
      {ended.map((log) => (
        <EndedLog
          key={log.id}
          log={log}
          open={openLog === log.id}
          onRedraw={onRedraw}
        />
      ))}
      <ListPublishRow kind="soslogs" />
    </>
  );
}

function readScreen() {
  const ended = [];
  for (const log of state.data.sosLogs.value) {
    if (log.end) ended.unshift(log);
  }
  return {
    active: sosLogActive(),
    ended,
  };
}
