import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import { editRoute, routeSummary } from '../../features/map/routeEditor.ts';
import { SwipeRow } from '../../features/prep/index.ts';
import {
  ListPublishRow,
  openListPublish,
} from '../../features/publish/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate, fmtTime } from '../../lib/format.ts';
import type { NavRoute } from '../../model/routes.ts';
import { routeTimes, routeToGpx } from '../../model/routes.ts';
import { deliver, removeRoute, renameRoute, state } from '../../state/index.ts';

/**
 * Screen `routes`: the routes drawn on the map, a new one, and Partager.
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function RoutesPage() {
  useSignals();
  const tr = useTr();
  const routes = state.data.routes.value.toSorted((a, b) =>
    (b.mod || '').localeCompare(a.mod || ''),
  );
  return (
    <>
      <PageTitle
        helps={[
          'Une route se trace sur la carte de NavIn : touchez la carte pour poser les points dans l’ordre, déplacez-les au doigt, le ＋ au milieu d’un segment le plie, un appui long sur un point le supprime. Chaque segment donne son cap et sa distance ; avec la vitesse et l’heure de départ, chaque point a son heure de passage.',
          'Toucher une route : l’ouvrir sur la carte. Appui long : changer son nom. Glisser vers la gauche : 🗺 Sur la carte, 📤 Partager (texte ou GPX), 🗑 Effacer. Sur la carte, 🎯 Go to mène au prochain point.',
        ]}
      >
        🧭 Routes
      </PageTitle>
      <ButtonRow>
        <Button
          className="btn primary"
          data-rt="new"
          onClick={() => {
            buzz();
            editRoute(null);
          }}
        >
          {tr('＋ Nouvelle route sur la carte')}
        </Button>
      </ButtonRow>
      <section className="field">
        <div id="rtList">
          {routes.length > 0 ? (
            routes.map((route) => <RouteItem key={route.id} route={route} />)
          ) : (
            <p className="help">
              {tr('Aucune route pour l’instant.', { help: true })}
            </p>
          )}
        </div>
      </section>
      <ListPublishRow kind="routes" />
    </>
  );
}

function slug(name: string): string {
  return (
    name
      .normalize('NFD')
      .replaceAll(/[̀-ͯ]/g, '')
      .replaceAll(/[^a-z0-9]+/gi, '-')
      .replaceAll(/^-|-$/g, '')
      .toLowerCase() || 'route'
  );
}

/**
 * One route, a band as a trace: a touch opens it on the map, a long press
 * changes its name in place; swiped, Go to its first point, Partager
 * (texte or GPX) and Effacer.
 * @param props - The route.
 * @param props.route - The route.
 * @returns The band.
 */
function RouteItem({ route }: { route: NavRoute }) {
  const tr = useTr();
  const [editing, setEditing] = useState<string | null>(null);
  const press = useLongPress(() => setEditing(route.name));
  const times = routeTimes(route);
  const start = times
    ? ` · départ ${fmtShortDate(new Date(times[0] as number))} ${fmtTime(new Date(times[0] as number))}`
    : '';
  const auto = route.how === 'auto' ? ' · calculée' : '';
  const save = (text: string) => {
    setEditing(null);
    if (text.trim() && text.trim() !== route.name) renameRoute(route.id, text);
  };
  return (
    <SwipeRow
      id={route.id}
      name={route.name}
      onView={() => {
        buzz();
        editRoute(route.id);
      }}
      viewAs={{ icon: '🗺', label: 'Sur la carte' }}
      onShare={(format) => openListPublish('routes', route.id, format)}
      onGpx={() => {
        void deliver(
          routeToGpx(route),
          `${slug(route.name)}-route.gpx`,
          'application/gpx+xml',
        );
      }}
      onDelete={(id) => {
        removeRoute(id);
      }}
    >
      <div className="section mark-item rt-band" data-route={route.id}>
        {editing === null ? (
          <button
            type="button"
            className={`mark-head${press.hit ? ' lp-hit' : ''}`}
            aria-label={tr(
              `${route.name} · toucher : sur la carte · appui long : changer le nom`,
            )}
            onClick={() => {
              buzz();
              editRoute(route.id);
            }}
            {...press.handlers}
          >
            <span className="mk-pin" aria-hidden="true">
              🧭
            </span>
            <span className="mk-text">
              <b className="b-nm">{route.name}</b>
              <small>{tr(`${routeSummary(route)}${start}${auto}`)}</small>
            </span>
          </button>
        ) : (
          <form
            className="mark-head mark-edit"
            onSubmit={(event) => {
              event.preventDefault();
              save(editing);
            }}
          >
            <span className="mk-pin" aria-hidden="true">
              🧭
            </span>
            <input
              className="text"
              data-rt="text"
              // Opened by a long press, to be written in at once.
              autoFocus
              enterKeyHint="done"
              value={editing}
              aria-label={tr(`Nom de ${route.name}`)}
              onChange={(event) => setEditing(event.target.value)}
              onBlur={() => save(editing)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setEditing(null);
              }}
            />
          </form>
        )}
      </div>
    </SwipeRow>
  );
}
