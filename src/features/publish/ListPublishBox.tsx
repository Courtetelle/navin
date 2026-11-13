import { useSignals } from '@preact/signals-react/runtime';
import type { MouseEvent, ReactElement } from 'react';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

import { ExtraSends } from './ExtraSends.tsx';
import {
  ItemChecks,
  PhotoChecks,
  PhotoOptions,
} from './ListPublishOptions.tsx';
import { SectionChecks } from './SectionChecks.tsx';
import { TemplateChoice } from './TemplateChoice.tsx';
import { imageList } from './imageList.ts';
import { hasExtraSends, listItems } from './listKinds.ts';
import { activeTemplate, listChoice } from './listPublishState.ts';
import { chosenItems, sectionKeys } from './listSelection.ts';
import { setListTheme } from './listTemplateActions.ts';
import { printList } from './printList.tsx';
import { closeListPublish } from './publishWindowState.ts';
import { LX_THEMES } from './themes.ts';
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
  const theme = activeTemplate(kind).theme ?? 'cards';
  const choice = listChoice(kind);
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
      <summary>🖨 Imprimer ou envoyer la liste</summary>
      <div className="lx-in">
        <p className="help lx-sec-h">Mise en page</p>
        <div className="lx-tpl lx-themes">
          {LX_THEMES.map(([id, label]) => (
            <Button
              key={id}
              type="button"
              className={`btn no-navact ${theme === id ? 'on' : ''}`}
              data-lxth={id}
              onClick={() => {
                setListTheme(kind, id);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <PhotoOptions kind={kind} items={items} choice={choice} />
        <div className="row c2">
          <Button
            type="button"
            className="btn big"
            data-lximg="1"
            disabled={imageBusy}
            onClick={() => {
              publish((list) => {
                setImageBusy(true);
                void imageList(kind, list).finally(() => {
                  setImageBusy(false);
                });
              });
            }}
          >
            📸 Image<small>écran, WhatsApp…</small>
          </Button>
          <Button
            type="button"
            className="btn big"
            data-lxpdf="1"
            onClick={() => {
              publish((list) => {
                closeListPublish();
                void printList(kind, list);
              });
            }}
          >
            🖨 PDF<small>A4, imprimante</small>
          </Button>
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
