import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { NoVoyage } from '../../features/voyages/NoVoyage.tsx';
import {
  freeRecords,
  setNavigationVoyage,
  setRouteVoyage,
  setRoutingVoyage,
  voyageRecords,
} from '../../features/voyages/voyageRecords.ts';
import { voyageBack } from '../../features/voyages/voyageWords.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { state } from '../../state/index.ts';

/** One record: its name and date, and the button that moves it. */
interface RecordLine {
  id: string;
  name: string;
  when: string;
}

/**
 * Records of one kind: those of the cruise, each with « Retirer », or the
 * free ones, each with « ＋ Ajouter ».
 * @param props - Lines and actions.
 * @param props.kind - `nav`, `route` or `routing` (data attributes).
 * @param props.lines - The records.
 * @param props.inside - They are in the cruise.
 * @param props.onMove - Move one in or out.
 * @param props.empty - Text when there is none.
 * @returns The lines.
 */
function Lines({
  kind,
  lines,
  inside,
  onMove,
  empty,
}: {
  kind: string;
  lines: readonly RecordLine[];
  inside: boolean;
  onMove: (id: string) => void;
  empty: string;
}) {
  const tr = useTr();
  if (lines.length === 0) return <HelpText>{empty}</HelpText>;
  return (
    <div className="voy-records">
      {lines.map((line) => (
        <div
          key={line.id}
          className="voy-record"
          data-voyrec={`${kind}:${line.id}`}
        >
          <span className="voy-record-text">
            <b>{line.name}</b>
            {line.when ? <small>{line.when}</small> : null}
          </span>
          <Button
            className={`btn ${inside ? '' : 'act-add'}`}
            data-voyrecmove={`${kind}:${line.id}`}
            onClick={() => {
              buzz();
              onMove(line.id);
            }}
          >
            {tr(inside ? 'Retirer' : '＋ Ajouter')}
          </Button>
        </div>
      ))}
    </div>
  );
}

function day(iso: string | number | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : fmtShortDate(date);
}

/**
 * Screen `vrecords` (a cruise › Enregistrements): the navigations (with
 * their traces and photos), routes and routings of the cruise. Those made
 * while it is active join it by themselves; the others can be added.
 * @returns The screen content.
 */
export function VoyageRecordsPage() {
  useSignals();
  const tr = useTr();
  const voyage = state.data.voyages.value;
  const back = (
    <PageBack
      label={voyageBack()}
      data-go="voyage"
      onClick={() => {
        buzz();
        go('voyage');
      }}
    >
      {tr(voyageBack())}
    </PageBack>
  );
  if (!voyage.id) {
    return (
      <>
        {back}
        <NoVoyage />
      </>
    );
  }
  const mine = voyageRecords(voyage.id);
  const free = freeRecords();
  const navLines = (list: typeof mine.navigations): RecordLine[] =>
    list.map((meta) => ({
      id: meta.id,
      name: meta.name,
      when: day(meta.created),
    }));
  const routeLines = (list: typeof mine.routes): RecordLine[] =>
    list.map((route) => ({
      id: route.id,
      name: route.name,
      when: day(route.at),
    }));
  const routingLines = (list: typeof mine.routings): RecordLine[] =>
    list.map((routing) => ({
      id: routing.id,
      name: routing.shown.name || routing.summary,
      when: day(routing.departMs),
    }));
  const isActive = state.data.voyageStore.value.active === voyage.id;
  return (
    <>
      {back}
      <PageTitle
        helps={[
          'Les navigations (avec leurs traces et leurs photos), routes et routages créés pendant que la croisière est active la rejoignent tout seuls. « ＋ Ajouter » y range ceux d’avant, « Retirer » les en sort.',
        ]}
      >
        🛰 Enregistrements
      </PageTitle>
      <HelpText>
        {isActive
          ? '⭐ Croisière active : ce qui est créé maintenant la rejoint.'
          : 'Croisière non active : rendez-la active pour qu’elle rassemble ce qui est créé.'}
      </HelpText>
      <FoldSection
        title={`Navigations, traces et photos · ${mine.navigations.length}`}
        titleText="voy-rec-nav"
      >
        <Lines
          kind="nav"
          lines={navLines(mine.navigations)}
          inside
          onMove={(id) => setNavigationVoyage(id, undefined)}
          empty="Aucune navigation dans cette croisière."
        />
        <ButtonRow>
          <Button
            className="btn"
            data-go="cruises"
            onClick={() => {
              buzz();
              go('cruises');
            }}
          >
            {tr('📒 Mes navigations')}
          </Button>
        </ButtonRow>
      </FoldSection>
      <FoldSection
        title={`Routes · ${mine.routes.length}`}
        titleText="voy-rec-route"
      >
        <Lines
          kind="route"
          lines={routeLines(mine.routes)}
          inside
          onMove={(id) => setRouteVoyage(id, undefined)}
          empty="Aucune route dans cette croisière."
        />
      </FoldSection>
      <FoldSection
        title={`Routages · ${mine.routings.length}`}
        titleText="voy-rec-routing"
      >
        <Lines
          kind="routing"
          lines={routingLines(mine.routings)}
          inside
          onMove={(id) => setRoutingVoyage(id, undefined)}
          empty="Aucun routage dans cette croisière."
        />
      </FoldSection>
      <FoldSection title="Ajouter à la croisière" titleText="voy-rec-free">
        <h3 className="sub-h">{tr('Navigations')}</h3>
        <Lines
          kind="nav"
          lines={navLines(free.navigations)}
          inside={false}
          onMove={(id) => setNavigationVoyage(id, voyage.id)}
          empty="Aucune autre navigation."
        />
        <h3 className="sub-h">{tr('Routes')}</h3>
        <Lines
          kind="route"
          lines={routeLines(free.routes)}
          inside={false}
          onMove={(id) => setRouteVoyage(id, voyage.id)}
          empty="Aucune autre route."
        />
        <h3 className="sub-h">{tr('Routages')}</h3>
        <Lines
          kind="routing"
          lines={routingLines(free.routings)}
          inside={false}
          onMove={(id) => setRoutingVoyage(id, voyage.id)}
          empty="Aucun autre routage."
        />
      </FoldSection>
    </>
  );
}
