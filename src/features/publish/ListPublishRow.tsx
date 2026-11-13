import type { ReactElement } from 'react';

import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';

import { listHasContent } from './listKinds.ts';
import { openListPublish } from './publishWindow.ts';
import type { ListKind } from './types.ts';

/** Props of {@link ListPublishRow}. */
export interface ListPublishRowProps {
  /** The list shown by the page. */
  kind: Exclude<ListKind, 'boats'>;
}

/**
 * The « 📤 Partager » row at the bottom of a data list. Renders nothing when
 * the list has nothing to publish.
 * @param props - List kind.
 * @returns The row or null.
 */
export function ListPublishRow({
  kind,
}: ListPublishRowProps): ReactElement | null {
  if (!listHasContent(kind)) return null;
  return (
    <ButtonRow className="row ck-pub-row lx-pub no-print">
      <ShareButton
        data-lxpub={kind}
        onShare={(format) => openListPublish(kind, undefined, format)}
      />
    </ButtonRow>
  );
}
