import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpPill } from '../../components/shared/HelpText.tsx';
import { helpBubbleText, keepHelp } from '../../components/shared/helpRules.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import type { ChecklistSlot } from '../../model/modes.ts';

import { ckIcon } from './checklistEditing.ts';
import { useScreenLead } from './useScreenLead.ts';

/** Props of {@link EditTitle}. */
interface EditTitleProps {
  /** Mode and boat, under the title. */
  subtitle: string;
}

/**
 * Title of the list editor, followed by the mode and the boat. A long
 * subtitle moves behind an ⓘ inside the title, like the page helps.
 * @param props - Subtitle.
 * @returns The `h1` and the paragraph.
 */
export function EditTitle({ subtitle }: EditTitleProps) {
  const tr = useTr();
  const lead = useScreenLead('Modifier la check-list');
  const shown = tr(subtitle, { help: true });
  const popped = !keepHelp(subtitle);
  const classes = ['help'];
  if (popped) classes.push('help-pop');
  if (lead) classes.push('help-lead');
  return (
    <>
      <h1>
        {tr('Modifier la check-list')}
        {popped ? <HelpPill text={helpBubbleText(shown)} inTitle /> : null}
      </h1>
      <p className={classes.join(' ')} style={{ marginTop: '-8px' }}>
        {shown}
      </p>
    </>
  );
}

/** Props of {@link EditTabs}. */
interface EditTabsProps {
  /** Lists of the owner. */
  definitions: readonly ChecklistSlot[];
  /** List edited. */
  list: string;
  /** Edits another list. */
  onList: (list: string) => void;
  /** Opens the screen of a new list. */
  onNewList: () => void;
}

/**
 * Tabs of the lists of the owner in the editor, then `＋ Nouvelle liste`.
 * @param props - Lists and callbacks.
 * @returns The `.ck-tabs` row.
 */
export function EditTabs({
  definitions,
  list,
  onList,
  onNewList,
}: EditTabsProps) {
  const tr = useTr();
  return (
    <ButtonRow className="row c2 ck-tabs" choice>
      {definitions.map(([id, , label]) => (
        <Button
          key={id}
          choice
          className={id === list ? 'btn on' : 'btn'}
          data-elist={id}
          onClick={() => {
            buzz();
            onList(id);
          }}
        >
          {tr(`${ckIcon(id)} ${label}`)}
        </Button>
      ))}
      <Button
        choice
        className="btn"
        data-newlist="1"
        onClick={() => {
          buzz();
          onNewList();
        }}
      >
        {tr('＋ Nouvelle liste')}
      </Button>
    </ButtonRow>
  );
}
