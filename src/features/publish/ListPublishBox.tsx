import { useSignals } from '@preact/signals-react/runtime';
import type { MouseEvent, ReactElement } from 'react';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { SendButton } from '../../components/shared/ShareButton.tsx';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

import { ExtraSends } from './ExtraSends.tsx';
import {
  ItemChecks,
  PhotoChecks,
  PhotoOptions,
} from './ListPublishOptions.tsx';
import { SectionChecks } from './SectionChecks.tsx';
import { ShareThemeNote } from './ShareTheme.tsx';
import { TemplateChoice } from './TemplateChoice.tsx';
import { imageList } from './imageList.ts';
import { hasExtraSends, listItems } from './listKinds.ts';
import { listChoice } from './listPublishState.ts';
import { chosenItems, sectionKeys } from './listSelection.ts';
import { printList } from './printList.tsx';
import { closeListPublish, openFormat } from './publishWindowState.ts';
import type { ListKind } from './types.ts';

/** Props of {@link ListPublishBox}. */
interface ListPublishBoxProps {
  /** The list. */
  kind: ListKind;
}

/**
 * Content of the Partager window of a list: layout, photos, image or PDF, then
 * the settings of the list (templates, elements, sections, photos) and its own
 * sends.
 * @param props - List kind.
 * @returns The `details.lx-box`.
 */
export function ListPublishBox({ kind }: ListPublishBoxProps): ReactElement {
  useSignals();
  const [imageBusy, setImageBusy] = useState(false);
  const items = listItems(kind);
  const choice = listChoice(kind);
  const format = openFormat.value;
  const severalSections = sectionKeys(items).length > 1;

  const publish = (send: (list: ReturnType<typeof chosenItems>) => void) => {
    const list = chosenItems(listItems(kind), listChoice(kind));
    if (list.length === 0) toast('Rien de coché');
    else send(list);
  };

  return (
    <details
      className="section lx-box no-print"
      data-lx={kind}
      open
      onClick={buzzOnButton}
    >
      <summary>
        {format === 'pdf' ? '🖨 PDF de la liste' : '💬 Image de la liste'}
      </summary>
      <div className="lx-in">
        <ShareThemeNote />
        <PhotoOptions kind={kind} items={items} choice={choice} />
        <div className="row">
          <SendButton
            format={format}
            data-lxsend={format}
            disabled={imageBusy}
            onClick={() => {
              publish((list) => {
                if (format === 'pdf') {
                  closeListPublish();
                  void printList(kind, list);
                  return;
                }
                setImageBusy(true);
                void imageList(kind, list).finally(() => {
                  setImageBusy(false);
                });
              });
            }}
          />
        </div>
        <p className="help lx-sec-h lx-opt-h">Réglages de l’envoi</p>
        {severalSections ? <TemplateChoice kind={kind} /> : null}
        <ItemChecks kind={kind} items={items} choice={choice} />
        {severalSections ? (
          <SectionChecks kind={kind} items={items} choice={choice} />
        ) : null}
        <PhotoChecks kind={kind} items={items} choice={choice} />
        {hasExtraSends(kind) ? (
          <>
            <p className="help lx-sec-h">Autres envois</p>
            <ExtraSends kind={kind} />
          </>
        ) : null}
        <div className="row">
          <Button
            type="button"
            className="btn"
            data-lxclose="1"
            onClick={closeListPublish}
          >
            Fermer
          </Button>
        </div>
      </div>
    </details>
  );
}

function buzzOnButton(event: MouseEvent<HTMLDetailsElement>): void {
  if ((event.target as Element).closest('button')) buzz();
}
