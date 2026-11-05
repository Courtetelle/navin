import { useSignals } from '@preact/signals-react/runtime';
import type { ReactNode } from 'react';
import { useId, useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';

import { useSheetTranslation, useTr } from '../../../i18n/useTr.ts';
import type { FieldData, FieldDefinition } from '../../../model/field.ts';
import { flatFields } from '../../../model/field.ts';
import { WATERS_SEA_ONLY } from '../../../model/techFields.ts';
import { navigation } from '../../../shell/router.ts';
import { state } from '../../../state/index.ts';

import { FieldCell } from './FieldCell.tsx';
import { isCellHidden } from './cellRules.ts';
import type { CompactFormContext } from './compactContext.ts';
import {
  CompactFormProvider,
  InFrameContext,
  useCompactForm,
} from './compactContext.ts';
import type { CompactFormProps } from './compactTypes.ts';
import type { GridItem } from './fieldChange.ts';
import {
  applyFieldChange,
  drawnSections,
  gridItems,
  isFilled,
} from './fieldChange.ts';
import type { FieldIds } from './fieldIds.ts';
import { screenFieldIds } from './fieldIds.ts';
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
}: CompactFormProps) {
  useSignals();
  useSheetTranslation();
  const tr = useTr();
  const settings = state.preferences.settings.value;
  const fields = flatFields(sections.flatMap((section) => section.fields));
  const drawn = drawnSections(sections, flat);

  const [values, setValues] = useState(data);
  const [received, setReceived] = useState(data);
  const [frozen, setFrozen] = useState(data);
  if (data !== received) {
    setReceived(data);
    setValues(data);
  }
  const [store] = useState(() => new FormStore(data));
  useLayoutEffect(() => {
    store.keep(values);
  }, [store, values]);

  const ids = useDrawnIds(drawn);
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
        drawn.map((section, index) => (
          <details
            key={section.title ?? index}
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

function useDrawnIds(sections: CompactFormProps['sections']): FieldIds {
  const place = useId();
  return screenFieldIds(
    navigation.peek().id,
    place,
    sections.flatMap((section) => section.fields),
  );
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

interface GridProps {
  fields: readonly FieldDefinition[];
  afterCell: CompactFormProps['afterCell'];
}

function Grid({ fields, afterCell }: GridProps) {
  return gridItems(fields).map((item) => (
    <GridCell key={itemKey(item)} item={item} afterCell={afterCell} />
  ));
}

function itemKey(item: GridItem): string {
  return item.kind === 'field' ? item.field.key : (item.fields[0]?.key ?? '');
}

function GridCell({
  item,
  afterCell,
}: {
  item: GridItem;
  afterCell: GridProps['afterCell'];
}) {
  const after: ReactNode[] = [];
  const keys =
    item.kind === 'field'
      ? [item.field.key]
      : item.fields.map((field) => field.key);
  for (const key of keys) after.push(afterCell?.(key));
  return (
    <>
      <GridBody item={item} />
      {after}
    </>
  );
}

function GridBody({ item }: { item: GridItem }) {
  if (item.kind === 'field') return <FieldCell field={item.field} />;
  const cells = item.fields.map((field) => (
    <FieldCell key={field.key} field={field} />
  ));
  if (item.kind === 'pair') {
    return <div className="cf wide cf-pair">{cells}</div>;
  }
  return <FrameCell item={item}>{cells}</FrameCell>;
}

function FrameCell({
  item,
  children,
}: {
  item: Extract<GridItem, { kind: 'frame' }>;
  children: ReactNode;
}) {
  const form = useCompactForm();
  const hidden =
    item.fields.length > 0 &&
    item.fields.every((field) => isCellHidden(field, form.values, undefined));
  return (
    <div
      className="cf wide cf-pair cf-frame"
      data-frame={item.frame}
      hidden={hidden}
      style={form.cellStyle?.(item.fields[0]?.key ?? '')}
    >
      <InFrameContext value>{children}</InFrameContext>
    </div>
  );
}
