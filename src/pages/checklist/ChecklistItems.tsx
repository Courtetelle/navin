import {
  markItemDone,
  markItemOpen,
  markItemTodo,
  saveCkVal,
  saveReading,
} from '../../features/checklists/checklistActions.ts';
import { toggleShownPhotos } from '../../features/checklists/checklistUi.ts';
import { photosFor, takePhoto } from '../../features/checklists/neighbours.ts';
import { buzz } from '../../lib/dom.ts';
import { dayKey } from '../../lib/format.ts';
import { go } from '../../shell/router.ts';
import { toast } from '../../state/index.ts';

import { ChecklistItemRow } from './ChecklistItemRow.tsx';
import type { ChecklistModel, ChecklistRow } from './checklistModel.ts';
import type { ChecklistNavigation } from './screenActions.ts';
import { isHoldClick, useItemHold } from './useItemHold.ts';

/** Props of {@link ChecklistItems}. */
interface ChecklistItemsProps {
  model: ChecklistModel;
  /** Draws this or another screen of the page. */
  navigation: ChecklistNavigation;
}

/**
 * The items and their gestures: short tap on white = orange, long press =
 * green, long press on green = white; each item keeps its place.
 * @param props - Model and navigation.
 * @returns The `.ck-list` block.
 */
export function ChecklistItems({ model, navigation }: ChecklistItemsProps) {
  const { list, rows, today, editing } = model;
  const { redraw, askPhoto, removePhoto } = navigation;
  const hold = useItemHold();
  const onTap = (row: ChecklistRow) => {
    if (isHoldClick()) return;
    buzz();
    const { id } = row.item;
    if (row.state === 'done') {
      if (!photosFor(list).some((photo) => photo.item === id)) {
        toast(
          'Point fait · pas de photo · appui long pour le remettre à faire',
        );
        return;
      }
      toggleShownPhotos(id);
      redraw();
      return;
    }
    if (row.state === 'red') {
      toast('Appui long pour le passer en vert (fait)');
      return;
    }
    markItemOpen(id);
    redraw();
  };
  const onPress = ({ item, state }: ChecklistRow) => {
    hold.start(item.id, () => {
      if (state !== 'done') {
        markItemDone(item.id);
        redraw();
        return;
      }
      markItemTodo(item.id);
      toast('Point remis à faire');
      redraw();
      askPhoto(item.id);
    });
  };
  return (
    <div className="ck-list" hidden={editing}>
      {rows.map((row) => (
        <ChecklistItemRow
          key={row.item.id}
          row={row}
          holding={hold.holdingId === row.item.id}
          today={today}
          onTap={onTap}
          onPress={onPress}
          onValue={(line, value) => saveCkVal(line.item, value)}
          onReading={saveReading}
          onAddPhoto={(id) => {
            buzz();
            takePhoto(list, () => redraw(), id);
          }}
          onRemovePhoto={removePhoto}
          onSheet={() => {
            buzz();
            go('sheet', dayKey(new Date()));
          }}
        />
      ))}
    </div>
  );
}
