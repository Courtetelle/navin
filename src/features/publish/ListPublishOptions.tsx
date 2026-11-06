import type { ReactElement } from 'react';

import { MasterCheck } from '../../components/shared/MasterCheck.tsx';

import { CheckButton } from './CheckButton.tsx';
import {
  toggleAllItems,
  toggleItem,
  togglePhoto,
  toggleSection,
} from './listChoiceActions.ts';
import { ITEM_LABELS } from './listKinds.ts';
import type { ListChoice, ListKind, PublishItem } from './types.ts';

/** Props of the option blocks of the Publier window. */
export interface ListOptionProps {
  /** The list. */
  kind: ListKind;
  /** Its elements. */
  items: readonly PublishItem[];
  /** What is switched off. */
  choice: ListChoice;
}

/**
 * Photo switches of a list: round face or boat thumbnail, full photos.
 * @param props - List, elements and choice.
 * @returns The switches, or null when no element has a photo.
 */
export function PhotoOptions({
  kind,
  items,
  choice,
}: ListOptionProps): ReactElement | null {
  if (!items.some((item) => (item.photos ?? []).length > 0)) return null;
  const withFace = items.some((item) => item.face);
  const rectangle = items.some((item) => item.faceRect);
  const faceOn = !choice.offSec.includes('§face');
  const photosOn = !choice.offSec.includes('§photos');
  return (
    <>
      {withFace ? (
        <CheckButton
          on={faceOn}
          extraClass="lx-phall"
          data-lxs="§face"
          onClick={() => {
            toggleSection(kind, '§face');
          }}
        >
          {rectangle ? '🖼 Vignette du bateau' : '🙂 Vignette du visage'}
          <small>
            {rectangle
              ? 'photo rectangulaire, à côté du nom'
              : 'ronde, à côté du nom'}
          </small>
        </CheckButton>
      ) : null}
      <CheckButton
        on={photosOn}
        extraClass="lx-phall"
        data-lxs="§photos"
        onClick={() => {
          toggleSection(kind, '§photos');
        }}
      >
        {withFace ? (
          <>
            🖼 Photos complètes<small>en grand, sous la fiche</small>
          </>
        ) : (
          'Inclure les photos'
        )}
      </CheckButton>
    </>
  );
}

/**
 * Elements to print, with their master box.
 * @param props - List, elements and choice.
 * @returns The block, or null for a single element.
 */
export function ItemChecks({
  kind,
  items,
  choice,
}: ListOptionProps): ReactElement | null {
  if (items.length < 2) return null;
  const off = new Set(choice.off);
  const checked = items.filter((item) => !off.has(item.id)).length;
  return (
    <>
      <p className="help lx-sec-h">
        {`${ITEM_LABELS[kind]} à imprimer (${checked} / ${items.length})`}
      </p>
      <div className="checks">
        <MasterCheck
          checked={checked}
          total={items.length}
          attribute="data-lxall"
          onClick={() => {
            toggleAllItems(
              kind,
              items.map((item) => item.id),
            );
          }}
        />
        {items.map((item) => (
          <CheckButton
            key={item.id}
            on={!off.has(item.id)}
            data-lxi={item.id}
            onClick={() => {
              toggleItem(kind, item.id);
            }}
          >
            {item.name}
          </CheckButton>
        ))}
      </div>
    </>
  );
}

/**
 * Photos to include, one by one, from two photos up.
 * @param props - List, elements and choice.
 * @returns The block or null.
 */
export function PhotoChecks({
  kind,
  items,
  choice,
}: ListOptionProps): ReactElement | null {
  const off = new Set(choice.off);
  const photos = items
    .filter((item) => !off.has(item.id))
    .flatMap((item) =>
      (item.photos ?? []).map((photo) => ({ ...photo, who: item.name })),
    );
  if (photos.length < 2 || choice.offSec.includes('§photos')) return null;
  const offPhotos = new Set(choice.offPh);
  const checked = photos.filter((photo) => !offPhotos.has(photo.id)).length;
  return (
    <>
      <p className="help lx-sec-h">
        {`Photos à inclure (${checked} / ${photos.length})`}
      </p>
      <div className="checks lx-ph-list">
        {photos.map((photo) => (
          <CheckButton
            key={photo.id}
            on={!offPhotos.has(photo.id)}
            data-lxp={photo.id}
            onClick={() => {
              togglePhoto(kind, photo.id);
            }}
          >
            {(items.length > 1 ? `${photo.who} · ` : '') + photo.cap}
          </CheckButton>
        ))}
      </div>
    </>
  );
}
