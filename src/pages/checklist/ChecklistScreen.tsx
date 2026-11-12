import { useEffect, useState } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { checklistUi } from '../../features/checklists/checklistUi.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { go } from '../../shell/router.ts';

import { AllDone } from './AllDone.tsx';
import { ChecklistFilters } from './ChecklistFilters.tsx';
import { ChecklistItems } from './ChecklistItems.tsx';
import { ChecklistQuickEdit } from './ChecklistQuickEdit.tsx';
import { ChecklistTitle, PressHelp } from './ChecklistTitle.tsx';
import { CopyCheckIn } from './CopyCheckIn.tsx';
import { ObservationsBox } from './ObservationsBox.tsx';
import { PrepCloseButton } from './PrepCloseButton.tsx';
import { checklistModel } from './checklistModel.ts';
import type { ChecklistNavigation } from './screenActions.ts';
import {
  addPhotoAndRedraw,
  centerField,
  publishChecklist,
  resetList,
  saveObservationText,
  warmReport,
} from './screenActions.ts';

/** Props of {@link ChecklistScreen}. */
interface ChecklistScreenProps {
  /** Draws this or another screen of the page. */
  navigation: ChecklistNavigation;
  /** Selector of a field to centre once drawn. */
  centerOn: string | null;
}

/**
 * The list being done: filters, tabs, items, observations and management
 * buttons (legacy `VIEWS.checklist`). It shows what it read when drawn: a value
 * typed reaches the labels at the next redraw.
 * @param props - Navigation and field to centre.
 * @returns The screen content.
 */
export function ChecklistScreen({
  navigation,
  centerOn,
}: ChecklistScreenProps) {
  const tr = useTr();
  const [model] = useState(checklistModel);
  const {
    inPrep,
    items,
    list,
    listName,
    builtin,
    leftCount,
    editing,
    lake,
    quitName,
    canReset,
  } = model;
  const { redraw, showList, showEdit, showNew, removePhoto } = navigation;
  useNavFields(hasFields(model));
  useEffect(() => warmReport(list), [list]);
  useEffect(() => centerField(centerOn), [centerOn]);
  const allDone = items.length > 0 && leftCount === 0;
  return (
    <>
      <ChecklistTitle model={model} onRedraw={redraw} />
      {inPrep ? null : <ChecklistFilters model={model} onList={showList} />}
      {items.length > 0 && leftCount > 0 && !inPrep ? <PressHelp /> : null}
      {items.length === 0 ? (
        <div className="empty-state">
          {tr('Pas encore de point dans cette liste.')}
          <br />
          <br />
          {tr('Touchez « Modifier la liste ».')}
        </div>
      ) : null}
      {editing ? (
        <ChecklistQuickEdit
          model={model}
          onRedraw={redraw}
          onAdded={() => redraw('#ckEdNew')}
        />
      ) : null}
      <ChecklistItems model={model} navigation={navigation} />
      {allDone && !(inPrep && list === 'dep') ? (
        <AllDone
          name={listName}
          list={builtin ? list : null}
          inPrep={inPrep}
          lake={lake}
          quitName={quitName}
          onList={showList}
        />
      ) : null}
      {builtin ? (
        <ObservationsBox
          model={model}
          onToggle={() => {
            buzz();
            const open = !checklistUi.observationsOpen.value;
            checklistUi.observationsOpen.value = open;
            redraw(open ? '#constat' : null);
          }}
          onInput={(value) => saveObservationText(list, value)}
          onAddPhoto={() => {
            buzz();
            addPhotoAndRedraw(list, redraw);
          }}
          onRemovePhoto={removePhoto}
        />
      ) : null}
      {inPrep && list === 'dep' ? <PrepCloseButton /> : null}
      {builtin && list === 'dep' ? (
        <CopyCheckIn onCopied={() => redraw()} />
      ) : null}
      {list === 'dep' ? (
        <ButtonRow className="row ck-pub-row">
          <Button
            className="btn big ck-pub"
            id="prepPub"
            onClick={() => {
              buzz();
              publishChecklist();
            }}
          >
            {tr('📤 Publier')}
            <small>{tr('rapport PréP + check-in, image ou PDF')}</small>
          </Button>
        </ButtonRow>
      ) : null}
      {inPrep ? null : (
        <>
          <ButtonRow className="row c2" style={{ marginTop: '16px' }}>
            <Button
              className="btn"
              data-edit="1"
              onClick={() => {
                buzz();
                showEdit();
              }}
            >
              {tr('✎ Modifier la liste')}
            </Button>
            <ArmedButton
              className="btn"
              data-reset="1"
              disabled={!canReset}
              armedLabel={tr('Toucher encore : recommencer')}
              onClick={() => buzz()}
              onConfirm={() => {
                resetList(list, items);
                redraw();
              }}
            >
              {tr('↺ Recommencer cette liste')}
            </ArmedButton>
          </ButtonRow>
          <ButtonRow className="row c2">
            <Button
              className="btn"
              data-newlist="1"
              onClick={() => {
                buzz();
                showNew();
              }}
            >
              {tr('＋ Nouvelle liste')}
            </Button>
            <Button
              className="btn"
              data-bases="1"
              onClick={() => {
                buzz();
                go('ckbases');
              }}
            >
              {tr('📚 Mes bases')}
            </Button>
          </ButtonRow>
        </>
      )}
    </>
  );
}

function hasFields(model: ReturnType<typeof checklistModel>): boolean {
  if (model.editing || (model.builtin && model.observationsOpen)) return true;
  return model.rows.some(
    (row) =>
      row.state === 'red' && (row.item.unit || row.item.action === 'releves'),
  );
}
