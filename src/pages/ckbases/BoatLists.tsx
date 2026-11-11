import { Button } from '../../components/shared/Button.tsx';
import type { ChecklistOwnerRecord } from '../../features/checklists/checklistOwner.ts';
import {
  ckCats,
  ckDefs,
  ckName,
  ckProp,
  ownerItems,
} from '../../features/checklists/checklistOwner.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { uid } from '../../lib/format.ts';
import type { Boat } from '../../model/types.ts';
import { toast, updateBoat } from '../../state/index.ts';

/** Props of {@link BoatLists}. */
interface BoatListsProps {
  boat: Boat;
  /** Opens the editor of a list of the boat. */
  onBoatList: (boatId: string, list: string) => void;
}

/**
 * The check-in lists of a boat, to open, duplicate or add to.
 * @param props - Boat and navigation.
 * @returns The `.ck-boat` section.
 */
export function BoatLists({ boat, onBoatList }: BoatListsProps) {
  const tr = useTr();
  const owner: ChecklistOwnerRecord = boat;
  const lists = ckDefs('lacj', owner).filter(([id]) =>
    ckCats(id, 'lacj', owner).includes('Check-in'),
  );
  return (
    <section className="ck-boat">
      <h3>{tr(`🚤 ${boat.info.boat || 'Bateau'}`)}</h3>
      {lists.map(([id, property, name]) => (
        <div className="ck-bl" key={id}>
          <Button
            className="btn ck-bl-open"
            data-bedit={boat.id}
            data-l={id}
            onClick={() => {
              buzz();
              onBoatList(boat.id, id);
            }}
          >
            {tr(`✅ ${name}`)}
            <small>
              {tr(
                `${ownerItems(owner, property).length} points · ${ckCats(id, 'lacj', owner).join(', ')}`,
              )}
            </small>
          </Button>
          <Button
            className="btn ck-bl-dup"
            data-bdup={boat.id}
            data-l={id}
            aria-label="Dupliquer"
            onClick={() => {
              buzz();
              onBoatList(boat.id, addBoatList(boat, id));
            }}
          >
            {tr('⧉ Dupliquer')}
          </Button>
        </div>
      ))}
      <Button
        className="btn big primary ck-bl-add"
        data-bnew={boat.id}
        onClick={() => {
          buzz();
          onBoatList(boat.id, addBoatList(boat, null));
        }}
      >
        {tr('＋ Nouvelle liste de check-in')}
      </Button>
    </section>
  );
}

function addBoatList(boat: Boat, source: string | null): string {
  const owner: ChecklistOwnerRecord = boat;
  const id = uid();
  const name = source
    ? `${ckName(source, 'lacj', owner)} (copie)`
    : 'Nouveau check-in';
  const categories = source
    ? [...new Set(['Check-in', ...ckCats(source, 'lacj', owner)])]
    : ['Check-in'];
  const items = source
    ? ownerItems(owner, ckProp(source, 'lacj', owner)).map((item) => ({
        ...item,
        id: uid(),
      }))
    : [];
  updateBoat(boat.id, (draft) => {
    draft.ckLists ??= [];
    draft.ckLists.push({ id, name, cats: categories });
    draft[`ckx_${id}`] = items;
  });
  toast(
    source ? `Liste « ${name} » créée` : 'Nouvelle liste de check-in créée',
  );
  return id;
}
