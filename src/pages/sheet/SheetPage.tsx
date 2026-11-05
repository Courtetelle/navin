import { useSignals } from '@preact/signals-react/runtime';
import { useLayoutEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useIntroLead } from '../../components/shared/introLead.ts';
import { LakeSheet } from '../../features/boats/LakeSheet.tsx';
import { hasTrace } from '../../features/boats/outing.ts';
import {
  buildSheetData,
  prepareSheet,
} from '../../features/boats/sheetData.ts';
import {
  SHEET_PARTS,
  pickSheet,
  sheetParts,
  toggleSheetPart,
} from '../../features/boats/sheetParts.ts';
import { sheetPng } from '../../features/boats/sheetPng.ts';
import { printBook } from '../../features/data/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { dayKey, textOf } from '../../lib/format.ts';
import type { PageProps } from '../../shell/pageTypes.ts';
import { go } from '../../shell/router.ts';
import { deliver, state, toast, updateSettings } from '../../state/index.ts';

const FORMATS: ReadonlyArray<readonly [string, string]> = [
  ['img', '📸 Image'],
  ['pdf', '🖨 PDF'],
  ['both', '📸 + 🖨 Les deux'],
];

/**
 * Screen `sheet` (legacy `VIEWS.sheet`): the lake day sheet, the parts to send
 * and the format of what is sent.
 * @param props - Page props; `arg` is the day key.
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function SheetPage({ arg }: PageProps) {
  useSignals();
  const tr = useTr();
  const [key] = useState(
    () =>
      (arg as string | null | undefined) ||
      state.view.currentDay.value ||
      dayKey(new Date()),
  );
  const [sending, setSending] = useState(false);
  const [fresh, setFresh] = useState(true);
  const lead = useIntroLead('sheet', '') && fresh;
  useLayoutEffect(() => {
    prepareSheet(key);
  }, [key]);
  if (!state.data.cruise.value) return null;
  const sheet = pickSheet(buildSheetData(key), key);
  const parts = sheetParts();
  const trace = hasTrace(key);
  const format = textOf(state.preferences.settings.value.sheetFmt) || 'img';
  const print = () => printBook([`day:${key}`]);
  const send = async () => {
    buzz();
    if (format === 'pdf') {
      print();
      return;
    }
    setSending(true);
    try {
      const blob = await sheetPng(sheet);
      const boat = state.data.cruise.value?.info.boat || 'sortie';
      const safeName = boat.replaceAll(/[^\w-]+/g, '-');
      await deliver(blob, `fiche-${safeName}-${key}.png`, 'image/png');
    } catch {
      toast('Image impossible : faites une capture d’écran');
    }
    setSending(false);
    if (format === 'both') print();
  };
  let sendLabel = '📤 Envoyer l’image (WhatsApp…)';
  if (format === 'pdf') sendLabel = '🖨 Imprimer ou enregistrer en PDF';
  if (format === 'both') sendLabel = '📤 Envoyer l’image, puis le PDF';
  return (
    <>
      <HelpText introLead={lead} style={{ marginTop: 0 }}>
        Choisissez ce que vous voulez communiquer :
      </HelpText>
      <div className="chips sheet-parts">
        {SHEET_PARTS.map(([id, label]) => {
          const noTrace = id === 'trace' && !trace;
          return (
            <Button
              key={id}
              className={parts[id] && !noTrace ? 'btn on' : 'btn'}
              choice
              data-part={id}
              disabled={noTrace}
              onClick={() => {
                buzz();
                setFresh(false);
                toggleSheetPart(id);
              }}
            >
              {tr(label)}
              {noTrace ? (
                <>
                  {' '}
                  <small>{tr('pas de trace')}</small>
                </>
              ) : null}
            </Button>
          );
        })}
      </div>
      <LakeSheet sheet={sheet} />
      {sheet.missing ? (
        <HelpText nextIsRow>
          À compléter dans la fiche : heures moteur de fin, niveau du diesel,
          signature…
        </HelpText>
      ) : null}
      <ButtonRow>
        <Button
          className="btn"
          data-dayform="1"
          onClick={() => {
            buzz();
            go('day', key);
          }}
        >
          {tr('✎ Compléter la fiche')}
        </Button>
      </ButtonRow>
      <h3 className="sub-h">{tr('Format')}</h3>
      <ButtonRow className="row c3">
        {FORMATS.map(([id, label]) => (
          <Button
            key={id}
            className={format === id ? 'btn on' : 'btn'}
            data-fmt={id}
            onClick={() => {
              buzz();
              setFresh(false);
              updateSettings((settings) => {
                settings.sheetFmt = id;
              });
            }}
          >
            {tr(label)}
          </Button>
        ))}
      </ButtonRow>
      <ButtonRow>
        <Button
          className="btn big primary"
          id="shareImg"
          disabled={sending}
          onClick={() => void send()}
        >
          {tr(sendLabel)}
        </Button>
      </ButtonRow>
      <HelpText>
        Image : elle s’ouvre dans le menu de partage, choisissez WhatsApp puis
        le groupe. PDF : dans la fenêtre d’impression, « Enregistrer en PDF » ou
        partager. Une simple capture d’écran de la fiche marche aussi.
      </HelpText>
    </>
  );
}
