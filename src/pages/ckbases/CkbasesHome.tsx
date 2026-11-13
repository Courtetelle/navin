import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { BaseButton } from '../../features/checklists/PickBaseScreen.tsx';
import {
  ListPublishRow,
  openListPublish,
} from '../../features/checklists/neighbours.ts';
import { useScreenLead } from '../../features/checklists/useScreenLead.ts';
import { SwipeRow } from '../../features/prep/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { textOf, uid } from '../../lib/format.ts';
import { go } from '../../shell/router.ts';
import { state, updateCkLib, updateSettings } from '../../state/index.ts';

import { BoatLists } from './BoatLists.tsx';

const BASES_HELP =
  'Listes modèles gardées dans le téléphone. On les reprend pour créer ou compléter la check-list d’un bateau ou d’une croisière.';

/** Props of {@link CkbasesHome}. */
interface CkbasesHomeProps {
  /** Opens a base. */
  onBase: (id: string) => void;
  /** Opens the editor of a list of a boat. */
  onBoatList: (boatId: string, list: string) => void;
  /** Draws the screen again. */
  onRedraw: () => void;
}

/**
 * Check-in lists of the boats, then the bases (legacy `VIEWS.ckbases`).
 * @param props - Navigation.
 * @returns The screen content.
 */
export function CkbasesHome({
  onBase,
  onBoatList,
  onRedraw,
}: CkbasesHomeProps) {
  const tr = useTr();
  useScreenLead('Check-lists');
  const [library] = useState(() => state.data.ckLib.value);
  const [boats] = useState(() => state.data.boats.value);
  const [category] = useState(() =>
    textOf(state.preferences.settings.value.ckBaseCat),
  );
  const categories = [...new Set(library.flatMap((base) => base.cats ?? []))];
  const shown = library.filter(
    (base) => !category || (base.cats ?? []).includes(category),
  );
  const chooseCategory = (chosen: string) => {
    buzz();
    updateSettings((settings) => {
      settings.ckBaseCat = chosen;
    });
    onRedraw();
  };
  return (
    <>
      {boats.length > 0 ? (
        <>
          <h1>{tr('Check-lists')}</h1>
          <h2 className="sub-h">{tr('Check-in des bateaux')}</h2>
          {boats.map((boat) => (
            <BoatLists key={boat.id} boat={boat} onBoatList={onBoatList} />
          ))}
          <h2 className="sub-h">{tr('Bases (modèles)')}</h2>
          <HelpText>{BASES_HELP}</HelpText>
        </>
      ) : (
        <PageTitle helps={[BASES_HELP]}>Check-lists</PageTitle>
      )}
      {categories.length > 1 ? (
        <div className="chips ck-cats">
          <Button
            choice
            className={category ? 'btn' : 'btn on'}
            data-bcat=""
            onClick={() => chooseCategory('')}
          >
            {tr('Toutes')}
          </Button>
          {categories.map((item) => (
            <Button
              key={item}
              choice
              className={item === category ? 'btn on' : 'btn'}
              data-bcat={item}
              onClick={() => chooseCategory(item)}
            >
              {tr(item)}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="checks">
        {shown.map((base) => (
          <SwipeRow
            key={base.id}
            id={base.id}
            name={base.name}
            onShare={(format) => openListPublish('ckbases', base.id, format)}
            onDelete={(id) => {
              updateCkLib((bases) => {
                const index = bases.findIndex((item) => item.id === id);
                if (index !== -1) bases.splice(index, 1);
              });
            }}
          >
            <BaseButton
              base={base}
              noCategory="sans catégorie"
              idAttribute="data-base"
              onClick={() => {
                buzz();
                onBase(base.id);
              }}
            />
          </SwipeRow>
        ))}
        {shown.length === 0 ? (
          <HelpText>
            Pas encore de base. Dans une check-list, touchez « Modifier la liste
            » puis « Enregistrer comme base », ou créez-en une ici.
          </HelpText>
        ) : null}
      </div>
      <ButtonRow className="row c2" style={{ marginTop: '12px' }}>
        <Button
          className="btn big primary"
          id="baseNew"
          onClick={() => {
            buzz();
            const id = uid();
            updateCkLib((bases) => {
              bases.push({
                id,
                name: 'Nouvelle base',
                cats: [],
                items: [],
                at: new Date().toISOString(),
              });
            });
            onBase(id);
          }}
        >
          {tr('＋ Nouvelle base')}
        </Button>
        {state.data.cruise.value ? (
          <Button
            className="btn big"
            data-go="checklist"
            onClick={() => {
              buzz();
              go('checklist');
            }}
          >
            {tr('✅ Check-lists')}
          </Button>
        ) : null}
      </ButtonRow>
      {shown.length > 0 ? <ListPublishRow kind="ckbases" /> : null}
    </>
  );
}
