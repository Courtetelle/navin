import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import {
  copyCheckIn,
  currentCheckInSources,
} from '../../features/checklists/copyCheckIn.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

/**
 * Copy the check-in of another boat into this one: a button, then one button
 * per boat that has a check-in.
 * @param props - Draws the list again once copied.
 * @returns The button, or nothing without another check-in.
 */
export function CopyCheckIn({ onCopied }: { onCopied: () => void }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [sources] = useState(currentCheckInSources);
  if (sources.length === 0) return null;
  return (
    <>
      <ButtonRow className="row ck-copy-row">
        <Button
          className="btn"
          id="ckCopy"
          aria-expanded={open}
          onClick={() => {
            buzz();
            setOpen(!open);
          }}
        >
          {tr('📋 Copier la check-in d’un autre bateau')}
        </Button>
      </ButtonRow>
      {open ? (
        <div className="row prep-col">
          {sources.map((source) => (
            <Button
              key={source.boatId}
              className="btn"
              data-ckcopy={source.boatId}
              onClick={() => {
                buzz();
                copyCheckIn(source.boatId);
                setOpen(false);
                onCopied();
              }}
            >
              ⛵ {source.name}
              <small>{`${source.count} points`}</small>
            </Button>
          ))}
        </div>
      ) : null}
    </>
  );
}
