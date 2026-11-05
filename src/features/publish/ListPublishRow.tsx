import type { ReactElement } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

import { listHasContent } from './listKinds.ts';
import { openListPublish } from './publishWindow.ts';
import type { ListKind } from './types.ts';

/** Props of {@link ListPublishRow}. */
export interface ListPublishRowProps {
  /** The list shown by the page. */
  kind: Exclude<ListKind, 'boats'>;
}

/**
 * The « 📤 Publier » row at the bottom of a data list. Renders nothing when
 * the list has nothing to publish.
 * @param props - List kind.
 * @returns The row or null.
 */
export function ListPublishRow({
  kind,
}: ListPublishRowProps): ReactElement | null {
  const tr = useTr();
  if (!listHasContent(kind)) return null;
  return (
    <ButtonRow className="row ck-pub-row lx-pub no-print">
      <Button
        type="button"
        className="btn big ck-pub"
        onClick={() => {
          buzz();
          openListPublish(kind);
        }}
      >
        {tr('📤 Publier')}
        <small>{tr('image ou PDF')}</small>
      </Button>
    </ButtonRow>
  );
}
