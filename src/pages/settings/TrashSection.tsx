import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import {
  TRASH_MS,
  TRASH_PLACES,
  restoreTrash,
  trashLines,
} from '../../features/trash/trash.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { toast } from '../../state/index.ts';

const DAY_MS = 24 * 3600 * 1000;

/**
 * Paramètres › 🗑 Poubelle: what was deleted on this device or on another one
 * of the skipper, 30 days; « Récupérer » puts it back where it was.
 * @returns The list.
 */
export function TrashSection() {
  useSignals();
  const tr = useTr();
  const lines = trashLines.value;
  // The days left are counted from the opening of the section.
  const [now] = useState(() => Date.now());
  return (
    <>
      <HelpText>
        Ce qui a été effacé ici ou sur un autre appareil (T, P, X) reste 30
        jours dans la Poubelle. « Récupérer » le remet dans sa liste, sur tous
        les appareils synchronisés.
      </HelpText>
      {lines.length === 0 ? (
        <HelpText>La Poubelle est vide.</HelpText>
      ) : (
        <div className="trash-list">
          {lines.map((line) => {
            const left = Math.max(
              1,
              Math.ceil((line.at + TRASH_MS - now) / DAY_MS),
            );
            return (
              <div key={line.key} className="trash-line" data-trash={line.key}>
                <span className="trash-text">
                  <b>{line.label}</b>
                  <small>
                    {`${tr(TRASH_PLACES[line.kind])} · ${tr('effacé le')} ${fmtShortDate(new Date(line.at))} · ${tr('encore')} ${left} ${tr(left > 1 ? 'jours' : 'jour')}`}
                  </small>
                </span>
                <Button
                  className="btn big primary"
                  data-trashback={line.key}
                  onClick={() => {
                    buzz();
                    void restoreTrash(line.key).then((back) => {
                      toast(
                        back
                          ? `« ${line.label} » récupéré dans ${TRASH_PLACES[line.kind]}`
                          : 'Impossible de le récupérer sur cet appareil',
                      );
                    });
                  }}
                >
                  {tr('↩ Récupérer')}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
