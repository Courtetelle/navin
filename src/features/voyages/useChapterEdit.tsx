import type { ReactNode } from 'react';
import { useState } from 'react';

import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PageValidate } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { useNavEdit } from '../../shell/navbar/useNavEdit.ts';
import { toast } from '../../state/index.ts';

/**
 * A chapter of a cruise is read until the pencil at the top is touched:
 * then every part of it changes, until the green ✔.
 * @returns Whether it is being changed, and the ✔ to put in the page.
 */
export function useChapterEdit(): { editing: boolean; validate: ReactNode } {
  const tr = useTr();
  useNavFields();
  const [reading, setReading] = useState(true);
  useNavEdit(reading, () => setReading(false));
  const validate = reading ? null : (
    <PageValidate
      label="Valider"
      onClick={() => {
        buzz();
        setReading(true);
        toast('Modifications enregistrées');
      }}
      hidden
    >
      {tr('Valider')}
    </PageValidate>
  );
  return { editing: !reading, validate };
}
