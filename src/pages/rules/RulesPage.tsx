import { useSignals } from '@preact/signals-react/runtime';
import type { ReactNode } from 'react';
import { Fragment } from 'react';

import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useTr } from '../../i18n/useTr.ts';

import { LEMAN_RULES } from './lemanRules.ts';

const SOURCE = /(?<source>\((?:ONI[^)]*|RNL[^)]*|OFDF|SISL|préfecture[^)]*)\))/;

function RuleText({ item }: { item: string }) {
  const tr = useTr();
  const parts: ReactNode[] = [];
  for (const [position, part] of item.split(SOURCE).entries()) {
    parts.push(
      <Fragment key={position}>
        {position % 2 === 1 ? <small>{tr(part)}</small> : tr(part)}
      </Fragment>,
    );
  }
  return parts;
}

/**
 * Screen `rules`: the offline memo of the Lake Geneva rules (legacy `VIEWS.rules`).
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function RulesPage() {
  useSignals();
  const tr = useTr();
  return (
    <>
      <PageTitle
        helps={[
          'Aide-mémoire disponible sans réseau. Les textes officiels font foi : l’ONI, le Règlement de la navigation sur le Léman (nouvelle version en vigueur depuis 2019) et les règlements locaux.',
        ]}
      >
        Règles du Léman
      </PageTitle>
      {LEMAN_RULES.map(([title, items], index) => (
        <details key={title} className="section rules" open={index === 0}>
          <summary>{tr(title)}</summary>
          <ul>
            {items.map((item) => (
              <li key={item}>
                <RuleText item={item} />
              </li>
            ))}
          </ul>
        </details>
      ))}
      <HelpText>
        Sources : Ordonnance sur la navigation intérieure (RS 747.201.1, état au
        18.02.2020) ; Règlement de la navigation sur le Léman ; préfecture de
        Haute-Savoie, dossier de presse « Lac Léman » ; SISL, « Le Léman » ;
        OFDF, « Entrée en Suisse en bateau ».
      </HelpText>
    </>
  );
}
