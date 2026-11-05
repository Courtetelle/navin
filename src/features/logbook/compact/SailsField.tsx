import type { MouseEvent } from 'react';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { Button } from '../../../components/shared/Button.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { buzz } from '../../../lib/dom.ts';
import { textOf } from '../../../lib/format.ts';
import type { FieldDefinition } from '../../../model/field.ts';

import { Cell } from './Cell.tsx';
import { FieldLabel } from './FieldLabel.tsx';
import { MarqueeInput } from './MarqueeInput.tsx';
import { ColorButton, SailLine } from './SailParts.tsx';
import { useCompactForm } from './compactContext.ts';

const DESCRIPTION_PLACEHOLDER = 'inscription ou dessin';

interface SailRow {
  id: number;
  name: string;
  description: string;
  color: string;
  placeholder: string;
}

/**
 * The sails: mainsail, then a list of headsails, each with a colour and its
 * inscription. Names stay stored as `A, B, C` for the sail buttons (legacy `sails`).
 * @param props - The field.
 * @param props.field - Field definition.
 * @returns The cell.
 */
export function SailsField({ field }: { field: FieldDefinition }) {
  const form = useCompactForm();
  const tr = useTr();
  const list = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(() => initialRows(field, form.shown));
  const [mainDescription, setMainDescription] = useState(
    textOf(form.shown.gvDesc),
  );
  const [mainColor, setMainColor] = useState(textOf(form.shown.gvColor));

  const save = (
    nextRows: readonly SailRow[],
    description = mainDescription,
    color = mainColor,
  ) => {
    form.set('gvDesc', description.trim());
    form.set('gvColor', color || null);
    const named: SailRow[] = [];
    for (const row of nextRows) if (row.name.trim()) named.push(row);
    const descriptions = named.map((row) => row.description.trim());
    form.set('voilesDesc', descriptions.some(Boolean) ? descriptions : null);
    const colors = named.map((row) => row.color);
    form.set('voilesColor', colors.some(Boolean) ? colors : null);
    form.set(field.key, named.map((row) => row.name.trim()).join(', '));
  };
  const editRow = (id: number, patch: Partial<SailRow>) => {
    const next = rows.map((row) =>
      row.id === id ? { ...row, ...patch } : row,
    );
    setRows(next);
    save(next);
  };
  const removeIfEmpty = (row: SailRow, element: HTMLElement) => {
    setTimeout(() => {
      if (element.contains(document.activeElement)) return;
      setRows((current) => {
        const latest = current.find((item) => item.id === row.id);
        if (!latest || current.length <= 1) return current;
        if (latest.name.trim() || latest.description.trim()) return current;
        return current.filter((item) => item.id !== row.id);
      });
    }, 200);
  };
  return (
    <Cell field={field} wide className="sails-box" data-sk={field.key}>
      <FieldLabel field={field} />
      <div className="sail-row">
        <span className="sail-fixed">{tr('Grand-voile')}</span>
        <div className="sail-cd">
          <ColorButton
            color={mainColor}
            main
            onChange={(color) => {
              setMainColor(color);
              save(rows, mainDescription, color);
            }}
          />
          <MarqueeInput
            className="text sail-desc"
            data-gv="1"
            type="text"
            value={mainDescription}
            placeholder={tr.placeholder(DESCRIPTION_PLACEHOLDER)}
            onChange={(event) => {
              setMainDescription(event.target.value);
              save(rows, event.target.value);
            }}
          />
        </div>
        <SailLine name="Grand-voile" color={mainColor} text={mainDescription} />
      </div>
      <div className="sail-sub">{tr('Voiles d’avant')}</div>
      <div className="sail-list" ref={list}>
        {rows.map((row) => (
          <div
            key={row.id}
            className="sail-row"
            onBlur={(event) => removeIfEmpty(row, event.currentTarget)}
          >
            <MarqueeInput
              className="text sail-name"
              type="text"
              value={row.name}
              placeholder={tr.placeholder(row.placeholder)}
              onChange={(event) =>
                editRow(row.id, { name: event.target.value })
              }
            />
            <div className="sail-cd">
              <ColorButton
                color={row.color}
                onChange={(color) => editRow(row.id, { color })}
              />
              <MarqueeInput
                className="text sail-desc"
                type="text"
                value={row.description}
                placeholder={tr.placeholder(DESCRIPTION_PLACEHOLDER)}
                onChange={(event) =>
                  editRow(row.id, { description: event.target.value })
                }
              />
            </div>
            <SailLine
              name={row.name}
              color={row.color}
              text={row.description}
            />
          </div>
        ))}
      </div>
      <Button
        type="button"
        className="more-add no-navact sail-add"
        onClick={(event: MouseEvent) => {
          event.preventDefault();
          buzz();
          const last = rows.at(-1);
          if (last && !last.name.trim() && !last.description.trim()) {
            focusLastName(list.current);
            return;
          }
          flushSync(() => {
            setRows([
              ...rows,
              {
                id: (last?.id ?? 0) + 1,
                name: '',
                description: '',
                color: '',
                placeholder: 'voile d’avant suivante (ex. foc, spi)',
              },
            ]);
          });
          focusLastName(list.current);
        }}
      >
        {tr('＋ Ajouter une voile d’avant')}
      </Button>
    </Cell>
  );
}

function focusLastName(list: HTMLElement | null): void {
  const names = list?.querySelectorAll<HTMLInputElement>('.sail-name');
  names?.item(names.length - 1).focus();
}

function initialRows(
  field: FieldDefinition,
  data: Record<string, unknown>,
): SailRow[] {
  const names = textOf(data[field.key])
    .split(/[,;\n]/)
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.length === 0) names.push('');
  const descriptions = Array.isArray(data.voilesDesc) ? data.voilesDesc : [];
  const colors = Array.isArray(data.voilesColor) ? data.voilesColor : [];
  return names.map((name, index) => ({
    id: index,
    name,
    description: textOf(descriptions[index]),
    color: textOf(colors[index]),
    placeholder: index
      ? 'voile d’avant suivante'
      : '1re voile d’avant (ex. génois)',
  }));
}
