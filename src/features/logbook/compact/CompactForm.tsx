import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';

import { useSheetTranslation, useTr } from '../../../i18n/useTr.ts';
import { keyedItems } from '../../../lib/keyedItems.ts';
import type { FieldData, FieldDefinition } from '../../../model/field.ts';
import { flatFields } from '../../../model/field.ts';
import { WATERS_SEA_ONLY } from '../../../model/techFields.ts';
import { navigation } from '../../../shell/router.ts';
import { state } from '../../../state/index.ts';

import { Grid } from './CompactGrid.tsx';
import type { CompactFormContext } from './compactContext.ts';
import { CompactFormProvider } from './compactContext.ts';
import type { CompactFormProps } from './compactTypes.ts';
import {
  applyFieldChange,
  drawnSections,
  gridItems,
  isFilled,
} from './fieldChange.ts';
import type { FieldIds } from './fieldIds.ts';
import { drawnForm, markReleased } from './fieldIds.ts';
import { FormStore } from './formStore.ts';

/**
 * Compact form with automatic save (legacy `compactForm`), used by the day
 * sheet, the boat sheets, the cruise information and the member cards. Renders
 * the `details.section` blocks (or one `.cgrid` when flat), without a wrapper:
 * the page provides the legacy container (`#dayForm`, `#infoForm`…). Remount it
 * with a React `key` to redraw it from scratch.
 * @param props - Sections, values, change callback and options.
 * @returns The sections.
 */
export function CompactForm({
  sections,
  data,
  onChange,
  flat = false,
  cellStyle,
  afterCell,
  followKeys,
  formKey,
}: CompactFormProps) {
  useSignals();
  useSheetTranslation();
  const tr = useTr();
  const settings = state.preferences.settings.value;
  const fields = flatFields(sections.flatMap((section) => section.fields));
  const drawn = drawnSections(sections, flat);

  const [values, setValues] = useState(() => data);
  const [received, setReceived] = useState(() => data);
  const [frozen, setFrozen] = useState(() => data);
  if (data !== received) {
    setReceived(data);
    setValues(data);
  }
  const [store] = useState(() => new FormStore(data));
  useLayoutEffect(() => {
    store.keep(values);
  }, [store, values]);

  const ids = useDrawnIds(drawn, formKey);
  const [revealed, setRevealed] = useState(() => filledKeys(data));

  const [chosen, setChosen] = useState<readonly string[]>([]);
  const shown = followKeys
    ? followed(frozen, values, [...followKeys, ...chosen])
    : values;
  const inland =
    fields.some((field) => field.key === 'waters') &&
    shown.waters === 'Eaux intérieures';
  const context: CompactFormContext = {
    values,
    shown,
    fields,
    settings,
    ids,
    revealed,
    inland,
    cellStyle,
    store,
    latest: store.latest,
    set: (key, value, choice = false) => {
      const next = applyFieldChange(
        store.latest(),
        key,
        value,
        fields,
        settings,
      );
      store.keep(next);
      setValues(next);
      setFrozen((before) => followed(before, next, [key]));
      if (choice) setChosen((before) => [...before, key]);
      onChange(next, key);
    },
    reveal: (key) => {
      flushSync(() => setRevealed((before) => new Set(before).add(key)));
      store.focus(key);
    },
  };
  return (
    <CompactFormProvider value={context}>
      {flat ? (
        <div className="cgrid">
          <Grid fields={drawn[0]?.fields ?? []} afterCell={afterCell} />
        </div>
      ) : (
        keyedItems(drawn, sectionTitle).map(({ key, item: section, index }) => (
          <details
            key={key}
            className={
              inland && allSeaOnly(section.fields)
                ? 'section waters-hide'
                : 'section'
            }
            open={!section.collapsed}
            data-s={index}
          >
            <summary>{tr(section.title ?? '')}</summary>
            <div className="cgrid">
              <Grid fields={section.fields} afterCell={afterCell} />
            </div>
          </details>
        ))
      )}
    </CompactFormProvider>
  );
}

function useDrawnIds(
  sections: CompactFormProps['sections'],
  formKey: string | undefined,
): FieldIds {
  const fields = sections.flatMap((section) => section.fields);
  const form = drawnForm(
    navigation.peek().id,
    formKey ?? fields.map((field) => field.key).join(','),
    fields,
  );
  useEffect(() => {
    markReleased(form, false);
    return () => markReleased(form, true);
  }, [form]);
  return form.ids;
}

function sectionTitle(section: { title?: string }): string {
  return section.title ?? '';
}

function filledKeys(data: FieldData): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const key of Object.keys(data)) if (isFilled(data[key])) keys.add(key);
  return keys;
}

function followed(
  base: FieldData,
  source: FieldData,
  keys: readonly string[],
): FieldData {
  const out = { ...base };
  for (const key of keys) {
    if (key in source) out[key] = source[key];
    else Reflect.deleteProperty(out, key);
  }
  return out;
}

function allSeaOnly(fields: readonly FieldDefinition[]): boolean {
  const items = gridItems(fields);
  return (
    items.length > 0 &&
    items.every(
      (item) =>
        item.kind === 'field' && WATERS_SEA_ONLY.includes(item.field.key),
    )
  );
}
