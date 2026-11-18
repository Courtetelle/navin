import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { ExitIcon } from '../../components/shared/ExitIcon.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { RefreshButton } from '../../components/shared/RefreshButton.tsx';
import { SettingsIcon } from '../../components/shared/SettingsIcon.tsx';
import { SiteLink } from '../../components/shared/SiteLink.tsx';
import { askMapArea } from '../../features/map/pendingArea.ts';
import type { LightningSettings } from '../../features/onwater/lightning.ts';
import {
  lightningAlertOn,
  lightningOnMap,
  lightningRadii,
  lightningRadiusNm,
  lightningText,
  stormLines,
  stormView,
} from '../../features/onwater/lightning.ts';
import {
  lightningBusy,
  lightningCheck,
  lightningLast,
  lightningNearest,
  lightningRefresh,
  nearestBusy,
  nearestStorm,
} from '../../features/onwater/lightningWatch.ts';
import { onLake } from '../../features/onwater/onLake.ts';
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
  const { place, storm } = await nearestStorm(true);
  if (!storm) {
    toast('Aucun éclair à moins de 216 NM');
    askMapArea({ ...place, km: 30 });
  } else {
    askMapArea(stormView(place, storm));
  }
  go('tracker');
}

/** The guess of where the storm is now is said again this often. */
const TICK_MS = 60_000;

/**
 * The nearest storm, wherever it is: its distance, where, its position, how
 * fast it comes nearer and when it is on the boat (the delay of the image
 * counted).
 * @returns The block.
 */
function NearestStormBlock() {
  useSignals();
  const tr = useTr();
  const found = lightningNearest.value;
  const busy = nearestBusy.value;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  let lines: string[];
  if (!found) {
    lines = [busy ? 'Recherche de l’orage le plus proche…' : ''];
  } else if (!found.storm || found.report?.nearestKm == null) {
    lines = ['Aucun éclair à moins de 216 NM.'];
  } else {
    lines = stormLines(found.report, now);
  }
  return (
    <div className="lightning-nearest" data-lightning="nearest" role="status">
      {lines.filter(Boolean).map((line) => (
        <p key={line}>{tr(line)}</p>
      ))}
    </div>
  );
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
  const radiusNm = lightningRadiusNm(settings, onLake());
  const last = lightningLast.value;
  const busy = lightningBusy.value;
  useEffect(() => {
    if (!lightningLast.peek()) void lightningCheck(true);
    void nearestStorm(true);
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
      <NearestStormBlock />
      <ButtonRow className="row">
        <Button
          className="btn"
          data-lightning="map"
          onClick={() => {
            void toNearestStorm();
          }}
        >
          {tr('🗺 Voir sur la carte')}
        </Button>
      </ButtonRow>
      <ButtonRow className="row">
        <RefreshButton
          data-lightning="look"
          busy={busy || nearestBusy.value}
          onRefresh={lightningRefresh}
        />
      </ButtonRow>
      <HelpText>
        NavIn regarde toutes les 5 minutes les éclairs vus par le satellite
        européen MTG (EUMETSAT) autour de la zone choisie avec NavIn, sinon de
        la position GPS. Il sonne trois bips courts et l’écrit dans le journal
        quand des éclairs entrent dans le rayon, puis s’ils se rapprochent
        nettement ou sont encore là 15 minutes après. L’image arrive avec 10 à
        30 minutes de retard et montre des zones d’activité, pas chaque impact :
        c’est une aide, pas un système d’alerte officiel. Sur la carte de NavIn,
        les éclairs des 20 dernières minutes sont toujours affichés, sans rien
        demander, même alerte coupée : les plus récents vifs, ceux de 10 et 20
        minutes plus pâles, pour voir où va l’orage ; jaune pour 1 éclair en 5
        minutes, rouge foncé pour 20 et plus. Pour entendre et voir l’alerte :
        Paramétrages › Tests. « Voir sur la carte » montre l’orage le plus
        proche de la position GPS (ou de la zone choisie avec NavIn), cherché
        jusqu’à 216 NM. Le déplacement des orages est mesuré sur les images des
        45 dernières minutes, à au moins 80 NM autour : les éclairs récents sont
        posés sur ceux de 10, 15… 45 minutes avant, et la vitesse est la droite
        qui passe par tous. Les orages d’une même région vont avec le même vent
        d’altitude ; parmi plusieurs cellules orageuses, NavIn retient celle qui
        sera la première sur vous (la plus proche et la plus rapide pesées
        ensemble) : il peut donc changer d’orage d’un regard à l’autre. L’heure
        de la dernière image est demandée au serveur (elle a de 10 à 30 minutes
        de retard). Au-dessus des boutons : sa distance, sa position, sa vitesse
        de rapprochement et la durée jusqu’à vous ; le retard de l’image est
        compté, la distance est estimée pour maintenant. Une seconde alerte
        sonne quand l’orage passe sous la moitié de votre distance d’alerte, et
        une fin d’alerte quand il n’y a plus d’éclairs depuis 30 minutes. Plus
        d’alerte pour un orage qui s’éloigne, ni pour un orage déjà sur vous.
        Sur la carte, la flèche jaune relie votre position (le GPS ou la zone
        active) à l’orage, avec sa distance ; la flèche rouge montre son
        déplacement.
      </HelpText>
      <SiteLink id="blitzortung" />
      <Button
        className="btn big wx-entry wx-keys-link"
        data-lightning="settings"
        data-settings-exit
        aria-label={tr(
          'Paramétrage des alertes orage : sortir vers Paramétrages',
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
            {tr('Paramétrage des alertes orage')}
          </b>
          <small>
            {tr(
              'alerte oui ou non, éclairs sur la carte, distance de l’alerte',
            )}
          </small>
        </span>
      </Button>
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
  const lake = onLake();
  const radiusNm = lightningRadiusNm(settings, lake);
  const onMap = lightningOnMap(settings);
  return (
    <div className="lightning-alert">
      <ButtonRow className="row">
        <Button
          className={on ? 'btn on' : 'btn'}
          data-lightning="toggle"
          onClick={() => change({ on: !on })}
        >
          {tr(`⚡ Alerte orage : ${on ? 'OUI' : 'NON'}`)}
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
      <h3>
        {tr(
          lake
            ? 'Sur un lac, l’alerte se donne à partir de'
            : 'En mer, l’alerte se donne à partir de',
        )}
      </h3>
      <ButtonRow className="row c4">
        {lightningRadii(lake).map((value) => (
          <Button
            key={value}
            className={value === radiusNm ? 'btn on' : 'btn'}
            data-lightning-radius={value}
            onClick={() =>
              change(lake ? { radiusLakeNm: value } : { radiusNm: value })
            }
          >
            {tr(`${value} NM`)}
          </Button>
        ))}
      </ButtonRow>
      <p className="nav-hint">
        {tr(
          'Autour de la position GPS, ou de la zone choisie avec NavIn (Atlantique, Méditerranée, Lacs). Les lacs ont leurs propres distances, plus courtes (15 NM par défaut) ; la mer garde les siennes (30 NM par défaut).',
        )}
      </p>
    </div>
  );
}
