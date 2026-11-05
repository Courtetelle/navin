import type { ReactElement } from 'react';

import { MasterCheck } from '../../components/shared/MasterCheck.tsx';

import { CheckButton } from './CheckButton.tsx';
import type { ListOptionProps } from './ListPublishOptions.tsx';
import {
  toggleAllSections,
  toggleRow,
  toggleSection,
} from './listChoiceActions.ts';
import { sectionKeys, sectionRowLabels } from './listSelection.ts';
import type { ListKind } from './types.ts';

/**
 * Sections to print, each with its own lines.
 * @param props - List, elements and choice.
 * @returns The block.
 */
export function SectionChecks({
  kind,
  items,
  choice,
}: ListOptionProps): ReactElement {
  const keys = sectionKeys(items);
  const checked = keys.filter((key) => !choice.offSec.includes(key)).length;
  return (
    <>
      <p className="help lx-sec-h">
        {`Sections à imprimer (${checked} / ${keys.length})`}
      </p>
      <div className="checks lx-sec">
        <MasterCheck
          checked={checked}
          total={keys.length}
          attribute="data-lxsall"
          onClick={() => {
            toggleAllSections(kind, keys);
          }}
        />
      </div>
      {keys.map((key) => {
        const on = !choice.offSec.includes(key);
        const labels = sectionRowLabels(items, key);
        return (
          <SectionCheck
            key={key}
            kind={kind}
            sectionKey={key}
            on={on}
            labels={labels}
            offRow={choice.offRow}
          />
        );
      })}
    </>
  );
}

function SectionCheck({
  kind,
  sectionKey,
  on,
  labels,
  offRow,
}: {
  kind: ListKind;
  sectionKey: string;
  on: boolean;
  labels: readonly string[];
  offRow: readonly string[];
}): ReactElement {
  return (
    <>
      <div className="checks lx-sec">
        <CheckButton
          on={on}
          data-lxs={sectionKey}
          onClick={() => {
            toggleSection(kind, sectionKey);
          }}
        >
          {sectionKey}
        </CheckButton>
      </div>
      {on && labels.length > 0 ? (
        <div className="checks lx-rows">
          {labels.map((label) => {
            const id = `${sectionKey}|${label}`;
            return (
              <CheckButton
                key={id}
                on={!offRow.includes(id)}
                data-lxr={id}
                onClick={() => {
                  toggleRow(kind, id);
                }}
              >
                {label}
              </CheckButton>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
