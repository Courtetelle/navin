import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { TzTime } from '../../components/shared/TzTime.tsx';
import { fmtDate, toLocalInput } from '../../lib/format.ts';
import { state, updateDraft } from '../../state/index.ts';

import { CommitInput } from './CommitInput.tsx';

/**
 * Time of the entry: −5, now, +5 minutes, or any date; it stops following the
 * clock once set by hand (legacy `datetime`).
 * @returns The editor.
 */
export function DateTimeEntry() {
  useSignals();
  const draft = state.data.draft.value;
  if (!draft) return null;
  const date = new Date(draft.t);
  const shift = (minutes: number) => {
    updateDraft((form) => {
      form.tManual = true;
      form.t = new Date(
        new Date(form.t).getTime() + minutes * 60_000,
      ).toISOString();
    });
  };
  const local = toLocalInput(date);
  return (
    <>
      <div className="value">
        <TzTime date={date} />
        <div style={{ fontSize: '18px' }}>{fmtDate(date)}</div>
      </div>
      <ButtonRow className="row c3">
        <Button className="btn step" data-min="-5" onClick={() => shift(-5)}>
          −5<small>min</small>
        </Button>
        <Button
          className="btn primary"
          data-act="now"
          onClick={() => {
            updateDraft((form) => {
              form.tManual = false;
              form.t = new Date().toISOString();
            });
          }}
        >
          Maintenant
        </Button>
        <Button className="btn step" data-min="5" onClick={() => shift(5)}>
          +5<small>min</small>
        </Button>
      </ButtonRow>
      <div className="row">
        <CommitInput
          key={local}
          className="text"
          type="datetime-local"
          defaultValue={local}
          aria-label="Choisir date et heure"
          onCommit={(value) => {
            if (!value) return;
            updateDraft((form) => {
              form.t = new Date(value).toISOString();
              form.tManual = true;
            });
          }}
        />
      </div>
    </>
  );
}
