import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { fillPendingWeather } from '../../features/tracking/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { dayKey, fmtDate } from '../../lib/format.ts';
import type { Entry } from '../../model/types.ts';
import { go } from '../../shell/router.ts';
import { navLabel, state } from '../../state/index.ts';

import { EntryCard } from './EntryCard.tsx';

const ROW_STYLE = { marginBottom: '12px' };

/**
 * Screen `log`: the journal, most recent first, grouped by day (legacy `VIEWS.log`).
 * @returns The screen content.
 */
export function LogPage() {
  useSignals();
  const tr = useTr();
  const cruise = state.data.cruise.value;
  if (!cruise) return null;
  const { entries } = cruise;
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        {tr('Aucune entrée pour l’instant.')}
        <br />
        <br />
        <Button
          className="btn big primary"
          id="goNew"
          onClick={() => go('new')}
        >
          {tr('＋ Première entrée')}
        </Button>
      </div>
    );
  }
  const count = entries.length;
  return (
    <>
      <PageTitle>{`Journal · ${count} entrée${count > 1 ? 's' : ''}`}</PageTitle>
      <ButtonRow style={ROW_STYLE}>
        <Button
          className="btn"
          data-map="all"
          onClick={() => {
            buzz();
            go('map', 'all');
          }}
        >
          {tr('🗺 Voir la croisière sur la carte')}
        </Button>
      </ButtonRow>
      <PendingWeather entries={entries} />
      {groupByDay(entries).map((group) => (
        <DayGroup key={group.key} group={group} />
      ))}
    </>
  );
}

interface DayEntries {
  key: string;
  date: Date;
  entries: Entry[];
}

function groupByDay(entries: readonly Entry[]): DayEntries[] {
  const groups: DayEntries[] = [];
  for (const entry of entries.toReversed()) {
    const date = new Date(entry.t);
    const key = dayKey(date);
    const last = groups.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else groups.push({ key, date, entries: [entry] });
  }
  return groups;
}

function DayGroup({ group }: { group: DayEntries }) {
  const tr = useTr();
  const navigation = navLabel(group.key);
  return (
    <>
      <div className="day-head">
        <span>
          {tr(fmtDate(group.date))}
          {navigation ? (
            <small className="nav-dur">
              {tr(`⏱ navigation ${navigation}`)}
            </small>
          ) : null}
        </span>
        <span className="dh-btns">
          <Button
            className="btn small-btn"
            data-map={group.key}
            onClick={() => {
              buzz();
              go('map', group.key);
            }}
          >
            🗺
          </Button>
          <Button
            className="btn small-btn"
            data-day={group.key}
            onClick={() => {
              buzz();
              go('day', group.key);
            }}
          >
            {tr('Fiche')}
          </Button>
        </span>
      </div>
      <div className="day-grid">
        {group.entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </>
  );
}

function PendingWeather({ entries }: { entries: readonly Entry[] }) {
  const tr = useTr();
  const [progress, setProgress] = useState<string | null>(null);
  let pending = 0;
  for (const entry of entries) if (entry.needWx) pending++;
  if (pending === 0) return null;
  const plural = pending > 1 ? 's' : '';
  return (
    <ButtonRow style={ROW_STYLE}>
      <Button
        className="btn primary"
        id="wxAll"
        disabled={progress !== null}
        onClick={() => {
          void fillPendingWeather(setProgress).finally(() => setProgress(null));
        }}
      >
        {progress ??
          tr(
            `🌬 Ajouter la météo à ${pending} entrée${plural} automatique${plural} (réseau)`,
          )}
      </Button>
    </ButtonRow>
  );
}
