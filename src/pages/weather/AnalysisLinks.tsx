import { useEffect, useState } from 'react';

import { RefreshButton } from '../../components/shared/RefreshButton.tsx';
import { useTr } from '../../i18n/useTr.ts';
import type { AnalysisIndex } from '../../model/analysis.ts';
import {
  ANALYSIS_WORKFLOW_PAGE,
  FALLBACK_INDEX,
  VERSIONS_DIR,
  ZONE_NAMES,
  dispatchAnalysis,
  dispatchInputs,
  formatPosition,
  isOld,
  readIndex,
  zoneIds,
} from '../../model/analysis.ts';

const ZONE_KEY = 'navin-analyse-zone';
const TOKEN_KEY = 'navin-gh-token';
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

/**
 * The analysis from the hemisphere down to the bay. NavIn's workflow makes
 * a new version by itself each time ECMWF or DWD publish a new run; every
 * version stays available, chosen by date and time. « Actualiser » reads the
 * newest list, « Relancer » asks for a new version now (a test zone or the
 * current GPS position).
 * @returns The section.
 */
export function AnalysisLinks() {
  const tr = useTr();
  const [index, setIndex] = useState<AnalysisIndex>(FALLBACK_INDEX);
  const [zone, setZone] = useState(() => readKey(ZONE_KEY) || 'saint-quay');
  const [versionId, setVersionId] = useState('');
  const [status, setStatus] = useState('');
  const [token, setToken] = useState(() => readKey(TOKEN_KEY));
  const [now, setNow] = useState(() => Date.now());

  function show(found: AnalysisIndex) {
    setIndex(found);
    setVersionId('');
    setNow(Date.now());
    const zoneNow = found.zones[readKey(ZONE_KEY) || 'saint-quay'];
    const latest = zoneNow?.versions[0];
    if (latest && !latest.claude) {
      void keepOffline(latest.path).catch(() => null);
    }
  }

  async function refresh() {
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
    show(found);
    setStatus(`Liste à jour (${found.updated ?? 'heure inconnue'}).`);
  }

  useEffect(() => {
    let closed = false;
    void readIndex(base()).then((found) => {
      if (!closed && found) show(found);
    });
    return () => {
      closed = true;
    };
  }, []);

  const ids = zoneIds(index);
  const zoneId = index.zones[zone] ? zone : (ids[0] ?? 'saint-quay');
  const current = index.zones[zoneId] ?? FALLBACK_INDEX.zones['saint-quay'];
  const versions = current?.versions ?? [];
  const version =
    versions.find((item) => item.id === versionId) ?? versions[0] ?? null;

  const old = version ? isOld(version, now) : true;
  const href = version
    ? `${base()}${VERSIONS_DIR}${version.path}`
    : `${base()}analyse/saint-quay/index.html`;

  async function rerun(target: string | { lat: number; lon: number }) {
    const inputs = dispatchInputs(target);
    if (!token) {
      globalThis.open(ANALYSIS_WORKFLOW_PAGE, '_blank', 'noopener');
      setStatus(
        typeof target === 'string'
          ? `Sur GitHub : « Run workflow », zone « ${target} », puis « Run workflow ». Nouvelle version dans 15 à 25 min ; touchez ensuite Actualiser.`
          : `Sur GitHub : « Run workflow », latitude ${inputs.lat}, longitude ${inputs.lon}, puis « Run workflow ». Nouvelle version dans 15 à 25 min ; touchez ensuite Actualiser.`,
      );
      return;
    }
    setStatus('Demande envoyée à GitHub…');
    const error = await dispatchAnalysis(token, inputs);
    setStatus(
      error
        ? `Relance impossible : ${error}.`
        : 'Relance demandée : nouvelle version dans 15 à 25 min, touchez alors Actualiser.',
    );
  }

  function rerunHere() {
    if (!('geolocation' in navigator)) {
      setStatus('Pas de GPS sur cet appareil.');
      return;
    }
    setStatus('Lecture de la position…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setStatus(`Position ${formatPosition(lat, lon)}.`);
        void rerun({ lat, lon });
      },
      () => setStatus('Position non disponible.'),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 300_000 },
    );
  }

  return (
    <section className="wx-analysis" data-analysis={old ? 'old' : 'fresh'}>
      <h2>{tr('Situation générale')}</h2>
      <p className="keep-help">
        {tr(
          'De l’hémisphère au local : jets, fronts, échelle régionale, zone, vent, vagues et courants toutes les 3 h, cartes avec annotations par boutons. NAVIn la refait seul à chaque nouveau run ECMWF ou DWD ; cartes, chiffres et texte sont produits par des scripts, sans IA.',
        )}
      </p>
      <div className="wx-analysis-pick">
        <label>
          {tr('Zone')}{' '}
          <select
            data-analysis-zone
            value={zoneId}
            onChange={(event) => {
              setZone(event.target.value);
              writeKey(ZONE_KEY, event.target.value);
              setVersionId('');
            }}
          >
            {ids.map((id) => (
              <option key={id} value={id}>
                {index.zones[id]?.nom ?? ZONE_NAMES[id] ?? id}
              </option>
            ))}
          </select>
        </label>
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
      <div className="page-links">
        <a
          className={old ? 'btn page-link wx-analysis-old' : 'btn page-link'}
          data-page-link="analysis-offline"
          href={href}
          target="_blank"
          rel="noopener"
        >
          <span className="page-link-ico" aria-hidden="true">
            🗺
          </span>
          <span className="page-link-txt">
            <b>{tr(`Ouvrir l’analyse, ${current?.nom ?? ''}`)}</b>
            <small>
              {version
                ? tr(
                    old
                      ? `version du ${version.label}, ancienne : actualisez ou relancez`
                      : `version du ${version.label}, gardée sur l’appareil`,
                  )
                : ''}
            </small>
          </span>
          <span className="page-link-go" aria-hidden="true">
            ›
          </span>
        </a>
      </div>
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
          onClick={() =>
            void rerun(zoneId.startsWith('gps-') ? 'saint-quay' : zoneId)
          }
        >
          ▶ {tr('Relancer cette zone')}
        </button>
        <button
          type="button"
          className="btn"
          data-analysis="rerun-gps"
          onClick={rerunHere}
        >
          ⌖ {tr('Relancer à ma position')}
        </button>
      </div>
      {status ? (
        <p className="keep-help" role="status" data-analysis-status>
          {tr(status)}
        </p>
      ) : null}
      <details className="wx-analysis-key">
        <summary>
          {tr('Relancer directement depuis NAVIn (clé GitHub)')}
        </summary>
        <p className="keep-help">
          {tr(
            'Sans clé, « Relancer » ouvre la page GitHub de l’analyse (bouton « Run workflow »). Avec une clé GitHub à droits fins limitée au dépôt navin (Actions : lecture et écriture), NAVIn la lance lui-même. La clé reste sur cet appareil.',
          )}
        </p>
        <input
          type="password"
          autoComplete="off"
          data-analysis-token
          placeholder={tr.placeholder('github_pat_…')}
          value={token}
          onChange={(event) => {
            setToken(event.target.value.trim());
            writeKey(TOKEN_KEY, event.target.value.trim());
          }}
        />
      </details>
    </section>
  );
}
