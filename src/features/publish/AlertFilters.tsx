import type { ReactElement } from 'react';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import type { AlertKind } from '../../model/alertLog.ts';
import { ALERT_KINDS, alertsIn } from '../../model/alertLog.ts';
import { alertLog } from '../../state/index.ts';

import { keepOnly } from './listChoiceActions.ts';

/**
 * The alerts to share: by kind and between two days; then each one can still
 * be checked or unchecked in the list above.
 * @returns The choices.
 */
export function AlertFilters(): ReactElement {
  const [kinds, setKinds] = useState<ReadonlySet<AlertKind>>(
    () => new Set(ALERT_KINDS.map(([kind]) => kind)),
  );
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const apply = (next: ReadonlySet<AlertKind>, start: string, end: string) => {
    const kept = new Set(
      alertsIn(alertLog.peek(), next, start, end).map((alert) => alert.id),
    );
    keepOnly(
      'alerts',
      alertLog
        .peek()
        .filter((alert) => !kept.has(alert.id))
        .map((alert) => alert.id),
    );
  };
  return (
    <div className="alert-filters">
      <p className="help">Catégories à partager</p>
      <div className="row c2">
        {ALERT_KINDS.map(([kind, name, icon]) => (
          <Button
            key={kind}
            type="button"
            choice
            className={kinds.has(kind) ? 'btn on' : 'btn'}
            data-alert-kind={kind}
            onClick={() => {
              const next = new Set(kinds);
              if (next.has(kind)) next.delete(kind);
              else next.add(kind);
              setKinds(next);
              apply(next, from, to);
            }}
          >
            {`${icon} ${name}`}
          </Button>
        ))}
      </div>
      <p className="help">Période (vide : toutes les dates)</p>
      <div className="row c2">
        <label className="cf">
          Du
          <input
            className="text"
            type="date"
            data-alert-from
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              apply(kinds, event.target.value, to);
            }}
          />
        </label>
        <label className="cf">
          Au
          <input
            className="text"
            type="date"
            data-alert-to
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value);
              apply(kinds, from, event.target.value);
            }}
          />
        </label>
      </div>
    </div>
  );
}
