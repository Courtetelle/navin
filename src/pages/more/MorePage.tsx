import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { MenuSortButton } from '../../components/shared/MenuSortButton.tsx';
import { TitleInNav } from '../../components/shared/TitleInNav.tsx';
import { bumpTile, inMenuOrder } from '../../features/data/dataOrder.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { state } from '../../state/index.ts';

import { tilesWithCruise, tilesWithoutCruise } from './moreTiles.ts';

/**
 * Screen `more` (legacy `VIEWS.more`): the data menu, one tile per section,
 * in alphabetical order or in the order of their use (each opening moves a
 * tile one rank up), as chosen at the right of the title.
 * @returns The tiles.
 */
export function MorePage() {
  useSignals();
  const tr = useTr();
  const all = state.data.cruise.value
    ? tilesWithCruise()
    : tilesWithoutCruise();
  // Alphabetical (in the language shown), or by their use: the button at
  // the right of the title chooses.
  const tiles = inMenuOrder(
    'data',
    all,
    (tile) => tile.key,
    (tile) => tr(tile.title),
  );
  const shown = tiles.map((tile) => tile.key);
  return (
    <>
      <TitleInNav>
        <h1 className="menu-title">
          {tr('Données')}
          <MenuSortButton menu="data" />
        </h1>
      </TitleInNav>
      <div className="row more-grid data-tiles">
        {tiles.map((tile) => (
          <Button
            key={tile.key}
            className="btn big"
            data-go={tile.key}
            data-tile={tile.key}
            onClick={() => {
              bumpTile(shown, tile.key);
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
