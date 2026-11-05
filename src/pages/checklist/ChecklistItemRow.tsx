import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { ChecklistInput } from '../../features/checklists/ChecklistInput.tsx';
import { PhotoStrip } from '../../features/checklists/neighbours.ts';
import { useTr } from '../../i18n/useTr.ts';
import { textOf } from '../../lib/format.ts';
import { RELEVES } from '../../model/checklistSeeds.ts';
import type { Day } from '../../model/types.ts';
import { toast } from '../../state/index.ts';

import type { ChecklistRow } from './checklistModel.ts';

/** Callbacks of a checklist item. */
export interface ChecklistItemActions {
  /** Short tap on the item. */
  onTap: (row: ChecklistRow) => void;
  /** The finger is down on the item. */
  onPress: (row: ChecklistRow) => void;
  /** Value typed in an orange item. */
  onValue: (row: ChecklistRow, value: string) => void;
  /** Reading typed in the readings grid of an item. */
  onReading: (key: string, value: string) => void;
  /** The `📷 + photo` button of an item. */
  onAddPhoto: (id: string) => void;
  /** A photo is deleted. */
  onRemovePhoto: (id: string) => void;
  /** The `📸 Ouvrir la fiche à envoyer` button. */
  onSheet: () => void;
}

/** Props of {@link ChecklistItemRow}. */
export interface ChecklistItemRowProps extends ChecklistItemActions {
  row: ChecklistRow;
  /** The finger is down on this item. */
  holding: boolean;
  /** Today's sheet, for the readings grid. */
  today: Day;
}

/**
 * One item of the list: its button, the side action, the panel of an orange
 * item and the photos of a green one.
 * @param props - Line and callbacks.
 * @returns The `.ck-wrap` block.
 */
export function ChecklistItemRow({
  row,
  holding,
  today,
  onTap,
  onPress,
  onValue,
  onReading,
  onAddPhoto,
  onRemovePhoto,
  onSheet,
}: ChecklistItemRowProps) {
  const tr = useTr();
  const { item, state, label, photos, showPhotos } = row;
  const classes = ['btn', 'ck-item'];
  if (state) classes.push(state);
  if (holding) classes.push('holding');
  let box = '';
  if (state === 'done') box = '✔';
  else if (state === 'red') box = '✕';
  return (
    <div className={state ? `ck-wrap ${state}` : 'ck-wrap'} data-id={item.id}>
      <Button
        className={classes.join(' ')}
        data-undo={state === 'done' ? item.id : undefined}
        data-tap={state === 'done' ? undefined : item.id}
        onClick={() => onTap(row)}
        onPointerDown={() => onPress(row)}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className="box">{box}</span>
        <span>
          {tr(label)}
          {item.note ? (
            <small className="ck-note">{tr(item.note)}</small>
          ) : null}
          {photos.length > 0 ? (
            <small className="ck-phn">{`📷 ${photos.length}`}</small>
          ) : null}
        </span>
      </Button>
      {item.action === 'sheet' ? (
        <Button
          className="btn primary ck-side"
          data-sheet="1"
          onClick={onSheet}
        >
          {tr('📸 Ouvrir la fiche à envoyer')}
        </Button>
      ) : null}
      {state === 'red' ? (
        <ItemPanel
          row={row}
          today={today}
          onValue={onValue}
          onReading={onReading}
          onAddPhoto={onAddPhoto}
          onRemovePhoto={onRemovePhoto}
        />
      ) : null}
      {state === 'done' && showPhotos ? (
        <div className="ck-panel ck-ph-view">
          <PhotoStrip photos={photos} onRemove={onRemovePhoto} />
          <PhotoButton id={item.id} onAddPhoto={onAddPhoto} />
        </div>
      ) : null}
    </div>
  );
}

type ItemPanelProps = Pick<
  ChecklistItemRowProps,
  'row' | 'today' | 'onValue' | 'onReading' | 'onAddPhoto' | 'onRemovePhoto'
>;

function ItemPanel({
  row,
  today,
  onValue,
  onReading,
  onAddPhoto,
  onRemovePhoto,
}: ItemPanelProps) {
  const tr = useTr();
  const { item, value, photos } = row;
  return (
    <div className="ck-panel">
      {item.unit ? (
        <label className="rel">
          <span>{tr('Valeur')}</span>
          <span className="rel-in">
            <ChecklistInput
              className="text"
              type="text"
              inputMode="decimal"
              data-val={item.id}
              defaultValue={value}
              onChange={(event) => onValue(row, event.target.value.trim())}
              onCommit={remindLongPress}
            />
            <em>{item.unit === 'nb' ? '' : tr(item.unit)}</em>
          </span>
        </label>
      ) : null}
      {item.action === 'releves' ? (
        <div className="rel-grid">
          {RELEVES.map(([key, label, unit]) => (
            <label className="rel" key={key}>
              <span>{tr(label)}</span>
              <span className="rel-in">
                <ChecklistInput
                  className="text"
                  type="text"
                  inputMode="decimal"
                  data-rel={key}
                  defaultValue={textOf(today[key])}
                  onChange={(event) =>
                    onReading(key, event.target.value.trim())
                  }
                  onCommit={remindLongPress}
                />
                <em>{tr(unit)}</em>
              </span>
            </label>
          ))}
        </div>
      ) : null}
      <PhotoStrip photos={photos} onRemove={onRemovePhoto} />
      <PhotoButton id={item.id} onAddPhoto={onAddPhoto} />
      <HelpText>Appui long sur le point : vert (fait).</HelpText>
    </div>
  );
}

function remindLongPress(field: HTMLInputElement): void {
  if (field.value.trim()) {
    toast('Appui long sur le point pour valider la valeur (vert)');
  }
}

function PhotoButton({
  id,
  onAddPhoto,
}: Pick<ChecklistItemActions, 'onAddPhoto'> & { id: string }) {
  const tr = useTr();
  return (
    <ButtonRow>
      <Button className="btn" data-iphoto={id} onClick={() => onAddPhoto(id)}>
        {tr('📷 + photo')}
        <small>{tr('photothèque, fichier ou appareil photo')}</small>
      </Button>
    </ButtonRow>
  );
}
