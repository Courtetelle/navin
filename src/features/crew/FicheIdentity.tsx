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
}

/**
 * First name, last name and the crew member pastille in one frame, at the top
 * of the card (lake.js:2192).
 * @param props - The card.
 * @returns The section.
 */
export function FicheIdentity({ record }: FicheIdentityProps) {
  const tr = useTr();
  const { data, prenomInput, nomInput, persist, change } = record;
  useMarquee(prenomInput);
  useMarquee(nomInput);
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
              autoComplete="off"
              defaultValue={textOf(data.prenom)}
              onChange={() => persist()}
            />
          </div>
          <div className="cf f-sexe" id="fSexe">
            <CompactForm
              flat
              sections={[{ fields: sex }]}
              data={data}
              onChange={(next) => {
                change(next);
                persist();
              }}
            />
          </div>
          <div className="cf wide f-nom">
            <label htmlFor="fNom">{tr('Nom')}</label>
            <input
              ref={nomInput}
              className="text"
              id="fNom"
              type="text"
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
