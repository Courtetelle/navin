import { useSignals } from '@preact/signals-react/runtime';

import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { NoVoyage } from '../../features/voyages/NoVoyage.tsx';
import { useChapterEdit } from '../../features/voyages/useChapterEdit.tsx';
import { dayText } from '../../features/voyages/voyageDates.ts';
import { useTr } from '../../i18n/useTr.ts';
import { showsUtc } from '../../lib/clockMode.ts';
import { buzz } from '../../lib/dom.ts';
import { INFO_FIELDS } from '../../model/voyages.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import {
  state,
  syncVoyageNavigations,
  updateVoyages,
} from '../../state/index.ts';

/** The hour field of each date. */
/** A web address typed without its scheme still opens. */
const webHref = (value: string): string =>
  /^https?:\/\//iu.test(value.trim())
    ? value.trim()
    : `https://${value.trim()}`;

const HOUR_OF: Readonly<Record<string, string>> = { du: 'duH', au: 'auH' };

/**
 * Screen `vinfo` (a cruise › Croisière): ports, dates, VHF channel of the
 * marina, coast station and weather bulletins, taken over from « Bateau et
 * croisière ». Its navigations take these values at the ✔ (VHF calls, SOS
 * page, CV).
 * @returns The screen content.
 */
export function VoyageInfoPage() {
  useSignals();
  const tr = useTr();
  const voyage = state.data.voyages.value;
  const empty = !INFO_FIELDS.some(([key]) => voyage.info[key]?.trim());
  // A cruise still empty opens on its fields, for the first entry.
  const { editing, validate } = useChapterEdit(
    () => syncVoyageNavigations(voyage.id),
    empty,
  );
  if (!voyage.id) return <NoVoyage />;
  const filled = INFO_FIELDS.filter(
    ([key, , kind]) => kind !== 'time' && voyage.info[key]?.trim(),
  );
  return (
    <>
      <PageBack
        label="◀ Croisière"
        data-go="voyage"
        onClick={() => {
          buzz();
          go('voyage');
        }}
      >
        {tr('◀ Croisière')}
      </PageBack>
      {validate}
      <PageTitle
        helps={[
          'À la première ouverture, les champs sont prêts à remplir ; ensuite le crayon en haut permet de les changer. Au ✔, les navigations de la croisière reprennent ports, dates, VHF et téléphone de la marina (appels VHF, page SOS, CV nautique).',
        ]}
      >
        🧭 Port d’attache
      </PageTitle>
      {editing ? (
        <div className="cgrid voy-info">
          {INFO_FIELDS.map(([key, label, kind]) => (
            <div
              key={key}
              className={`cf voy-${key} ${kind === 'date' || kind === 'time' ? '' : 'wide'}`}
            >
              <label htmlFor={`vi-${key}`}>
                {tr(label)}
                {/* Typed in the phone's time, even when the clock shows UTC. */}
                {kind === 'time' && showsUtc() ? (
                  <small>{` (${tr('heure locale')})`}</small>
                ) : null}
              </label>
              {kind === 'area' ? (
                <textarea
                  id={`vi-${key}`}
                  className="text"
                  rows={5}
                  value={voyage.info[key] ?? ''}
                  onChange={(event) =>
                    updateVoyages((draft) => {
                      draft.info[key] = event.target.value;
                    })
                  }
                />
              ) : (
                <input
                  id={`vi-${key}`}
                  className="text"
                  type={
                    ['date', 'time', 'tel', 'url'].includes(kind)
                      ? kind
                      : 'text'
                  }
                  value={voyage.info[key] ?? ''}
                  autoComplete="off"
                  onChange={(event) =>
                    updateVoyages((draft) => {
                      draft.info[key] = event.target.value;
                    })
                  }
                />
              )}
            </div>
          ))}
        </div>
      ) : filled.length > 0 ? (
        <dl className="voy-lines voy-info-read">
          {filled.map(([key, label, kind]) => (
            <div key={key} className="voy-line">
              <dt>{tr(label)}</dt>
              <dd>
                {kind === 'tel' ? (
                  <a
                    className="voy-link"
                    href={`tel:${(voyage.info[key] ?? '').replaceAll(/[^\d+]/gu, '')}`}
                  >
                    📞 {voyage.info[key]}
                  </a>
                ) : kind === 'url' ? (
                  <a
                    className="voy-link"
                    href={webHref(voyage.info[key] ?? '')}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🌐 {voyage.info[key]}
                  </a>
                ) : (
                  <span
                    className="voy-text"
                    // What was typed stays as typed, never painted as UTC.
                    data-no-hr={kind === 'date' ? undefined : ''}
                  >
                    {kind === 'date'
                      ? dayText(
                          voyage.info[key] ?? '',
                          voyage.info[HOUR_OF[key] ?? '']?.trim() ?? '',
                        )
                      : voyage.info[key]}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <HelpText>À compléter : touchez le crayon en haut.</HelpText>
      )}
    </>
  );
}
