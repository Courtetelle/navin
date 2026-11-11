import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { PhotoStrip } from '../../features/checklists/neighbours.ts';
import { useTr } from '../../i18n/useTr.ts';

import type { ChecklistModel } from './checklistModel.ts';

/** Props of {@link ObservationsBox}. */
interface ObservationsBoxProps {
  model: ChecklistModel;
  /** The Observations button. */
  onToggle: () => void;
  /** Text typed. */
  onInput: (value: string) => void;
  /** The `📷 + photo` button. */
  onAddPhoto: () => void;
  /** A photo is deleted. */
  onRemovePhoto: (id: string) => void;
}

/**
 * The Observations button at the end of a built-in list, with its text and its
 * photos when open.
 * @param props - Model and callbacks.
 * @returns The `.ck-obs-box` block.
 */
export function ObservationsBox({
  model,
  onToggle,
  onInput,
  onAddPhoto,
  onRemovePhoto,
}: ObservationsBoxProps) {
  const tr = useTr();
  const { observation, observationPhotos, observationsOpen } = model;
  const preview =
    observation.length > 70 ? `${observation.slice(0, 70)}…` : observation;
  return (
    <div className="ck-obs-box">
      <div className="ck-wrap">
        <Button
          className={
            observationsOpen
              ? 'btn ck-item ck-obs-btn open'
              : 'btn ck-item ck-obs-btn'
          }
          data-obs="1"
          onClick={onToggle}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span className="box">📝</span>
          <span>
            {tr('Observations')}
            {observation ? <small className="ck-note">{preview}</small> : null}
            {observationPhotos.length > 0 ? (
              <small className="ck-phn">{`📷 ${observationPhotos.length}`}</small>
            ) : null}
          </span>
        </Button>
        {observationsOpen ? (
          <div className="ck-panel">
            <textarea
              className="text"
              id="constat"
              rows={4}
              placeholder={tr.placeholder(
                'Écrire, ou toucher le micro du clavier pour dicter…',
              )}
              defaultValue={observation}
              onChange={(event) => onInput(event.target.value)}
            />
            <PhotoStrip photos={observationPhotos} onRemove={onRemovePhoto} />
            <ButtonRow>
              <Button className="btn" data-photo-add="1" onClick={onAddPhoto}>
                {tr('📷 + photo')}
                <small>{tr('photothèque, fichier ou appareil photo')}</small>
              </Button>
            </ButtonRow>
          </div>
        ) : null}
      </div>
    </div>
  );
}
