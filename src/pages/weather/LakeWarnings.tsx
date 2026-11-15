import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import type { LakeWarnSettings } from '../../features/onwater/lakeWarnWatch.ts';
import {
  lakeWarnState,
  readLakeWarnings,
} from '../../features/onwater/lakeWarnWatch.ts';
import {
  lakeWarningText,
  lightOf,
  litWarnings,
} from '../../features/onwater/lakeWarnings.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { state, updateSettings } from '../../state/index.ts';

const TROUBLES: Readonly<Record<string, string>> = {
  'no-relay':
    'Il faut le relais (Réglages › Clés météo › Relais des METAR et bouées) : MétéoSuisse ne laisse pas une appli lire ses avis directement.',
  'old-relay':
    'Le relais doit être mis à jour : Réglages › Clés météo › « 📋 Copier le code du relais », puis sur Cloudflare « Modifier le code », tout remplacer et « Déployer ».',
  network: 'MétéoSuisse n’a pas répondu : nouvel essai dans 5 minutes.',
};

const time = (t: number) =>
  new Date(t).toLocaleString('fr-CH', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * The warnings of MeteoSwiss for the lakes, those that switch on the
 * warning lights: those in force, those to come, the alert on or off.
 * @returns The block.
 */
export function LakeWarnings() {
  useSignals();
  const tr = useTr();
  const { warnings, at, trouble } = lakeWarnState.value;
  const settings = (state.preferences.settings.value.lakeWarn ??
    {}) as LakeWarnSettings;
  const on = settings.on !== false;
  const [busy, setBusy] = useState(false);
  const read = () => {
    setBusy(true);
    void readLakeWarnings().finally(() => setBusy(false));
  };
  useEffect(() => {
    if (lakeWarnState.peek().at === 0) void readLakeWarnings();
  }, []);
  // The warnings as they stood when read.
  const now = at;
  const lit = litWarnings(warnings, now);
  const coming = warnings.filter(
    (warning) => !lit.includes(warning) && warning.expires > now,
  );
  return (
    <div className="lake-warn-list">
      <ButtonRow className="row c2">
        <Button
          className={on ? 'btn on' : 'btn'}
          data-lakewarn="toggle"
          onClick={() => {
            buzz();
            updateSettings((next) => {
              next.lakeWarn = { ...(next.lakeWarn as object), on: !on };
            });
          }}
        >
          {tr(`🚨 Alerte des feux : ${on ? 'OUI' : 'NON'}`)}
        </Button>
        <Button
          className="btn"
          data-lakewarn="read"
          disabled={busy}
          onClick={() => {
            buzz();
            read();
          }}
        >
          {tr('↻ Lire maintenant')}
        </Button>
      </ButtonRow>
      {trouble ? (
        <p className="lw-trouble" role="status">
          {tr(TROUBLES[trouble] ?? '')}
        </p>
      ) : null}
      <h3>{tr('Feux allumés')}</h3>
      {lit.length === 0 ? (
        <p data-lakewarn="none">
          {tr(
            busy || at === 0
              ? 'Lecture des avis de MétéoSuisse…'
              : 'Aucun avis en vigueur : les feux sont éteints.',
          )}
        </p>
      ) : (
        lit.map((warning) => (
          <div
            key={warning.name}
            className={warning.level >= 3 ? 'lw-row storm' : 'lw-row'}
            data-lakewarn="lit"
          >
            <b>🚨 {tr(lakeWarningText(warning))}</b>
            <div>{tr(warning.text)}</div>
          </div>
        ))
      )}
      {coming.length > 0 ? (
        <>
          <h3>{tr('À venir')}</h3>
          {coming.map((warning) => (
            <div key={`${warning.name}${warning.onset}`} className="lw-row">
              <b>
                {tr(
                  `${warning.name} : ${warning.outlook ? 'prévision d’avis' : `avis de ${lightOf(warning.level).words.toLowerCase()}`} dès ${time(warning.onset)}`,
                )}
              </b>
              <div>{tr(warning.text)}</div>
            </div>
          ))}
        </>
      ) : null}
      {at > 0 ? (
        <p className="nav-hint">
          {tr(`Lu à ${time(at)} · relu toutes les 5 minutes`)}
        </p>
      ) : null}
      <HelpText>
        Les avis de MétéoSuisse pour les lacs suisses (Léman en trois parties,
        Neuchâtel, Bienne, Morat, Joux, Thoune, Zurich, Constance, Lugano,
        Majeur…) allument les feux sur les rives : 40 éclats par minute pour un
        avis de vent fort (rafales de 25 à 33 nœuds, 46 à 60 km/h), 90 par
        minute pour un avis de tempête (34 nœuds et plus). NavIn les lit toutes
        les 5 minutes par le relais, montre une lampe qui clignote au même
        rythme au milieu du lac sur la carte, et sonne quand un avis s’allume
        sur le lac où vous êtes (ou celui de la zone choisie avec NavIn).
        MétéoSuisse publie ces avis sur son site, sans les documenter comme
        données ouvertes : la lecture peut cesser si le site change. Le test est
        dans Réglages › Tests.
      </HelpText>
    </div>
  );
}
