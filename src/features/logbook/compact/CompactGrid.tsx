import type { ReactNode } from 'react';

import type { FieldDefinition } from '../../../model/field.ts';

import { FieldCell } from './FieldCell.tsx';
import { isCellHidden } from './cellRules.ts';
import { InFrameContext, useCompactForm } from './compactContext.ts';
import type { CompactFormProps } from './compactTypes.ts';
import type { GridItem } from './fieldChange.ts';
import { gridItems } from './fieldChange.ts';

/** Props of {@link Grid}. */
export interface GridProps {
  fields: readonly FieldDefinition[];
  afterCell: CompactFormProps['afterCell'];
}

/**
 * Content of a `.cgrid` (legacy `cfFields`): single cells, pairs and frames.
 * @param props - Fields and the extra cell after each one.
 * @returns The cells.
 */
export function Grid({ fields, afterCell }: GridProps) {
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
