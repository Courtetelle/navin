import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { MarqueeInput } from '../../features/logbook/index.ts';
import { openListPublish } from '../../features/publish/index.ts';
import { sosDeleteId } from '../../features/safety/safetyState.ts';
import { sosHash } from '../../features/safety/sosHash.ts';
import { toastThenRedraw } from '../../features/safety/toastThenRedraw.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate, pad } from '../../lib/format.ts';
import type { SosLog } from '../../model/types.ts';
import { saveSosLogs, state, toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { SosEvents } from './SosEvents.tsx';

/** Props of {@link EndedLog}. */
export interface EndedLogProps {
  log: SosLog;
  /** The details are open. */
  open: boolean;
  hasPassword: boolean;
  onRedraw: (open?: string | null) => void;
}

/**
 * An ended SOS log: its events, publish, and deletion by password.
 * @param props - Log, state and redraw.
 * @returns The folded details.
 */
export function EndedLog({ log, open, hasPassword, onRedraw }: EndedLogProps) {
  useSignals();
  const tr = useTr();
  const deleting = sosDeleteId.value === log.id;
  return (
    <details className="section" open={open}>
      <summary>{tr(summaryOf(log))}</summary>
      <div style={{ padding: '0 14px 12px' }}>
        <SosEvents log={log} />
        <ButtonRow className="row c2">
          <Button
            className="btn ck-pub"
            data-share={log.id}
            onClick={() => {
              buzz();
              openListPublish('soslogs', log.id);
            }}
          >
            {tr('📤 Publier')}
          </Button>
          <Button
            className="btn danger"
            data-del={log.id}
            onClick={() => {
              buzz();
              sosDeleteId.value = deleting ? null : log.id;
              onRedraw(log.id);
            }}
          >
            {tr('🗑 Effacer')}
          </Button>
        </ButtonRow>
        {deleting ? (
          <DeleteForm log={log} hasPassword={hasPassword} onRedraw={onRedraw} />
        ) : null}
      </div>
    </details>
  );
}

function summaryOf(log: SosLog): string {
  const start = new Date(log.start);
  const parts = [
    `${log.ex ? '🧪 Exercice · ' : ''}${fmtShortDate(start)}`,
    `${hoursMinutes(log.start)} → ${hoursMinutes(log.end as string)}`,
    `${log.events.length} actions`,
  ];
  if (log.boat) parts.push(log.boat);
  return parts.join(' · ');
}

function hoursMinutes(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function DeleteForm({
  log,
  hasPassword,
  onRedraw,
}: Omit<EndedLogProps, 'open'>) {
  const tr = useTr();
  const password = useRef<HTMLInputElement>(null);
  const repeated = useRef<HTMLInputElement>(null);
  useEffect(() => {
    password.current?.focus();
  }, []);
  return (
    <div className="sl-pwd">
      <MarqueeInput
        ref={password}
        className="text"
        type="password"
        id="slPwd"
        placeholder={tr.placeholder(
          hasPassword ? 'Mot de passe' : 'Choisir un mot de passe',
        )}
        autoComplete="off"
      />
      {hasPassword ? null : (
        <MarqueeInput
          ref={repeated}
          className="text"
          type="password"
          id="slPwd2"
          placeholder={tr.placeholder('Répéter le mot de passe')}
          autoComplete="off"
        />
      )}
      <Button
        className="btn big danger"
        data-delok={log.id}
        onClick={() => {
          buzz();
          void confirmDelete(
            log.id,
            password.current?.value ?? '',
            repeated.current?.value,
            onRedraw,
          );
        }}
      >
        {tr(
          hasPassword ? 'Effacer ce log' : 'Définir le mot de passe et effacer',
        )}
      </Button>
    </div>
  );
}

async function confirmDelete(
  id: string,
  password: string,
  repeated: string | undefined,
  onRedraw: () => void,
): Promise<void> {
  if (!password) {
    toast('Entrez le mot de passe');
    return;
  }
  const stored = store.get('ldb.sosPwd', '');
  if (!stored) {
    if (password.length < 4) {
      toast('Au moins 4 caractères');
      return;
    }
    if (password !== repeated) {
      toast('Les deux mots de passe sont différents');
      return;
    }
    store.set('ldb.sosPwd', await sosHash(password));
  } else if ((await sosHash(password)) !== stored) {
    toast('⚠ Mot de passe incorrect : rien n’est effacé');
    return;
  }
  toastThenRedraw('Log SOS effacé', () => {
    state.data.sosLogs.value = state.data.sosLogs.value.filter(
      (log) => log.id !== id,
    );
    saveSosLogs();
    sosDeleteId.value = null;
    onRedraw();
  });
}
