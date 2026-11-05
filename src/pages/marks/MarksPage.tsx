import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { gotoTarget, setGoto } from '../../features/map/goto.ts';
import { marksGpx, marksText } from '../../features/map/marksText.ts';
import { ListPublishRow } from '../../features/publish/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { deliver, state } from '../../state/index.ts';

import { MarkItem } from './MarkItem.tsx';

/**
 * Screen `marks`: the directory of marks, Go to and exports (legacy `VIEWS.marks`).
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function MarksPage() {
  useSignals();
  const tr = useTr();
  const inCruise = Boolean(state.data.cruise.value);
  const target = gotoTarget.value;
  const marks = state.data.marks.value.toSorted((a, b) => b.n - a.n);
  const backTo = inCruise ? 'more' : 'tracker';
  return (
    <>
      <PageBack
        label={`◀ ${tr(inCruise ? 'Plus' : 'Traceur')}`}
        data-go={backTo}
        onClick={() => {
          buzz();
          go(backTo);
        }}
      />
      <PageTitle
        helps={[
          'Appui long d’un doigt sur la carte (traceur ou carte du journal) › « Enregistrer une marque ». Numérotées dans l’ordre, avec date, heure et position.',
        ]}
      >
        Mes marques
      </PageTitle>
      {target ? (
        <ButtonRow>
          <Button
            className="btn danger"
            data-mk="stopgo"
            onClick={() => {
              buzz();
              setGoto(null);
            }}
          >
            {tr(`■ Arrêter le Go to (${target.name})`)}
          </Button>
        </ButtonRow>
      ) : null}
      <div id="mkList">
        {marks.length > 0 ? (
          marks.map((mark) => <MarkItem key={mark.id} mark={mark} />)
        ) : (
          <p className="help">
            {tr('Aucune marque pour l’instant.', { help: true })}
          </p>
        )}
      </div>
      {marks.length > 0 ? (
        <ButtonRow className="row c2">
          <Button
            className="btn"
            data-mk="gpx"
            onClick={() => {
              buzz();
              void deliver(
                marksGpx(state.data.marks.value),
                'navin-marques.gpx',
                'application/gpx+xml',
              );
            }}
          >
            {tr('📤 Exporter en GPX')}
          </Button>
          <Button
            className="btn"
            data-mk="txt"
            onClick={() => {
              buzz();
              void deliver(marksText(marks), 'navin-marques.txt', 'text/plain');
            }}
          >
            {tr('📋 Partager la liste')}
          </Button>
        </ButtonRow>
      ) : null}
      <ListPublishRow kind="marks" />
    </>
  );
}
