import { useSignals } from '@preact/signals-react/runtime';

import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { NoVoyage } from '../../features/voyages/NoVoyage.tsx';
import { useChapterEdit } from '../../features/voyages/useChapterEdit.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { INFO_FIELDS } from '../../model/voyages.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import {
  state,
  syncVoyageNavigations,
  updateVoyages,
} from '../../state/index.ts';

function shown(value: string, kind: string): string {
  if (kind !== 'date') return value;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : fmtShortDate(date);
}

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
  const { editing, validate } = useChapterEdit(() =>
    syncVoyageNavigations(voyage.id),
  );
  if (!voyage.id) return <NoVoyage />;
  const filled = INFO_FIELDS.filter(([key]) => voyage.info[key]?.trim());
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
          'Le crayon en haut permet de changer ces valeurs ; au ✔, les navigations de la croisière les reprennent pour les appels VHF, la page SOS et le CV nautique.',
        ]}
      >
        🧭 Croisière
      </PageTitle>
      {editing ? (
        <div className="cgrid voy-info">
          {INFO_FIELDS.map(([key, label, kind]) => (
            <div key={key} className={`cf ${kind === 'date' ? '' : 'wide'}`}>
              <label htmlFor={`vi-${key}`}>{tr(label)}</label>
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
                  type={kind === 'date' ? 'date' : 'text'}
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
                <span className="voy-text">
                  {shown(voyage.info[key] ?? '', kind)}
                </span>
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
