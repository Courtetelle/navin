import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { ckIcon } from '../../features/checklists/checklistEditing.ts';
import { ckCats, ckDefs } from '../../features/checklists/checklistOwner.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { updateSettings } from '../../state/index.ts';

import type { ChecklistModel } from './checklistModel.ts';

/** Props of {@link ChecklistFilters}. */
export interface ChecklistFiltersProps {
  model: ChecklistModel;
  /** Shows a list. */
  onList: (list: string) => void;
}

/**
 * Category chips, list tabs and the categories of the list shown.
 * @param props - Model and callback.
 * @returns The three blocks.
 */
export function ChecklistFilters({ model, onList }: ChecklistFiltersProps) {
  const tr = useTr();
  const { categories, category, tabs, list, listCategories } = model;
  const choose = (chosen: string) => {
    buzz();
    updateSettings((settings) => {
      settings.ckCat = chosen;
    });
    const first = ckDefs().find(
      ([id]) => !chosen || ckCats(id).includes(chosen),
    );
    onList(first ? first[0] : list);
  };
  return (
    <>
      {categories.length > 1 ? (
        <div className="chips ck-cats">
          <Button
            choice
            className={category ? 'btn' : 'btn on'}
            data-cat=""
            onClick={() => choose('')}
          >
            {tr('Toutes')}
          </Button>
          {categories.map((item) => (
            <Button
              key={item}
              choice
              className={item === category ? 'btn on' : 'btn'}
              data-cat={item}
              onClick={() => choose(item)}
            >
              {tr(item)}
            </Button>
          ))}
        </div>
      ) : null}
      <ButtonRow className="row c2 ck-tabs" choice>
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            choice
            className={tab.id === list ? 'btn on' : 'btn'}
            data-list={tab.id}
            onClick={() => {
              buzz();
              onList(tab.id);
            }}
          >
            {tr(`${ckIcon(tab.id)} ${tab.name}`)}
            <small>{tr(tab.status)}</small>
          </Button>
        ))}
      </ButtonRow>
      <HelpText className="ck-catline" text={listCategories.join(' ')}>
        {listCategories.flatMap((item, index) => [
          index > 0 ? ' ' : null,
          <span className="ck-tag" key={item}>
            {tr(item, { help: true })}
          </span>,
        ])}
      </HelpText>
    </>
  );
}
