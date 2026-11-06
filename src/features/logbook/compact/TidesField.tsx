import type { MouseEvent } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { buzz } from '../../../lib/dom.ts';
import type { FieldDefinition } from '../../../model/field.ts';

import { Cell } from './Cell.tsx';
import { MarqueeInput } from './MarqueeInput.tsx';
import { useCompactForm } from './compactContext.ts';

interface TideRow {
  /** @default undefined */
  type?: string;
  /** @default undefined */
  h?: string;
  /** @default undefined */
  m?: string;
}

const BLANK_TIDES: readonly TideRow[] = [{}, {}, {}, {}];

/**
 * Four tide lines: high or low water, time and height (legacy `tides`).
 * @param props - The field.
 * @param props.field - Field definition.
 * @returns The cell.
 */
export function TidesField({ field }: { field: FieldDefinition }) {
  const form = useCompactForm();
  const tr = useTr();
  const rows = (form.shown[field.key] ?? BLANK_TIDES) as readonly TideRow[];
  const change = (index: number, patch: TideRow) => {
    const current = (form.latest().marees ?? BLANK_TIDES) as readonly TideRow[];
    form.set(
      'marees',
      current.map((row, position) =>
        position === index ? { ...row, ...patch } : row,
      ),
    );
  };
  return (
    <Cell field={field} wide>
      <div className="tides">
        {[...rows.keys()].map((line) => (
          <div key={line} className="tide" data-i={line}>
            <div className="chips small">
              {['PM', 'BM'].map((type) => (
                <Button
                  key={type}
                  choice
                  className={rows[line]?.type === type ? 'btn on' : 'btn'}
                  data-tt={type}
                  onClick={(event: MouseEvent) => {
                    event.preventDefault();
                    buzz();
                    const same = rows[line]?.type === type;
                    change(line, { type: same ? '' : type });
                  }}
                >
                  {tr(type)}
                </Button>
              ))}
            </div>
            <MarqueeInput
              className="text"
              type="time"
              data-tf="h"
              value={rows[line]?.h ?? ''}
              aria-label="Heure"
              onChange={(event) => change(line, { h: event.target.value })}
            />
            <MarqueeInput
              className="text"
              type="text"
              inputMode="decimal"
              data-tf="m"
              placeholder={tr.placeholder('haut. m')}
              value={rows[line]?.m ?? ''}
              aria-label="Hauteur"
              onChange={(event) => change(line, { m: event.target.value })}
            />
          </div>
        ))}
      </div>
    </Cell>
  );
}
