import { useSignals } from '@preact/signals-react/runtime';
import { createPortal } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate, fmtTime } from '../../lib/format.ts';
import { deliver, state } from '../../state/index.ts';
import { PHOTO_CTX } from '../../storage/photos.ts';

import type { PhotoViewItem } from './photoViewer.ts';
import { photoView } from './photoViewer.ts';
import type { CruisePhoto } from './photos.ts';

/**
 * Full-screen photo with the previous and next ones of its series (legacy
 * `openPhoto`).
 * @returns The `.photo-view` portal, or nothing when closed.
 */
export function PhotoView() {
  useSignals();
  const view = photoView.value;
  const item = view?.items[view.index];
  if (!view || !item) return null;
  const count = view.items.length;
  const move = (step: number) => {
    buzz();
    photoView.value = {
      ...view,
      index: (view.index + step + count) % count,
    };
  };
  return createPortal(
    <div className="photo-view">
      <img src={item.src} alt="Photo" />
      <p>
        {caption(item)}
        {count > 1 ? ` · ${view.index + 1} / ${count}` : ''}
      </p>
      <div className={count > 1 ? 'row c4' : 'row c2'}>
        {count > 1 ? (
          <Button
            className="btn big"
            data-pv="-1"
            aria-label="Précédente"
            noUiEdit
            onClick={() => move(-1)}
          >
            ◀
          </Button>
        ) : null}
        <Button
          className="btn big"
          data-pshare="1"
          aria-label="Partager"
          noUiEdit
          onClick={() => {
            buzz();
            void sharePhoto(item);
          }}
        >
          📤
        </Button>
        <Button
          className="btn big primary"
          data-pclose="1"
          noUiEdit
          onClick={() => {
            buzz();
            photoView.value = null;
          }}
        >
          ✕
        </Button>
        {count > 1 ? (
          <Button
            className="btn big"
            data-pv="1"
            aria-label="Suivante"
            noUiEdit
            onClick={() => move(1)}
          >
            ▶
          </Button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function caption(item: PhotoViewItem): string {
  const photos = (state.data.cruise.value?.photos ?? []) as CruisePhoto[];
  const photo = photos.find((candidate) => candidate.id === item.id);
  if (!photo) return item.caption;
  const time = new Date(photo.t);
  const moment = PHOTO_CTX[photo.ctx] ?? '📷';
  return `${moment} · ${fmtShortDate(time)} à ${fmtTime(time)}`;
}

async function sharePhoto(item: PhotoViewItem): Promise<void> {
  const reply = await fetch(item.src);
  if (!reply.ok) return;
  await deliver(await reply.blob(), `photo-${item.id}.jpg`, 'image/jpeg');
}
