import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import type { MenuChange } from '../../features/data/menusChanges.ts';
import {
  menusChanges,
  menusChangesSince,
  resetMenusChanges,
} from '../../features/data/menusChanges.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtDotDateTime } from '../../lib/format.ts';
import { toast } from '../../state/index.ts';

const MARKS: Record<MenuChange['kind'], string> = {
  added: '＋',
  removed: '−',
  renamed: '✎',
};

/**
 * Paramétrages › Sauvegarde et synchronisation › Mes menus pour NavIn: how
 * the menus shaped on the devices become the menus of NavIn (through the
 * relay), and what changed since they were last taken in, to choose.
 * @returns The fold.
 */
export function MenusForNavIn() {
  useSignals();
  const tr = useTr();
  const [, setTurn] = useState(0);
  const changes = menusChanges();
  const since = menusChangesSince();
  const lists = [...new Set(changes.map((change) => change.list))];
  return (
    <FoldSection id="menusNavIn" title="📋 Mes menus pour NavIn">
      <HelpText keep>
        Vos menus (check-in, listes, bases, modèles, tâches, météo avant de
        partir, boutons modifiés au crayon) partent seuls sur votre relais à
        chaque synchronisation, sans aucune donnée personnelle. Le jour où vous
        voulez qu’ils deviennent les menus de NavIn : 1. touchez « 🔄
        Synchroniser maintenant » ; 2. sur le Mac, dans Claude Code, écrivez «
        prends mes menus » avec l’adresse de votre relais (celle de votre Worker
        Cloudflare, …workers.dev) ; 3. Claude les lit sur le relais avec la
        liste ci-dessous, et vous dites ce qu’il faut intégrer ou laisser ; 4.
        une fois fait, touchez « ✓ Repartir de zéro ».
      </HelpText>
      <p className="help" data-menus-since>
        {since
          ? `${tr('Changements depuis le')} ${fmtDotDateTime(new Date(since))}`
          : tr('Changements comptés à partir de maintenant')}
      </p>
      {changes.length === 0 ? (
        <p className="help" data-menus-changes="0">
          {tr('Aucun changement des menus sur cet appareil.')}
        </p>
      ) : (
        <div className="menus-changes" data-menus-changes={changes.length}>
          {lists.map((list) => (
            <div key={list} className="menus-list">
              <h4>{list}</h4>
              <ul>
                {changes
                  .filter((change) => change.list === list)
                  .map((change) => (
                    <li
                      key={`${change.kind}${change.said}`}
                      className={`menus-${change.kind}`}
                    >
                      <b>{MARKS[change.kind]}</b> {change.said}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <ButtonRow>
        <ArmedButton
          className="btn"
          data-menus="reset"
          armedLabel={tr('Toucher encore : repartir de zéro')}
          onConfirm={() => {
            buzz();
            resetMenusChanges();
            setTurn((turn) => turn + 1);
            toast('Liste des changements remise à zéro');
          }}
        >
          {tr('✓ Repartir de zéro')}
          <small>{tr('quand les changements sont intégrés à NavIn')}</small>
        </ArmedButton>
      </ButtonRow>
    </FoldSection>
  );
}
