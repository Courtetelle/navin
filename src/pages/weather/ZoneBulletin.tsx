import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { SiteLink } from '../../components/shared/SiteLink.tsx';
import type { BriefingData } from '../../features/onwater/briefing.ts';
import { keptPackets, readBriefing } from '../../features/onwater/briefing.ts';
import {
  lakeWarnState,
  readLakeWarnings,
} from '../../features/onwater/lakeWarnWatch.ts';
import type { LakeWarning } from '../../features/onwater/lakeWarnings.ts';
import { lakeSpot, warningsNear } from '../../features/onwater/lakeWarnings.ts';
import type { ScalePoint } from '../../features/onwater/pointSea.ts';
import { scalePoint } from '../../features/onwater/pointSea.ts';
import { farFromShore, shoreGrid } from '../../features/onwater/shoreFar.ts';
import { readGradient } from '../../features/onwater/zoneGradient.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { distKm } from '../../lib/geo.ts';
import { inInland } from '../../model/contacts.ts';
import { fetchOf } from '../../model/fetchWaves.ts';
import type {
  Bulletin,
  BulletinLevel,
  BulletinTable,
  Gradient,
} from '../../model/zoneBulletin.ts';
import { onLeman, zoneBulletin, zoneKindOf } from '../../model/zoneBulletin.ts';
import { go } from '../../shell/router.ts';

/** What was read for the bulletin. */
interface Read {
  data: BriefingData | null;
  /** Read now; false: the packet kept on the phone. */
  live: boolean;
  gradient: Gradient | null;
  fetchKm: ((from: number) => number | null) | null;
}

const KIND_TEXT: Readonly<Record<ScalePoint['kind'], string>> = {
  'zone-sea': 'lieu de la zone mer choisie dans Paramètres',
  'zone-lake': 'lieu de la zone lac choisie dans Paramètres',
  gps: 'position GPS',
  map: 'lieu de la carte',
  cross: 'point de la croix',
};

/**
 * The lit and coming warnings of MeteoSwiss on the lake of the point.
 * @param warnings - All warnings read.
 * @param point - The point.
 * @returns Those of its lake.
 */
function lakeAlertsAt(
  warnings: readonly LakeWarning[],
  point: ScalePoint,
): LakeWarning[] {
  if (onLeman(point)) return warningsNear(warnings, point);
  return warnings.filter((warning) => {
    const spot = lakeSpot(warning.name);
    return (
      spot != null && distKm(spot.lat, spot.lon, point.lat, point.lon) < 25
    );
  });
}

function openLightning() {
  buzz();
  go('weather', 'lightning');
}

function Table({ table, level }: { table: BulletinTable; level: number }) {
  const tr = useTr();
  const head = (
    <tr>
      {table.head.map((name) => (
        <th key={name}>{tr(name)}</th>
      ))}
    </tr>
  );
  return (
    <div className="zb-scroll">
      <table className="bd-cmp-tbl zb-tbl" data-zb-table={level}>
        <thead>{head}</thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row[0]}>
              {row.map((value, index) => (
                // eslint-disable-next-line react/no-array-index-key -- the columns never move
                <td key={index}>{tr(value)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>{head}</tfoot>
      </table>
    </div>
  );
}

function Level({ level }: { level: BulletinLevel }) {
  const tr = useTr();
  return (
    <section className="zb-level" data-zb-level={level.level}>
      <h3>{tr(`${level.level}. ${level.title}`)}</h3>
      <ul className="zb-lines">
        {level.lines.map((line) => (
          <li key={line}>{tr(line)}</li>
        ))}
      </ul>
      {level.missing.map((line) => (
        <p key={line} className="zb-missing" data-zb-missing>
          {tr(`⚠ ${line}`)}
        </p>
      ))}
      {level.links.length > 0 ? (
        <div className="zb-links">
          {level.links.map((id) =>
            id === 'lightning' ? (
              <Button
                key={id}
                className="btn zb-lightning"
                data-zb-link="lightning"
                onClick={openLightning}
              >
                {tr('⚡ Alerte orage (éclairs vus par satellite)')}
              </Button>
            ) : (
              <SiteLink key={id} id={id} />
            ),
          )}
        </div>
      ) : null}
      {level.table ? <Table table={level.table} level={level.level} /> : null}
    </section>
  );
}

/**
 * The sailing bulletin of the zone, after the general situation: the zone
 * chosen in Paramètres (sea or lake), else the GPS. Five levels, in the
 * universal order (alerts, general situation, wind, sea, weather), with the
 * words of its kind of zone (lake, Channel and Atlantic, Mediterranean).
 * It reads the same forecast as the go / no-go (one request to Open-Meteo,
 * kept 30 minutes) and, on a lake or in Provence, one more for the
 * pressures of the regional winds; offline, the packet kept on the phone.
 * @returns The section.
 */
export function ZoneBulletin() {
  useSignals();
  const tr = useTr();
  const [point] = useState<ScalePoint>(() => scalePoint(null));
  const lake = point.kind === 'zone-lake' || inInland(point);
  const kind = zoneKindOf(point, lake);
  const [read, setRead] = useState<Read | 'reading'>('reading');
  // The hour of the bulletin: when it was read.
  const [now] = useState(() => Date.now());
  useEffect(() => {
    let closed = false;
    if (kind === 'lac' && lakeWarnState.peek().at === 0) {
      void readLakeWarnings();
    }
    void Promise.all([
      readBriefing(point, lake).catch(() => null),
      readGradient(kind),
      lake ? shoreGrid().catch(() => null) : Promise.resolve(null),
    ]).then(([data, gradient, grid]) => {
      if (closed) return;
      const fetchKm = grid
        ? (from: number) =>
            fetchOf(
              (lat, lon) => farFromShore(grid, lat, lon),
              point.lat,
              point.lon,
              from,
            )?.km ?? null
        : null;
      if (data) {
        setRead({ data, live: true, gradient, fetchKm });
        return;
      }
      const kept = keptPackets();
      const packet = kept.full ?? kept.light;
      const near =
        packet && distKm(packet.lat, packet.lon, point.lat, point.lon) < 30
          ? packet
          : null;
      setRead({ data: near, live: false, gradient, fetchKm });
    });
    return () => {
      closed = true;
    };
  }, [point, lake, kind]);
  const { warnings, trouble } = lakeWarnState.value;
  let bulletin: Bulletin | null = null;
  if (read !== 'reading' && read.data) {
    bulletin = zoneBulletin({
      kind,
      lat: point.lat,
      lon: point.lon,
      name: point.name,
      data: read.data,
      now,
      gradient: read.gradient,
      lakeAlerts: trouble ? null : lakeAlertsAt(warnings, point),
      fetchKm: read.fetchKm,
    });
  }
  return (
    <section className="wx-bulletin" data-zb-kind={kind}>
      <h2>{tr('Bulletin de la zone')}</h2>
      <p className="keep-help" data-zb-point>
        {tr(`${point.name} (${KIND_TEXT[point.kind]})`)}
      </p>
      {read === 'reading' ? (
        <p className="keep-help">{tr('Lecture de la prévision…')}</p>
      ) : null}
      {read !== 'reading' && !bulletin ? (
        <p className="zb-missing" data-zb-none>
          {tr(
            '⚠ Prévision indisponible (pas de réseau, ou Open-Meteo en pause après trop de demandes) et aucun paquet gardé pour ce lieu : ouvrez le bulletin officiel.',
          )}
        </p>
      ) : null}
      {read !== 'reading' && !bulletin ? (
        <div className="zb-links">
          <SiteLink
            id={
              kind === 'lac'
                ? 'wx-meteoswiss'
                : kind === 'med'
                  ? 'wx-bms-provence'
                  : 'wx-bms-manche'
            }
          />
        </div>
      ) : null}
      {bulletin ? (
        <>
          <h3 className="zb-title">{tr(bulletin.title)}</h3>
          {read !== 'reading' && !read.live ? (
            <p className="zb-missing" data-zb-offline>
              {tr(
                'Hors réseau : bulletin écrit depuis le paquet gardé sur le téléphone (Go / no-go).',
              )}
            </p>
          ) : null}
          {bulletin.old ? (
            <p className="zb-missing" data-zb-old>
              {tr(
                '⚠ Prévision de plus de 6 h : ancienne, à relire dès que le réseau revient.',
              )}
            </p>
          ) : null}
          {bulletin.levels.map((level) => (
            <Level key={level.level} level={level} />
          ))}
          <div className="zb-links zb-more">
            <h3>{tr('Pour compléter')}</h3>
            {kind === 'lac' ? (
              <SiteLink id="wx-windfinder" />
            ) : (
              <>
                <SiteLink id="wx-mf-marine" />
                <SiteLink id="wx-meteoconsult" />
              </>
            )}
          </div>
          <p className="keep-help" data-zb-source>
            {tr(
              `PRÉVISION, pas une mesure : ${bulletin.source} Unités : vent en nœuds (nd) et force Beaufort, vagues en mètres, clapot en centimètres, périodes en secondes, pression au niveau de la mer en hPa, CAPE et CIN en J/kg.`,
            )}
          </p>
        </>
      ) : null}
    </section>
  );
}
