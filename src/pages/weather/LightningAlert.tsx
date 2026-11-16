import { useSignals } from '@preact/signals-react/runtime';
import { useEffect } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { SiteLink } from '../../components/shared/SiteLink.tsx';
import type { LightningSettings } from '../../features/onwater/lightning.ts';
import {
  LIGHTNING_RADII_NM,
  lightningAlertOn,
  lightningOnMap,
  lightningRadiusNm,
  lightningText,
} from '../../features/onwater/lightning.ts';
import {
  lightningBusy,
  lightningCheck,
  lightningLast,
} from '../../features/onwater/lightningWatch.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { state, updateSettings } from '../../state/index.ts';
import { showLiveAround } from '../tracker/liveOnMap.ts';

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
 * The lightning alert of the Météo menu: on or off, its radius, what the
 * satellite shows now around the zone or the GPS, the map, and the map of
 * Blitzortung to look at in Chrome.
 * @returns The block.
 */
export function LightningAlert() {
  useSignals();
  const tr = useTr();
  const settings = (state.preferences.settings.value.lightning ??
    {}) as LightningSettings;
  const on = lightningAlertOn(settings);
  const radiusNm = lightningRadiusNm(settings);
  const onMap = lightningOnMap(settings);
  const last = lightningLast.value;
  const busy = lightningBusy.value;
  useEffect(() => {
    if (!lightningLast.peek()) void lightningCheck(true);
  }, []);
  return (
    <div className="lightning-alert">
      <ButtonRow className="row c2">
        <Button
          className={on ? 'btn on' : 'btn'}
          data-lightning="toggle"
          onClick={() => change({ on: !on })}
        >
          {tr(`⚡ Alerte foudre : ${on ? 'OUI' : 'NON'}`)}
        </Button>
        <Button className="btn" data-lightning="map" onClick={showLiveAround}>
          {tr('🗺 Voir sur la carte')}
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
      <h3>{tr('Rayon autour de la zone')}</h3>
      <ButtonRow className="row c3">
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
      <p className="lightning-now" role="status" data-lightning="now">
        {busy
          ? tr('Lecture de l’image satellite…')
          : last
            ? tr(lightningText(last, radiusNm))
            : tr('Pas encore d’image satellite lue.')}
      </p>
      <ButtonRow className="row">
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
        l’alerte : Réglages › Tests.
      </HelpText>
      <SiteLink id="blitzortung" />
    </div>
  );
}
