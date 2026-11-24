import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { voyageTiles } from '../../features/voyages/voyageTiles.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';

/**
 * Screen `voyages` (data › Croisières): a menu of its own, built like data,
 * one tile per section.
 * @returns The tiles.
 */
export function VoyagesPage() {
  useSignals();
  const tr = useTr();
  return (
    <>
      <PageBack
        label="◀ data"
        data-go="more"
        onClick={() => {
          buzz();
          go('more');
        }}
      >
        {tr('◀ data')}
      </PageBack>
      <PageTitle
        helps={[
          'Tout ce qu’il faut pour une croisière en location : l’équipage, les contrats de l’agence, du loueur et des assurances avec leurs contacts, et les documents (PDF, photos). Tout part dans les sauvegardes.',
        ]}
      >
        ⛵ Croisières
      </PageTitle>
      <div className="row more-grid data-tiles">
        {voyageTiles().map((tile) => (
          <Button
            key={tile.key}
            className="btn big"
            data-go={tile.key}
            data-tile={tile.key}
            onClick={() => {
              buzz();
              go(tile.key);
            }}
          >
            {tr(tile.title)}
            <small>{tr(tile.sub)}</small>
          </Button>
        ))}
      </div>
    </>
  );
}
