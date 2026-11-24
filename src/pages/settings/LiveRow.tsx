import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { githubKey } from '../../features/onwater/githubKey.ts';
import type { MeteoZone } from '../../features/zones/meteoZones.ts';
import { meteoZones, zonesText } from '../../features/zones/meteoZones.ts';
import type { ArchiveIndex } from '../../features/zones/stationArchive.ts';
import {
  ARCHIVE_PAGE,
  archiveSending,
  readArchiveIndex,
  sendActiveZones,
} from '../../features/zones/zoneArchiveSync.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { ZoneChoices } from '../tracker/ZoneChoices.tsx';
import {
  liveZoneIds,
  showLiveAround,
  zonePickOpen,
} from '../tracker/liveOnMap.ts';
import { shownIds } from '../tracker/zoneChoice.ts';

const TIME = new Intl.DateTimeFormat('fr-CH', {
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Paramétrages › Alertes › LiveMétéo: every zone of LiveMétéo in one place
 * (the Météo-France zones, coast and offshore, and the Léman), the zones
 * whose stations the map shows (else the zone where the boat is), and the
 * archive GitHub keeps of every badge of those zones.
 * @returns The row.
 */
export function LiveRow() {
  useSignals();
  const tr = useTr();
  const chosen = liveZoneIds();
  const [zones, setZones] = useState<MeteoZone[]>([]);
  useEffect(() => {
    let closed = false;
    void meteoZones().then((read) => {
      if (!closed) setZones(read);
    });
    return () => {
      closed = true;
    };
  }, []);
  const shown = shownIds(zones);
  const names = zones.filter((zone) => shown.has(zone.id));
  return (
    <>
      <h3>{tr('Zones actives')}</h3>
      <p data-live-zones>
        {tr(
          names.length === 0
            ? 'Zone où se trouve le bateau.'
            : `${chosen.length === 0 ? 'Où je suis : ' : ''}${zonesText(names)}`,
        )}
      </p>
      {zones.length === 0 ? (
        <p className="zone-pick-help">{tr('Lecture des zones…')}</p>
      ) : (
        <div className="zone-pick-settings">
          <ZoneChoices zones={zones} />
        </div>
      )}
      <ButtonRow className="row c1">
        <Button
          className="btn"
          onClick={() => {
            zonePickOpen.value = true;
            showLiveAround();
          }}
        >
          {tr('Voir et choisir sur la carte')}
        </Button>
      </ButtonRow>
      <HelpText>
        LiveMétéo montre sur la carte les stations de mesure des zones des
        bulletins de Météo-France : bandes côtières de 20 NM et zones du large,
        et le Léman en une seule zone ; une ou plusieurs, ou un groupe d’un seul
        toucher (aussi par l’appui long sur le bouton de la zone). Seules les
        stations à moins de 500 m de la rive (mer ou Léman) sont gardées.
        L’appui long sur Météo montre celles de la carte affichée.
      </HelpText>
      <ArchiveBlock />
    </>
  );
}

/**
 * The archive GitHub keeps of the badges of the zones active: what NavIn
 * sent, what was read last, a link to it.
 * @returns The block.
 */
function ArchiveBlock() {
  useSignals();
  const tr = useTr();
  const sending = archiveSending.value;
  const key = githubKey();
  const [index, setIndex] = useState<ArchiveIndex | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let closed = false;
    void readArchiveIndex(key).then((read) => {
      if (!closed) setIndex(read);
    });
    return () => {
      closed = true;
    };
  }, [key, sending.sent]);
  const last = index
    ? `Dernier relevé ${TIME.format(new Date(index.at))} : ${index.last.stations} stations (${Object.entries(
        index.last.nets,
      )
        .map(([net, count]) => `${net} ${count}`)
        .join(
          ', ',
        )}) · ${index.days.length} jour${index.days.length > 1 ? 's' : ''} gardé${index.days.length > 1 ? 's' : ''}.`
    : 'Pas encore de relevé lu.';
  return (
    <>
      <h3>{tr('Enregistrement par GitHub')}</h3>
      <p data-zone-archive>
        {tr(
          !key
            ? 'Il faut la clé GitHub (Paramétrages › Clés météos) pour que GitHub enregistre les stations des zones actives.'
            : sending.error
              ? `Zones non envoyées : ${sending.error}.`
              : sending.sent === 'aucune'
                ? 'Aucune zone active envoyée.'
                : sending.sent
                  ? `Zones enregistrées : ${sending.sent.replaceAll(',', ', ')}.`
                  : 'Zones pas encore envoyées.',
        )}
      </p>
      {key ? <p>{tr(last)}</p> : null}
      <ButtonRow className="row c2">
        <Button
          className="btn"
          disabled={!key || busy}
          onClick={() => {
            buzz();
            setBusy(true);
            void sendActiveZones(true).finally(() => setBusy(false));
          }}
        >
          {tr(busy ? 'Envoi…' : 'Envoyer les zones')}
        </Button>
        <Button
          className="btn"
          onClick={() => {
            buzz();
            window.open(ARCHIVE_PAGE, '_blank', 'noopener');
          }}
        >
          {tr('Voir l’archive')}
        </Button>
      </ButtonRow>
      <HelpText>
        Toutes les 30 minutes, GitHub lit toutes les pastilles de la carte
        (bouées et stations) des zones actives et les garde dans la branche
        stations du dépôt navin : un fichier par jour (releves/), avec vent
        moyen, rafales, direction, température et pression. NavIn lui envoie les
        zones dès qu’elles changent ; avec « Où je suis », la zone du bateau est
        revue chaque heure. Météo-France, AEMET, Met Office et MET Norway ne
        sont lus qu’avec leur clé gardée en secret du dépôt (MF_KEY, AEMET_KEY,
        METOFFICE_KEY, FROST_KEY), les METAR, bouées NOAA et Pays-Bas avec
        l’adresse du relais (RELAY_URL).
      </HelpText>
    </>
  );
}
