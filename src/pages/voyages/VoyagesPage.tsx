import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import type { VoyageSectionKey } from '../../model/voyages.ts';
import { VOYAGE_SECTIONS, knownSections } from '../../model/voyages.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { createVoyage, openVoyage, state, toast } from '../../state/index.ts';

/**
 * The form of a new cruise: the sections of the cruises kept, ticked, and
 * whether it becomes the active one.
 * @param props - How to close it.
 * @param props.onClose - Closes the form.
 * @returns The form.
 */
function NewVoyage({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const offered = knownSections(state.data.voyageStore.value.list);
  const [ticked, setTicked] = useState<VoyageSectionKey[]>(offered);
  const [active, setActive] = useState(true);
  return (
    <section className="field voy-new">
      <h2>{tr('Nouvelle croisière')}</h2>
      <HelpText>
        Sections à reprendre, vides : d’autres s’ajoutent ensuite une à une.
      </HelpText>
      <ButtonRow className="row c3">
        {VOYAGE_SECTIONS.filter((section) => offered.includes(section.key)).map(
          (section) => {
            const on = ticked.includes(section.key);
            return (
              <Button
                key={section.key}
                className={`btn big ${on ? 'on' : ''}`}
                data-voynewsec={section.key}
                onClick={() => {
                  buzz();
                  setTicked(
                    on
                      ? ticked.filter((key) => key !== section.key)
                      : [...ticked, section.key],
                  );
                }}
              >
                {on ? '☑ ' : '☐ '}
                {tr(section.title)}
              </Button>
            );
          },
        )}
      </ButtonRow>
      <ButtonRow>
        <Button
          className={`btn big ${active ? 'on' : ''}`}
          data-voynewactive
          onClick={() => {
            buzz();
            setActive(!active);
          }}
        >
          {active ? '☑ ' : '☐ '}
          {tr('⭐ Croisière active')}
          <small>
            {tr(
              'les nouvelles navigations (traces, photos), routes et routages la rejoignent',
            )}
          </small>
        </Button>
      </ButtonRow>
      <ButtonRow className="row c2">
        <Button
          className="btn big primary"
          data-voynew="ok"
          onClick={() => {
            buzz();
            const voyage = createVoyage(ticked, active);
            toast(`« ${voyage.name} » créée`);
            onClose();
            go('voyage');
          }}
        >
          {tr('✔ Créer')}
        </Button>
        <Button
          className="btn big"
          data-voynew="cancel"
          onClick={() => {
            buzz();
            onClose();
          }}
        >
          {tr('Annuler')}
        </Button>
      </ButtonRow>
    </section>
  );
}

/**
 * Screen `voyages` (data › Croisières): the list of the cruises, the active
 * one marked ⭐, and the creation of a new one.
 * @returns The screen content.
 */
export function VoyagesPage() {
  useSignals();
  const tr = useTr();
  const [creating, setCreating] = useState(false);
  const { list, active } = state.data.voyageStore.value;
  const shown = list.toSorted(
    (first, second) =>
      Number(second.id === active) - Number(first.id === active) ||
      second.num - first.num ||
      second.created.localeCompare(first.created),
  );
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
          'Une fiche par croisière en location : équipage, contrats, documents, et ce qui est enregistré pendant qu’elle est active (navigations avec traces et photos, routes, routages). Le nom est automatique (« 13 Nouvelle croisière 2026 ») et se change dans la croisière.',
        ]}
      >
        ⛵ Croisières
      </PageTitle>
      {creating ? (
        <NewVoyage onClose={() => setCreating(false)} />
      ) : (
        <ButtonRow>
          <Button
            className="btn big act-add"
            data-voyadd="new"
            onClick={() => {
              buzz();
              setCreating(true);
            }}
          >
            {tr('＋ Nouvelle croisière')}
          </Button>
        </ButtonRow>
      )}
      {shown.length === 0 ? (
        <HelpText>Aucune croisière pour l’instant.</HelpText>
      ) : (
        <div className="row more-grid data-tiles voy-list">
          {shown.map((voyage) => (
            <Button
              key={voyage.id}
              className={`btn big ${voyage.id === active ? 'voy-active' : ''}`}
              data-voyopen={voyage.id}
              onClick={() => {
                buzz();
                openVoyage(voyage.id);
                go('voyage');
              }}
            >
              {voyage.id === active ? '⭐ ' : '⛵ '}
              {voyage.name}
              <small>
                {voyage.id === active ? tr('croisière active · ') : ''}
                {voyage.created
                  ? `${tr('créée le')} ${fmtShortDate(new Date(voyage.created))}`
                  : ''}
              </small>
            </Button>
          ))}
        </div>
      )}
    </>
  );
}
