import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { MasterCheck } from '../../components/shared/MasterCheck.tsx';
import { SendButton } from '../../components/shared/ShareButton.tsx';
import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import { updateSettings } from '../../state/index.ts';
import {
  CREW_LIST_COLS,
  crewListCols,
  printCrewList,
  shareCrewList,
} from '../onwater/index.ts';
import { PubModal } from '../publish/index.ts';

/** Props of {@link CrewPublish}. */
interface CrewPublishProps {
  /** The format chosen with « Partager ». */
  format: ShareFormat;
  /** The window closes. */
  onClose: () => void;
}

/**
 * The window that publishes the crew list of the outing as an image or a PDF,
 * with the information to include (legacy `crewPubOpen`, lake.js:1990).
 * @param props - Format and close action.
 * @returns The window.
 */
export function CrewPublish({ format, onClose }: CrewPublishProps) {
  useSignals();
  const [busy, setBusy] = useState(false);
  const selected: string[] = [];
  for (const [key] of crewListCols()) selected.push(key);
  const toggleAll = () => {
    const all: string[] = [];
    for (const [key] of CREW_LIST_COLS) all.push(key);
    setColumns(
      selected.length === CREW_LIST_COLS.length
        ? ['fonction', 'nom', 'tel']
        : all,
    );
  };
  return (
    <PubModal sub="Liste d’équipage" onClose={onClose}>
      <div className="cp-in">
        <div className="row">
          <SendButton
            format={format}
            data-cp={format === 'pdf' ? 'pdf' : 'img'}
            disabled={busy}
            onClick={() => {
              if (format === 'pdf') {
                onClose();
                printCrewList();
              } else {
                void shareCrewList(setBusy);
              }
            }}
          />
        </div>
        <p className="help lx-sec-h lx-opt-h">Réglages de l’envoi</p>
        <p className="help lx-sec-h">
          {`Infos à inclure (${selected.length} / ${CREW_LIST_COLS.length})`}
        </p>
        <div className="checks">
          <MasterCheck
            checked={selected.length}
            total={CREW_LIST_COLS.length}
            attribute="data-ccolall"
            onClick={toggleAll}
          />
          {CREW_LIST_COLS.map(([key, label]) => {
            const on = selected.includes(key);
            return (
              <Button
                key={key}
                type="button"
                className={`btn check ${on ? 'on' : ''}`}
                data-ccol={key}
                disabled={key === 'nom'}
                onClick={() =>
                  setColumns(
                    on
                      ? selected.filter((item) => item !== key)
                      : [...selected, key],
                  )
                }
              >
                <span className="box">{on ? '✔' : ''}</span>
                {label}
              </Button>
            );
          })}
        </div>
      </div>
    </PubModal>
  );
}

function setColumns(columns: string[]): void {
  updateSettings((settings) => {
    settings.crewCols = columns;
  });
}
