import { useSignals } from '@preact/signals-react/runtime';

import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { traceListVersion } from '../../features/map/traceList.ts';
import { ListPublishRow } from '../../features/publish/index.ts';

import { TraceList } from './TraceList.tsx';

/**
 * Screen `traces`: every recorded track (legacy `VIEWS.traces`).
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function TracesPage() {
  useSignals();
  return (
    <>
      <PageTitle
        helps={[
          'Toutes les traces enregistrées. 🗺 l’affiche en violet sur la carte de NavIn, GPX l’exporte. 🗑 : la supprimer (avec confirmation).',
        ]}
      >
        🛰 Mes traces
      </PageTitle>
      <section className="field">
        <TraceList key={traceListVersion.value} />
      </section>
      <ListPublishRow kind="traces" />
    </>
  );
}
