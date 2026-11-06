import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { textOf } from '../../lib/format.ts';
import type { Member } from '../../model/types.ts';
import { memberName, state, toast } from '../../state/index.ts';

import type { ArbitrationPick, Side } from './arbitration.ts';
import {
  arbitrationDefaults,
  arbitrationLabel,
  differingKeys,
  mergeReceivedSheet,
} from './arbitration.ts';
import type { ParsedSheet } from './blankParse.ts';
import { createFromSheet, sheetDone } from './blankSheet.ts';

/** Props of {@link BlankArbitration}. */
export interface BlankArbitrationProps {
  /** Received sheet. */
  received: ParsedSheet;
  /** Similar existing cards. */
  clones: readonly Member[];
}

/**
 * A received sheet looks like an existing card: the user keeps a value per
 * field, or creates a separate card (legacy `renderBlankArb`, lake.js:2147).
 * @param props - Sheet and similar cards.
 * @returns The screen.
 */
export function BlankArbitration({ received, clones }: BlankArbitrationProps) {
  useSignals();
  const tr = useTr();
  const [target, setTarget] = useState(() => clones[0] as Member);
  const [chosen, setChosen] = useState<ArbitrationPick>({});
  const [redrawn, setRedrawn] = useState(false);
  const diff = differingKeys(received, target);
  const pick = { ...arbitrationDefaults(diff, target), ...chosen };
  const choose = (key: string, side: Side) => {
    buzz();
    setChosen({ ...chosen, [key]: side });
    setRedrawn(true);
  };
  return (
    <>
      <PageTitle
        atTop={!redrawn}
        helps={[
          'Une fiche semblable existe déjà. Pour chaque case différente, touchez la valeur à garder, puis « Fusionner ». Ou créez une fiche à part.',
        ]}
      >
        {`Fiche reçue : ${memberName(received)}`}
      </PageTitle>
      {clones.length > 1 ? (
        <div className="checks">
          {clones.map((clone) => (
            <Button
              key={clone.id}
              className={`btn no-navact check ${clone.id === target.id ? 'on' : ''}`}
              data-tg={clone.id}
              onClick={() => {
                buzz();
                setTarget(
                  state.data.members.value.find(
                    (member) => member.id === clone.id,
                  ) ?? target,
                );
                setChosen({});
                setRedrawn(true);
              }}
            >
              <span className="box">{clone.id === target.id ? '✔' : ''}</span>
              {memberName(clone)}
              <small>
                {[clone.tel, clone.email].filter(Boolean).join(' · ')}
              </small>
            </Button>
          ))}
        </div>
      ) : null}
      {diff.length > 0 ? (
        diff.map((key) => (
          <section key={key} className="field arb">
            <h3 className="sub-h">{tr(arbitrationLabel(key))}</h3>
            <ButtonRow className="row c2">
              <Button
                className={`btn no-navact arb-v ${pick[key] === 'old' ? 'on' : ''}`}
                data-arb={key}
                data-side="old"
                onClick={() => choose(key, 'old')}
              >
                {textOf(target[key]) || tr('(vide)')}
                <small>{tr('fiche actuelle')}</small>
              </Button>
              <Button
                className={`btn no-navact arb-v ${pick[key] === 'new' ? 'on' : ''}`}
                data-arb={key}
                data-side="new"
                onClick={() => choose(key, 'new')}
              >
                {textOf(received[key])}
                <small>{tr('fiche reçue')}</small>
              </Button>
            </ButtonRow>
          </section>
        ))
      ) : (
        <HelpText>
          Rien de nouveau : la fiche reçue est identique à la fiche actuelle.
        </HelpText>
      )}
      <ButtonRow>
        <Button
          className="btn big primary no-navact"
          id="arbMerge"
          onClick={() => {
            buzz();
            mergeReceivedSheet(target, received, pick);
            toast(`Fiche « ${memberName(target)} » mise à jour`);
            sheetDone();
          }}
        >
          {tr(`✔ Fusionner dans « ${memberName(target)} »`)}
        </Button>
      </ButtonRow>
      <ButtonRow className="row c2">
        <Button
          className="btn"
          id="arbNew"
          onClick={() => {
            buzz();
            createFromSheet(received);
            toast('Fiche à part créée');
            sheetDone();
          }}
        >
          {tr('＋ Créer une fiche à part')}
        </Button>
        <Button
          className="btn"
          id="arbSkip"
          onClick={() => {
            buzz();
            sheetDone();
          }}
        >
          {tr('Ignorer cette fiche')}
        </Button>
      </ButtonRow>
    </>
  );
}
