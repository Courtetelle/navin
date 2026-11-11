import { Button } from '../../components/shared/Button.tsx';
import { HelpPill, HelpText } from '../../components/shared/HelpText.tsx';
import { helpBubbleText } from '../../components/shared/helpRules.ts';
import { checklistUi } from '../../features/checklists/checklistUi.ts';
import { useScreenLead } from '../../features/checklists/useScreenLead.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

import type { ChecklistModel } from './checklistModel.ts';

const PRESS_HELP =
  'Appui simple : orange, pas fait (valeur, photo). Appui long : vert, fait. Appui long sur un vert : remis à blanc.';

/** Props of {@link ChecklistTitle}. */
interface ChecklistTitleProps {
  model: ChecklistModel;
  /** Draws the screen again. */
  onRedraw: () => void;
}

/**
 * Title of the list: counter, name and the ✎ button. In the PréP flow the help
 * follows the title directly, so that its ⓘ moves into the `h1`.
 * @param props - Model and callback.
 * @returns The `h1`, and the help in the PréP flow.
 */
export function ChecklistTitle({ model, onRedraw }: ChecklistTitleProps) {
  const tr = useTr();
  const { inPrep, ownerId, boatName, items, doneCount, editing, leftCount } =
    model;
  const text = inPrep
    ? 'Check-in'
    : `Check-list${ownerId ? ` · ${boatName}` : ''}`;
  const lead = useScreenLead(
    `${countText(model)}${text}${editing ? '✔' : '✎'}`,
  );
  const leadHelp = inPrep && items.length > 0 && leftCount > 0;
  return (
    <>
      <h1>
        {items.length > 0 ? (
          <span
            className={doneCount === items.length ? 'ck-count all' : 'ck-count'}
          >
            {countText(model)}
          </span>
        ) : null}
        {tr(text)}
        <Button
          type="button"
          className={editing ? 'btn ck-editbtn on' : 'btn ck-editbtn'}
          data-ckedit="1"
          aria-label="Modifier la liste"
          onClick={() => {
            buzz();
            const next = !checklistUi.editing.value;
            checklistUi.editing.value = next;
            if (!next) toast('Liste enregistrée');
            onRedraw();
          }}
        >
          {editing ? '✔' : '✎'}
        </Button>
        {leadHelp ? (
          <HelpPill text={helpBubbleText(PRESS_HELP)} inTitle />
        ) : null}
      </h1>
      {leadHelp ? <PressHelp popped lead={lead} /> : null}
    </>
  );
}

function countText({ doneCount, items }: ChecklistModel): string {
  return items.length > 0 ? `${doneCount}/${items.length}` : '';
}

/** Props of {@link PressHelp}. */
interface PressHelpProps {
  /**
   * Its ⓘ is already in the title.
   * @default false
   */
  popped?: boolean;
  /**
   * Right under the title of a fresh screen.
   * @default false
   */
  lead?: boolean;
}

/**
 * The reminder of the three gestures.
 * @param props - Placement.
 * @returns The paragraph, with its ⓘ outside the title.
 */
export function PressHelp({ popped = false, lead = false }: PressHelpProps) {
  const tr = useTr();
  const content = (
    <>
      {tr('Appui simple : ', { help: true })}
      <b className="ck-red-t">{tr('orange', { help: true })}</b>
      {tr(', pas fait (valeur, photo). Appui long : ', { help: true })}
      <b className="ck-green-t">{tr('vert', { help: true })}</b>
      {tr(', fait. Appui long sur un vert : remis à blanc.', { help: true })}
    </>
  );
  if (!popped) return <HelpText text={PRESS_HELP}>{content}</HelpText>;
  return (
    <p className={lead ? 'help help-pop help-lead' : 'help help-pop'}>
      {content}
    </p>
  );
}
