import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import {
  bumpTile,
  dataOrder,
  sortTiles,
} from '../../features/data/dataOrder.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { state } from '../../state/index.ts';

import { tilesWithCruise, tilesWithoutCruise } from './moreTiles.ts';

/**
 * Screen `more` (legacy `VIEWS.more`): the data menu, one tile per section; the
 * order follows their use, each opening moves a tile one rank up.
 * @returns The tiles.
 */
export function MorePage() {
  useSignals();
  const tr = useTr();
  const tiles = sortTiles(
    state.data.cruise.value ? tilesWithCruise() : tilesWithoutCruise(),
    dataOrder.value,
  );
  const shown = tiles.map((tile) => tile.key);
  return (
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
  );
}
