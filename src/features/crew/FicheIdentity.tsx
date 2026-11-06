import { useLayoutEffect, useRef } from 'react';

import { useMarquee } from '../../components/shared/useMarquee.ts';
import { useTr } from '../../i18n/useTr.ts';
import { textOf } from '../../lib/format.ts';
import { memberFieldsX } from '../../state/index.ts';
import { CompactForm } from '../logbook/index.ts';

import type { FicheRecord } from './useFicheRecord.ts';

/** Props of {@link FicheIdentity}. */
export interface FicheIdentityProps {
  /** The card. */
  record: FicheRecord;
  /** The card is open for reading. */
  reading: boolean;
}

/**
 * First name, last name and the crew member pastille in one frame, at the top
 * of the card (lake.js:2192).
 * @param props - The card.
 * @returns The section.
 */
export function FicheIdentity({ record, reading }: FicheIdentityProps) {
  const tr = useTr();
  const { data, prenomInput, nomInput, persist, change } = record;
  useMarquee(prenomInput);
  useMarquee(nomInput);
  const nomCell = useRef<HTMLDivElement>(null);
  // The name lives in its input: without one, a read-only card does not show it.
  useLayoutEffect(() => {
    if (nomCell.current) {
      nomCell.current.hidden = reading && !nomInput.current?.value;
    }
  }, [reading, nomInput]);
  const sex = memberFieldsX().filter((field) => field.key === 'sexe');
  return (
    <section className="field">
      <div className="cgrid">
        <div className="cf wide cf-pair cf-frame" data-frame="ident">
          <div className="cf">
            <label htmlFor="fPrenom">
              {tr('Prénom ')}
              <span className="req">*</span>
            </label>
            <input
              ref={prenomInput}
              className="text"
              id="fPrenom"
              type="text"
              readOnly={reading}
              autoComplete="off"
              defaultValue={textOf(data.prenom)}
              onChange={() => persist()}
            />
          </div>
          <div className="cf f-sexe" id="fSexe" hidden={reading && !data.sexe}>
            <CompactForm
              flat
              filledOnly={reading}
              sections={[{ fields: sex }]}
              data={data}
              onChange={(next) => {
                change(next);
                persist();
              }}
            />
          </div>
          <div ref={nomCell} className="cf wide f-nom">
            <label htmlFor="fNom">{tr('Nom')}</label>
            <input
              ref={nomInput}
              className="text"
              id="fNom"
              type="text"
              readOnly={reading}
              autoComplete="off"
              defaultValue={textOf(data.nom)}
              onChange={() => persist()}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
