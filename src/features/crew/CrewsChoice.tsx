import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import type { CrewSet } from '../../model/types.ts';
import { toast } from '../../state/index.ts';

import {
  patchCrewsEdit,
  saveCrewsEdit,
  saveCrewsEditAsNew,
} from './crewsEdit.ts';
import { showCrewsEdit } from './screen.ts';

/** Props of {@link CrewsChoice}. */
export interface CrewsChoiceProps {
  /** Saved composition that was changed. */
  base: CrewSet;
  /** The user tried to leave without choosing. */
  flashed: boolean;
}

/**
 * A changed composition is saved only once the user chose: overwrite it,
 * make it a new one, or cancel (prep.js:797).
 * @param props - Saved composition.
 * @returns The choice block.
 */
export function CrewsChoice({ base, flashed }: CrewsChoiceProps) {
  const tr = useTr();
  const ident = base.ident ?? '';
  return (
    <div
      className={flashed ? 'crew-choice lab-flash' : 'crew-choice'}
      id="ceChoice"
    >
      <HelpText
        nextIsRow
        text={`Équipage ${ident} modifié (pas encore enregistré). Que faire ?`}
      >
        <b>{tr(`Équipage ${ident} modifié`, { help: true })}</b>
        {tr(' (pas encore enregistré). Que faire ?', { help: true })}
      </HelpText>
      <ButtonRow className="row c2">
        <Button
          className="btn big"
          id="ceOver"
          onClick={() => {
            buzz();
            patchCrewsEdit({ mode: 'over' });
            saveCrewsEdit();
            toast(`✓ ${ident} écrasé, même numéro`);
            showCrewsEdit();
          }}
        >
          {tr(`✎ Écraser ${ident}`)}
          <small>{tr('garder ce numéro')}</small>
        </Button>
        <Button
          className="btn big no-navact"
          id="ceAsNew"
          onClick={() => {
            buzz();
            toast(`✓ Nouvel équipage ${saveCrewsEditAsNew(base)}`);
            showCrewsEdit();
          }}
        >
          {tr('＋ Nouvel équipage')}
          <small>{tr('nouveau numéro')}</small>
        </Button>
      </ButtonRow>
      <ButtonRow>
        <Button
          className="btn"
          id="ceUndo"
          onClick={() => {
            buzz();
            patchCrewsEdit({ crew: base.crew.map((line) => ({ ...line })) });
            toast('Modifications annulées');
            showCrewsEdit();
          }}
        >
          {tr('↺ Annuler les modifications')}
        </Button>
      </ButtonRow>
    </div>
  );
}
