import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { RefreshButton } from '../../components/shared/RefreshButton.tsx';
import { githubKey } from '../../features/onwater/githubKey.ts';
import type { ScalePoint } from '../../features/onwater/pointSea.ts';
import { scalePoint } from '../../features/onwater/pointSea.ts';
import { useTr } from '../../i18n/useTr.ts';
import type { AnalysisIndex } from '../../model/analysis.ts';
import {
  ANALYSIS_WORKFLOW_PAGE,
  FALLBACK_INDEX,
  GITHUB_KEY_SETTING,
  VERSIONS_DIR,
  dispatchAnalysis,
  dispatchInputs,
  formatPosition,
  isOld,
  readIndex,
  shouldAsk,
  zoneForPoint,
} from '../../model/analysis.ts';
import { go } from '../../shell/router.ts';
import { state } from '../../state/index.ts';

const ASKED_KEY = 'navin-analyse-asked';
const KEPT_KEY = 'navin-analyse-kept';

function readKey(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeKey(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Private window: the choice is not kept, NavIn still works.
  }
}

const base = (): string => import.meta.env.BASE_URL;

/**
 * Keep the newest version of a zone on the phone: its page and maps go to
 * the service worker's analysis cache when fetched once.
 * @param path - Path of its page, relative to `analyse/v/`.
 */
async function keepOffline(path: string): Promise<void> {
  if (readKey(KEPT_KEY).split('|').includes(path)) return;
  const dir = path.slice(0, path.lastIndexOf('/') + 1);
  const listing = await fetch(`${base()}${VERSIONS_DIR}${dir}files.json`);
  if (!listing.ok) return;
  const files = (await listing.json()) as unknown;
  if (!Array.isArray(files)) return;
  for (const file of files) {
    if (typeof file !== 'string' || file.includes('..')) continue;
    // eslint-disable-next-line no-await-in-loop -- one after the other, gently on a phone connection
    await fetch(`${base()}${VERSIONS_DIR}${dir}${file}`).catch(() => null);
  }
  const kept = [path, ...readKey(KEPT_KEY).split('|').filter(Boolean)];
  writeKey(KEPT_KEY, kept.slice(0, 6).join('|'));
}

/** When NavIn last asked for a point, keyed by the point to 0,01°. */
function askedAt(point: ScalePoint): number {
  try {
    const all = JSON.parse(readKey(ASKED_KEY) || '{}') as Record<
      string,
      number
    >;
    return all[`${point.lat.toFixed(2)},${point.lon.toFixed(2)}`] ?? 0;
  } catch {
    return 0;
  }
}

function markAsked(point: ScalePoint, at: number): void {
  let all: Record<string, number> = {};
  try {
    all = JSON.parse(readKey(ASKED_KEY) || '{}') as Record<string, number>;
  } catch {
    all = {};
  }
  all[`${point.lat.toFixed(2)},${point.lon.toFixed(2)}`] = at;
  writeKey(ASKED_KEY, JSON.stringify(all));
}

const KIND_TEXT: Readonly<Record<ScalePoint['kind'], string>> = {
  'zone-sea': 'lieu de la zone mer choisie dans Paramètres',
  'zone-lake': 'lieu de la zone lac choisie dans Paramètres',
  gps: 'position GPS',
  map: 'lieu de la carte',
  cross: 'point de la croix',
};

/**
 * The analysis from the hemisphere down to the local scale, for the point
 * the forecasts use: the place of the zone chosen in the settings (sea or
 * lake), else the GPS position (Corban, 21/11/2026: no list of fixed zones).
 * NavIn's workflow makes a new version at each new ECMWF or DWD run; every
 * version stays available, chosen by date and time. When the point has no
 * recent version (zone moved, new place), NavIn asks for one by itself if a
 * GitHub key is kept, else « Relancer » opens the workflow page.
 * @returns The section.
 */
export function AnalysisLinks() {
  useSignals();
  const tr = useTr();
  const [point, setPoint] = useState<ScalePoint>(() => scalePoint(null));
  const [index, setIndex] = useState<AnalysisIndex>(FALLBACK_INDEX);
  const [versionId, setVersionId] = useState('');
  const [status, setStatus] = useState('');
  const kept = state.preferences.settings.value.windAlert?.[GITHUB_KEY_SETTING];
  const token = typeof kept === 'string' ? kept : '';
  const [now, setNow] = useState(() => Date.now());

  async function ask(here: ScalePoint, key: string, auto: boolean) {
    const inputs = dispatchInputs({
      lat: here.lat,
      lon: here.lon,
      nom: here.name,
    });
    if (!key) {
      if (auto) return;
      globalThis.open(ANALYSIS_WORKFLOW_PAGE, '_blank', 'noopener');
      setStatus(
        `Sur GitHub : « Run workflow », latitude ${inputs.lat}, longitude ${inputs.lon}, nom « ${here.name} », puis « Run workflow ». Nouvelle version dans 15 à 25 min ; touchez ensuite Actualiser.`,
      );
      return;
    }
    setStatus(
      auto
        ? `Nouvelle analyse demandée pour ${here.name}…`
        : 'Demande envoyée à GitHub…',
    );
    const error = await dispatchAnalysis(key, inputs);
    if (!error) markAsked(here, Date.now());
    setStatus(
      error
        ? `Relance impossible : ${error}.`
        : `Analyse demandée pour ${here.name} : prête dans 15 à 25 min, touchez alors Actualiser. Elle sera ensuite refaite seule à chaque nouveau run pendant 7 jours.`,
    );
  }

  function show(found: AnalysisIndex, here: ScalePoint) {
    setIndex(found);
    setVersionId('');
    const at = Date.now();
    setNow(at);
    const id = zoneForPoint(found, here.lat, here.lon);
    const latest = id ? found.zones[id]?.versions[0] : undefined;
    if (latest && !latest.claude) {
      void keepOffline(latest.path).catch(() => null);
    }
    if (
      shouldAsk(latest && !latest.claude ? latest.at : null, askedAt(here), at)
    ) {
      void ask(here, githubKey(), true);
    }
  }

  async function refresh() {
    const here = scalePoint(null);
    setPoint(here);
    setStatus('Lecture de la liste des versions…');
    const found = await readIndex(base());
    if (!found) {
      setStatus(
        navigator.onLine
          ? 'Pas encore de version automatique en ligne.'
          : 'Pas de réseau : versions gardées sur l’appareil.',
      );
      return;
    }
    show(found, here);
    setStatus(`Liste à jour (${found.updated ?? 'heure inconnue'}).`);
  }

  useEffect(() => {
    let closed = false;
    // A key pasted here before moves to the weather keys of Paramétrages.
    githubKey();
    const here = scalePoint(null);
    void readIndex(base()).then((found) => {
      if (!closed && found) show(found, here);
    });
    return () => {
      closed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the section opens
  }, []);

  const zoneId = zoneForPoint(index, point.lat, point.lon);
  const versions = (zoneId ? index.zones[zoneId]?.versions : undefined) ?? [];
  const version =
    versions.find((item) => item.id === versionId) ?? versions[0] ?? null;
  const old = version ? isOld(version, now) : true;

  return (
    <section className="wx-analysis" data-analysis={old ? 'old' : 'fresh'}>
      <h2>{tr('Situation générale')}</h2>
      <p className="keep-help">
        {tr(
          'De l’hémisphère au local : jets, fronts, échelle régionale, vent, vagues et courants toutes les 3 h, cartes avec annotations par boutons. NAVIn la refait seul à chaque nouveau run ECMWF ou DWD ; cartes, chiffres et texte sont produits par des scripts, sans IA.',
        )}
      </p>
      <p className="keep-help" data-analysis-point={point.kind}>
        <b>{tr(`Pour : ${point.name}`)}</b>{' '}
        {tr(
          `(${KIND_TEXT[point.kind]}, ${formatPosition(point.lat, point.lon)})`,
        )}
      </p>
      {versions.length > 0 ? (
        <div className="wx-analysis-pick">
          <label>
            {tr('Version')}{' '}
            <select
              data-analysis-version
              value={version?.id ?? ''}
              onChange={(event) => setVersionId(event.target.value)}
            >
              {versions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <p className="keep-help" data-analysis-none>
          {tr(
            token
              ? 'Pas encore d’analyse pour ce lieu : NAVIn la demande, elle arrive dans 15 à 25 min.'
              : 'Pas encore d’analyse pour ce lieu : touchez « Faire l’analyse de ce lieu ».',
          )}
        </p>
      )}
      {version ? (
        <div className="page-links">
          <a
            className={old ? 'btn page-link wx-analysis-old' : 'btn page-link'}
            data-page-link="analysis-offline"
            href={`${base()}${VERSIONS_DIR}${version.path}`}
            target="_blank"
            rel="noopener"
          >
            <span className="page-link-ico" aria-hidden="true">
              🗺
            </span>
            <span className="page-link-txt">
              <b>{tr('Ouvrir l’analyse')}</b>
              <small>
                {tr(
                  old
                    ? `version du ${version.label}, ancienne : actualisez ou relancez`
                    : `version du ${version.label}, gardée sur l’appareil`,
                )}
              </small>
            </span>
            <span className="page-link-go" aria-hidden="true">
              ›
            </span>
          </a>
        </div>
      ) : null}
      <div className="wx-analysis-actions">
        <RefreshButton
          data-analysis="refresh"
          label="↻ Actualiser"
          onRefresh={refresh}
        />
        <button
          type="button"
          className="btn"
          data-analysis="rerun"
          onClick={() => {
            const here = scalePoint(null);
            setPoint(here);
            void ask(here, token, false);
          }}
        >
          ▶{' '}
          {tr(version ? 'Relancer pour ce lieu' : 'Faire l’analyse de ce lieu')}
        </button>
      </div>
      {status ? (
        <p className="keep-help" role="status" data-analysis-status>
          {tr(status)}
        </p>
      ) : null}
      <p className="keep-help wx-analysis-key">
        {tr(
          token
            ? 'Clé GitHub enregistrée : NAVIn demande seul l’analyse quand la zone change ou quand la dernière a plus de 6 h.'
            : 'Sans clé GitHub, « Faire l’analyse de ce lieu » ouvre la page GitHub de l’analyse. Avec une clé, NAVIn la demande seul.',
        )}{' '}
        <button
          type="button"
          className="btn"
          data-analysis="keys"
          onClick={() => go('settings', 'keys')}
        >
          🔑 {tr('Clé GitHub : Clés météos et compte relais')}
        </button>
      </p>
    </section>
  );
}
