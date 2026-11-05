import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fr } from '../../lib/format.ts';
import { boatById, state, updateSettings } from '../../state/index.ts';

import { fmtHours, lakeDays, statsSummary } from './statsLogic.ts';

const PERIODS = [
  ['semaine', 'Semaine'],
  ['mois', 'Mois'],
  ['annee', 'Année'],
] as const;

/**
 * Screen `stats`: miles and hours on the lake by boat and period (legacy `VIEWS.stats`).
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function StatsPage() {
  useSignals();
  const tr = useTr();
  const [changed, setChanged] = useState(false);
  const settings = state.preferences.settings.value;
  const period = (settings.statsPeriod as string | undefined) || 'mois';
  const chosen = new Set(settings.statsBoats as string[] | undefined);
  const days = lakeDays(state.data.index.value);
  const boatIds = [
    ...new Set([
      ...days.map((day) => day.boatId),
      ...state.data.boats.value.map((boat) => boat.id),
    ]),
  ];
  const { total, periods, max } = statsSummary(days, chosen, period);
  const toggleBoat = (id: string) => {
    buzz();
    setChanged(true);
    const next = new Set(chosen);
    if (!id) next.clear();
    else if (next.has(id)) next.delete(id);
    else next.add(id);
    updateSettings((draft) => {
      draft.statsBoats = [...next];
    });
  };
  const periodTitle = PERIODS.find(([key]) => key === period)?.[1] ?? 'Semaine';
  return (
    <>
      <PageTitle
        atTop={!changed}
        helps={[
          'Toutes les sorties lacustres de ce téléphone. Milles de la fiche du jour, sinon de la trace GPS. Heures de navigation entre départ et arrivée.',
        ]}
      >
        Cumul sur le lac
      </PageTitle>
      <h2 className="sub-h">{tr('Bateaux')}</h2>
      <div className="chips stats-boats">
        <Button
          choice
          className={chosen.size > 0 ? 'btn' : 'btn on'}
          data-sb=""
          onClick={() => toggleBoat('')}
        >
          {tr('Tous')}
        </Button>
        {boatIds.map((id) => (
          <Button
            key={String(id)}
            choice
            className={chosen.has(String(id)) ? 'btn on' : 'btn'}
            data-sb={String(id)}
            onClick={() => toggleBoat(String(id))}
          >
            {boatById(id)?.info.boat || tr('Bateau supprimé')}
          </Button>
        ))}
      </div>
      <h2 className="sub-h">{tr('Période')}</h2>
      <div className="row c3">
        {PERIODS.map(([key, label]) => (
          <Button
            key={key}
            className={period === key ? 'btn on' : 'btn'}
            data-sp={key}
            onClick={() => {
              buzz();
              setChanged(true);
              updateSettings((draft) => {
                draft.statsPeriod = key;
              });
            }}
          >
            {tr(label)}
          </Button>
        ))}
      </div>
      <div className="stats-total">
        <div>
          <b>{fr(total.nm)}</b>
          <small>{tr('NM')}</small>
        </div>
        <div>
          <b>{fmtHours(total.ms)}</b>
          <small>{tr('navigation')}</small>
        </div>
        <div>
          <b>{total.n}</b>
          <small>{tr(`sortie${total.n > 1 ? 's' : ''}`)}</small>
        </div>
      </div>
      {periods.length > 0 ? (
        <table className="stats-t">
          <tbody>
            <tr>
              <th>{tr(periodTitle)}</th>
              <th>{tr('Sorties')}</th>
              <th>{tr('Milles')}</th>
              <th>{tr('Heures')}</th>
            </tr>
            {periods.map(([key, group]) => (
              <tr key={key}>
                <td>
                  {group.label}
                  <div
                    className="bar"
                    style={{ width: `${Math.round((group.nm / max) * 100)}%` }}
                  />
                </td>
                <td>{group.n}</td>
                <td>{fr(group.nm)}</td>
                <td>{fmtHours(group.ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty-state">
          {tr(
            'Pas encore de sortie avec des milles ou une durée pour ce choix.',
          )}
        </div>
      )}
    </>
  );
}
