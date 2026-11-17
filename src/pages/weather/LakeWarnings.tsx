import { useSignals } from '@preact/signals-react/runtime';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { ExitIcon } from '../../components/shared/ExitIcon.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { SettingsIcon } from '../../components/shared/SettingsIcon.tsx';
import { askMapArea } from '../../features/map/pendingArea.ts';
import type { LakeWarnSettings } from '../../features/onwater/lakeWarnWatch.ts';
import {
  lakeWarnState,
  readLakeWarnings,
} from '../../features/onwater/lakeWarnWatch.ts';
import {
  LIGHT_MEANINGS,
  lakeArea,
  lightOf,
  litWarnings,
} from '../../features/onwater/lakeWarnings.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { exitOrigin } from '../../shell/exitOrigin.ts';
import { go } from '../../shell/router.ts';
import { state, toast, updateSettings } from '../../state/index.ts';

const TROUBLES: Readonly<Record<string, string>> = {
  'no-relay':
    'Il faut le relais (Paramétrages › Clés météo › Relais des METAR et bouées) : MétéoSuisse ne laisse pas une appli lire ses avis directement.',
  'old-relay':
    'Le relais doit être mis à jour : Paramétrages › Clés météo › « 📋 Copier le code du relais », puis sur Cloudflare « Modifier le code », tout remplacer et « Déployer ».',
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
      {trouble ? (
        <p className="lw-trouble" role="status">
          {tr(TROUBLES[trouble] ?? '')}
        </p>
      ) : null}
      <h3>{tr('Feux allumés')}</h3>
      {lit.length === 0 ? (
        <p data-lakewarn="none">
          {tr(
            trouble === 'no-relay' || trouble === 'old-relay'
              ? 'Avis non lus : voir ci-dessus.'
              : busy || at === 0
                ? 'Lecture des avis de MétéoSuisse…'
                : 'Aucun avis en vigueur : les feux sont éteints.',
          )}
        </p>
      ) : (
        lit.map((warning) => {
          const { words, perMinute } = lightOf(warning.level);
          return (
            <button
              type="button"
              key={warning.name}
              className={
                warning.level >= 3 ? 'lw-row lw-go storm' : 'lw-row lw-go'
              }
              data-lakewarn="lit"
              data-band-id={`lake:${warning.name}`}
              aria-label={tr(`${warning.name} : voir le feu sur la carte`)}
              onClick={() => {
                const area = lakeArea(warning.name);
                if (!area) {
                  toast('Ce lac n’est pas encore placé sur la carte');
                  return;
                }
                buzz();
                askMapArea(area);
                go('tracker');
              }}
            >
              <Lamp perMinute={perMinute} />
              <div>
                <b>{tr(`${warning.name} · ${words}`)}</b>
                <div>
                  {tr(
                    `feux ${perMinute} éclats/min · de ${time(warning.onset)} à ${time(warning.expires)}`,
                  )}
                </div>
                <div>{tr(warning.text)}</div>
                <small className="lw-go-hint">
                  {tr('🗺 toucher : le feu sur la carte')}
                </small>
              </div>
            </button>
          );
        })
      )}
      {coming.length > 0 ? (
        <>
          <h3>{tr('À venir')}</h3>
          {coming.map((warning) => (
            <div key={`${warning.name}${warning.onset}`} className="lw-row">
              <div>
                <b>
                  {tr(
                    `${warning.name} · ${warning.outlook ? 'prévision d’avis' : lightOf(warning.level).words} dès ${time(warning.onset)}`,
                  )}
                </b>
                <div>{tr(warning.text)}</div>
              </div>
            </div>
          ))}
        </>
      ) : null}
      <ButtonRow className="row">
        <Button
          className="btn"
          data-lakewarn="read"
          disabled={busy}
          onClick={() => {
            buzz();
            read();
          }}
        >
          {tr('↻ Actualiser maintenant')}
        </Button>
      </ButtonRow>
      {at > 0 ? (
        <p className="nav-hint">
          {tr(`Lu à ${time(at)} · relu toutes les 5 minutes`)}
        </p>
      ) : null}
      <HelpText>
        NavIn lit toutes les 5 minutes par le relais les avis de MétéoSuisse
        pour les lacs suisses. Sur la carte, une lampe clignote au rythme des
        feux au milieu de chaque lac en alerte. L’alarme et la bulle ne
        concernent que la partie du Léman où vous êtes, d’après le GPS.
        MétéoSuisse publie ces avis sur son site sans les documenter comme
        données ouvertes : la lecture peut cesser si le site change. L’alerte
        oui ou non et le sens des feux sont dans Paramétrages › Paramétrage des
        feux d’avis des lacs ; le test dans Paramétrages › Tests.
      </HelpText>
      <Button
        className="btn big wx-entry wx-keys-link"
        data-lakewarn="settings"
        data-settings-exit
        aria-label={tr(
          'Paramétrage des feux d’avis des lacs : sortir vers Paramétrages',
        )}
        onClick={() => {
          buzz();
          toast('Vous sortez de Météorologie : Paramétrages');
          exitOrigin.value = { view: 'weather', arg: 'lakelights' };
          go('settings', 'lakes');
        }}
      >
        <ExitIcon />
        <span>
          <b className="wx-settings-title">
            <SettingsIcon className="wx-settings-ico" />
            {tr('Paramétrage des feux d’avis des lacs')}
          </b>
          <small>{tr('l’alerte oui ou non, le sens des feux')}</small>
        </span>
      </Button>
    </div>
  );
}

/**
 * The setting of the warning lights of the lakes (Paramétrages): the alert on
 * or off, and what the lights on the shores mean.
 * @returns The block.
 */
export function LakeWarnSetting() {
  useSignals();
  const tr = useTr();
  const settings = (state.preferences.settings.value.lakeWarn ??
    {}) as LakeWarnSettings;
  const on = settings.on !== false;
  return (
    <div className="lake-warn-list">
      <ButtonRow className="row">
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
      </ButtonRow>
      <h3>{tr('Le sens des feux sur les rives')}</h3>
      {LIGHT_MEANINGS.map((meaning) => (
        <div
          key={meaning.level}
          className={meaning.level >= 3 ? 'lw-row storm' : 'lw-row'}
          data-lakewarn="meaning"
        >
          <Lamp perMinute={meaning.perMinute} />
          <div>
            <b>{tr(`${meaning.perMinute} éclats/min · ${meaning.title}`)}</b>
            <div>{tr(meaning.text)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A lamp flashing as the warning lights.
 * @param props - Its rhythm.
 * @param props.perMinute - Flashes per minute.
 * @returns The lamp.
 */
function Lamp({ perMinute }: { perMinute: number }) {
  return (
    <span
      className="lw-lamp lw-lamp-row"
      aria-hidden="true"
      style={{ '--blink': `${60 / perMinute}s` } as CSSProperties}
    />
  );
}
