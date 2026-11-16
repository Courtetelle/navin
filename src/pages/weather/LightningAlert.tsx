import { useSignals } from '@preact/signals-react/runtime';
import { useEffect } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { ExitIcon } from '../../components/shared/ExitIcon.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { SettingsIcon } from '../../components/shared/SettingsIcon.tsx';
import { SiteLink } from '../../components/shared/SiteLink.tsx';
import { askMapArea } from '../../features/map/pendingArea.ts';
import type { LightningSettings } from '../../features/onwater/lightning.ts';
import {
  LIGHTNING_RADII_NM,
  lightningAlertOn,
  lightningOnMap,
  lightningRadiusNm,
  lightningText,
  stormView,
} from '../../features/onwater/lightning.ts';
import {
  lightningBusy,
  lightningCheck,
  lightningLast,
  nearestStorm,
} from '../../features/onwater/lightningWatch.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { exitOrigin } from '../../shell/exitOrigin.ts';
import { go } from '../../shell/router.ts';
import { state, toast, updateSettings } from '../../state/index.ts';

function change(patch: LightningSettings): void {
  buzz();
  updateSettings((settings) => {
    settings.lightning = {
      ...(settings.lightning as LightningSettings | undefined),
      ...patch,
    };
  });
  // The new radius looked at at once.
  void lightningCheck(true);
}

/**
 * To the map, on the nearest flashes from the GPS (or the zone chosen with
 * NavIn), the boat and them in view.
 */
async function toNearestStorm(): Promise<void> {
  buzz();
  toast('Recherche de l’orage le plus proche…');
  const { place, storm } = await nearestStorm();
  if (!storm) {
    toast('Aucun éclair à moins de 400 km');
    askMapArea({ ...place, km: 30 });
  } else {
    askMapArea(stormView(place, storm));
  }
  go('tracker');
}

/**
 * The lightning alert of the Météo menu: what the satellite shows now
 * around the GPS or the zone, the map on the nearest flashes, the way to
 * its settings, and the map of Blitzortung.
 * @returns The block.
 */
export function LightningAlert() {
  useSignals();
  const tr = useTr();
  const settings = (state.preferences.settings.value.lightning ??
    {}) as LightningSettings;
  const radiusNm = lightningRadiusNm(settings);
  const last = lightningLast.value;
  const busy = lightningBusy.value;
  useEffect(() => {
    if (!lightningLast.peek()) void lightningCheck(true);
  }, []);
  return (
    <div className="lightning-alert">
      <p className="lightning-now" role="status" data-lightning="now">
        {busy
          ? tr('Lecture de l’image satellite…')
          : last
            ? tr(lightningText(last, radiusNm))
            : tr('Pas encore d’image satellite lue.')}
      </p>
      <ButtonRow className="row c2">
        <Button
          className="btn"
          data-lightning="map"
          onClick={() => {
            void toNearestStorm();
          }}
        >
          {tr('🗺 Voir sur la carte')}
        </Button>
        <Button
          className="btn"
          data-lightning="look"
          disabled={busy}
          onClick={() => {
            buzz();
            void lightningCheck(true);
          }}
        >
          {tr('↻ Regarder maintenant')}
        </Button>
      </ButtonRow>
      <HelpText>
        NavIn regarde toutes les 5 minutes les éclairs vus par le satellite
        européen MTG (EUMETSAT) autour de la zone choisie avec NavIn, sinon de
        la position GPS. Il sonne trois bips courts et l’écrit dans le journal
        quand des éclairs entrent dans le rayon, puis s’ils se rapprochent
        nettement ou sont encore là 15 minutes après. L’image arrive avec
        environ 10 minutes de retard et montre des zones d’activité, pas chaque
        impact : c’est une aide, pas un système d’alerte officiel. Sur la carte
        de NavIn, les éclairs des 20 dernières minutes sont toujours affichés,
        sans rien demander, même alerte coupée : les plus récents vifs, ceux de
        10 et 20 minutes plus pâles, pour voir où va l’orage ; jaune pour 1
        éclair en 5 minutes, rouge foncé pour 20 et plus. Pour entendre et voir
        l’alerte : Paramétrages › Tests. « Voir sur la carte » montre l’orage le
        plus proche de la position GPS (ou de la zone choisie avec NavIn),
        cherché jusqu’à 400 km.
      </HelpText>
      <Button
        className="btn big wx-entry wx-keys-link"
        data-lightning="settings"
        aria-label={tr(
          'Paramétrage des alertes foudre : sortir vers Paramétrages',
        )}
        onClick={() => {
          buzz();
          toast('Vous sortez de Météorologie : Paramétrages');
          exitOrigin.value = { view: 'weather', arg: 'lightning' };
          go('settings', 'lightning');
        }}
      >
        <ExitIcon />
        <span>
          <b className="wx-settings-title">
            <SettingsIcon className="wx-settings-ico" />
            {tr('Paramétrage des alertes foudre')}
          </b>
          <small>
            {tr(
              'alerte oui ou non, éclairs sur la carte, distance de l’alerte',
            )}
          </small>
        </span>
      </Button>
      <SiteLink id="blitzortung" />
    </div>
  );
}

/**
 * The settings of the lightning alert (Paramétrages): on or off, the
 * flashes always on the map, the distance from which it sounds.
 * @returns The block.
 */
export function LightningSetting() {
  useSignals();
  const tr = useTr();
  const settings = (state.preferences.settings.value.lightning ??
    {}) as LightningSettings;
  const on = lightningAlertOn(settings);
  const radiusNm = lightningRadiusNm(settings);
  const onMap = lightningOnMap(settings);
  return (
    <div className="lightning-alert">
      <ButtonRow className="row">
        <Button
          className={on ? 'btn on' : 'btn'}
          data-lightning="toggle"
          onClick={() => change({ on: !on })}
        >
          {tr(`⚡ Alerte foudre : ${on ? 'OUI' : 'NON'}`)}
        </Button>
      </ButtonRow>
      <ButtonRow className="row">
        <Button
          className={onMap ? 'btn on' : 'btn'}
          data-lightning="onmap"
          onClick={() => change({ map: !onMap })}
        >
          {tr(`🗺 Éclairs toujours sur la carte : ${onMap ? 'OUI' : 'NON'}`)}
        </Button>
      </ButtonRow>
      <h3>{tr('L’alerte se donne à partir de')}</h3>
      <ButtonRow className="row c4">
        {LIGHTNING_RADII_NM.map((value) => (
          <Button
            key={value}
            className={value === radiusNm ? 'btn on' : 'btn'}
            data-lightning-radius={value}
            onClick={() => change({ radiusNm: value })}
          >
            {tr(`${value} NM`)}
          </Button>
        ))}
      </ButtonRow>
      <p className="nav-hint">
        {tr(
          'Autour de la position GPS, ou de la zone choisie avec NavIn (Atlantique, Méditerranée, Lacs).',
        )}
      </p>
    </div>
  );
}
