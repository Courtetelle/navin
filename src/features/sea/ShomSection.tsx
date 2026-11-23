import { useSignals } from '@preact/signals-react/runtime';
import { useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { toast, updateSettings } from '../../state/index.ts';

import type { ShomState } from './shomSub.ts';
import {
  SHOM_KEY_SETTING,
  SHOM_SERVICES_URL,
  SHOM_SHOP_URL,
  SHOM_UNTIL_SETTING,
  shomState,
} from './shomSub.ts';

function day(until: string): string {
  const [year, month, date] = until.split('-');
  return `${date}/${month}/${year}`;
}

function stateText(shom: ShomState): string {
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- « none » is the default
  switch (shom.kind) {
    case 'active': {
      return `Abonnement SHOM enregistré, actif jusqu’au ${day(shom.until)} inclus. Le lendemain, NavIn revient seul à Copernicus.`;
    }
    case 'ended': {
      return `Abonnement SHOM terminé le ${day(shom.until)} : NavIn est revenu à Copernicus. Pour le reprendre, achetez un nouvel abonnement et enregistrez sa clé et sa date de fin.`;
    }
    case 'no-date': {
      return 'Clé SHOM enregistrée sans date de fin : indiquez le dernier jour de l’abonnement pour l’activer.';
    }
    default: {
      return 'Pas d’abonnement SHOM : les courants (marée comprise) et les vagues viennent de Copernicus, gratuits.';
    }
  }
}

function save(key: string, until: string): void {
  buzz();
  updateSettings((settings) => {
    settings.windAlert = {
      ...settings.windAlert,
      [SHOM_KEY_SETTING]: key,
      [SHOM_UNTIL_SETTING]: until,
    };
  });
}

/**
 * Currents and tides: Copernicus by default, free; a SHOM subscription
 * bought now and then (more precise along the French coasts), kept with its
 * last day and active up to it.
 * @returns The section.
 */
export function ShomSection() {
  useSignals();
  const tr = useTr();
  const shom = shomState();
  const keyInput = useRef<HTMLInputElement>(null);
  const untilInput = useRef<HTMLInputElement>(null);
  const savedKey =
    shom.kind === 'active' || shom.kind === 'no-date' ? shom.key : '';
  const savedUntil =
    shom.kind === 'active' || shom.kind === 'ended' ? shom.until : '';
  return (
    <div className="field shom-sub" id="shomSub">
      <p
        className={`keep-help shom-state shom-${shom.kind}`}
        id="shomState"
        role="status"
      >
        {tr(stateText(shom))}
      </p>
      <ButtonRow>
        <a
          className="btn primary"
          id="shomBuy"
          href={SHOM_SHOP_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => buzz()}
        >
          {tr('🛒 Acheter un abonnement SHOM (boutique du SHOM)')}
        </a>
      </ButtonRow>
      <ButtonRow>
        <a
          className="btn"
          id="shomServices"
          href={SHOM_SERVICES_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => buzz()}
        >
          {tr('🔑 Services de données du SHOM (clés marées et courants)')}
        </a>
      </ButtonRow>
      <form
        className="key-form"
        onSubmit={(event) => {
          event.preventDefault();
          const key = keyInput.current?.value.trim() ?? '';
          const until = untilInput.current?.value ?? '';
          save(key, until);
          keyInput.current?.blur();
          toast(key ? 'Abonnement SHOM enregistré' : 'Abonnement SHOM retiré');
        }}
      >
        <div className="cf">
          <label htmlFor="shomKey">{tr('Clé de l’abonnement SHOM')}</label>
          <input
            className="text"
            id="shomKey"
            ref={keyInput}
            // The key is a secret: pasted, never shown in clear.
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={tr('Aucune clé')}
            defaultValue={savedKey}
            key={`k${savedKey}`}
          />
        </div>
        <div className="cf">
          <label htmlFor="shomUntil">
            {tr('Dernier jour de l’abonnement')}
          </label>
          <input
            className="text"
            id="shomUntil"
            ref={untilInput}
            type="date"
            defaultValue={savedUntil}
            key={`u${savedUntil}`}
          />
        </div>
        <ButtonRow>
          <Button className="btn" type="submit" id="shomSave">
            {tr('Enregistrer')}
          </Button>
          {shom.kind === 'none' ? null : (
            <Button
              className="btn"
              id="shomDrop"
              onClick={() => {
                save('', '');
                toast('Abonnement SHOM retiré : retour à Copernicus');
              }}
            >
              {tr('Retirer l’abonnement')}
            </Button>
          )}
        </ButtonRow>
      </form>
      <HelpText>
        {tr(
          'Copernicus reste la base, gratuite : courants avec la marée et vagues, à une maille de quelques kilomètres. Le SHOM est plus précis le long des côtes françaises (marées des ports, courants de marée fins). Le paiement se fait sur le site du SHOM, pas dans NavIn. Ensuite, collez ici la clé reçue et le dernier jour de l’abonnement : l’abonnement est actif jusqu’à ce jour, puis NavIn revient seul à Copernicus. Les données du SHOM seront branchées dans le routage et les marées avec la première clé, pour les essayer sur le vrai service ; d’ici là, Copernicus reste utilisé. La clé part dans la sauvegarde complète et la synchronisation, jamais dans un partage.',
        )}
      </HelpText>
    </div>
  );
}
