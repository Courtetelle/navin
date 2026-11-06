import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { toast } from '../../state/index.ts';

import { remarks, saveRemarks } from './remarkContext.ts';

/**
 * « 📋 Mes remarques » in the remark window (nav.js:1462-1475): newest first,
 * copy all, empty the list with a long press.
 * @param props - Close action.
 * @returns The list content of the window box.
 */
export function RemarkList({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState(remarks);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        remarks()
          .map((remark) => remark.text)
          .join('\n\n――――\n\n'),
      );
      toast('Remarques copiées');
    } catch {
      toast('Copie impossible ici');
    }
  };
  return (
    <>
      <p>{`📋 Mes remarques (${list.length})`}</p>
      <div className="rem-list">
        {list.length === 0 ? <p className="help">Aucune remarque.</p> : null}
        {list.toReversed().map((remark) => (
          <div
            className={remark.sent ? 'rem-it rem-sent' : 'rem-it'}
            key={`${remark.t}${remark.text}`}
          >
            <small>
              {new Date(remark.t).toLocaleString('fr-CH')}
              {remark.sent ? ' · envoyée ✓' : ' · pas envoyée'}
            </small>
            <div>{lines(remark.text)}</div>
          </div>
        ))}
      </div>
      <div className="row c2">
        <Button
          type="button"
          className="btn"
          data-rl="copy"
          onClick={() => void copy()}
        >
          📋 Tout copier
        </Button>
        <HoldDeleteButton
          key={list.length}
          type="button"
          className="btn danger"
          data-rl="clear"
          onDelete={() => {
            saveRemarks([]);
            setList([]);
          }}
        >
          🗑 Vider
        </HoldDeleteButton>
      </div>
      <div className="row">
        <Button type="button" className="btn" data-rl="close" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </>
  );
}

function lines(text: string) {
  const nodes: ReactNode[] = [];
  let offset = 0;
  for (const part of text.split('\n')) {
    if (offset > 0) nodes.push(<br key={`br${offset}`} />);
    nodes.push(<Fragment key={`t${offset}`}>{part}</Fragment>);
    offset += part.length + 1;
  }
  return nodes;
}
