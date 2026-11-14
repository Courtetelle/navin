import { signal } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLongPress } from '../../components/shared/useLongPress.ts';
import { beginCrewSetEdit } from '../../features/crew/crewsEdit.ts';
import { openFiche } from '../../features/crew/ficheNavigation.ts';
import { showPlace } from '../../features/map/placeTarget.ts';
import { state } from '../../state/index.ts';
import { go } from '../router.ts';
import { toggleThemeFromSearch } from '../theme.ts';

import type { SearchHit } from './searchHits.ts';
import { searchContext, searchHits } from './searchHits.ts';
import type { PlaceEntry } from './searchIndex.ts';
import { onlinePlaces } from './searchIndex.ts';

/** Time without typing before the network is asked, in ms. */
const TYPING_PAUSE_MS = 600;
const MIN_ONLINE_LETTERS = 3;

/**
 * The magnifier on every screen: it finds a function of the app or a place.
 * @returns The button and its window.
 */
export function SearchButton() {
  useSignals();
  return (
    <>
      <MagnifierButton id="searchBtn" />
      {searchOpen.value ? (
        <SearchWindow
          onClose={() => {
            searchOpen.value = false;
          }}
        />
      ) : null}
    </>
  );
}

/** The search window is open. */
const searchOpen = signal(false);

/**
 * The magnifier button; the nav bar shows one between ◀ and Sortir, the
 * floating one hides then.
 * @param props - Button id.
 * @param props.id - `searchBtn` (floating) or `navSearch` (in the nav bar).
 * @returns The button.
 */
export function MagnifierButton({ id }: { id: string }) {
  useSignals();
  // A long press is night and day: the small sun and moon on its sides say
  // it, the mode shown lit.
  const press = useLongPress(toggleThemeFromSearch);
  const night = state.preferences.settings.value.theme === 'night';
  const classes = ['no-print', 'no-navact', night ? 'dn-night' : 'dn-day'];
  if (searchOpen.value) classes.push('menu-here', 'search-open');
  if (press.hit) classes.push('lp-hit');
  return (
    <button
      type="button"
      id={id}
      className={classes.join(' ')}
      aria-label="Rechercher une fonction ou un lieu · appui long : jour / nuit"
      onClick={() => {
        searchOpen.value = true;
      }}
      {...press.handlers}
    >
      <svg className="dn-sun" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="2.6" />
        <path
          d="M6 .8v1.6M6 9.6v1.6M.8 6h1.6M9.6 6h1.6M2.3 2.3l1.1 1.1M8.6 8.6l1.1 1.1M2.3 9.7l1.1-1.1M8.6 3.4l1.1-1.1"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
      <svg className="dn-moon" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M8.6 9.4A4.6 4.6 0 0 1 5.2 1.2a4.6 4.6 0 1 0 5.6 6.4 4.6 4.6 0 0 1-2.2 1.8z" />
      </svg>
      <svg
        className="magnifier"
        viewBox="0 0 24 24"
        width="28"
        height="28"
        aria-hidden="true"
      >
        <circle cx="10.2" cy="10.2" r="5.6" fill="currentColor" opacity="0.1" />
        <circle
          cx="10.2"
          cy="10.2"
          r="6.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          d="M7.2 8.6a3.4 3.4 0 0 1 2.6-2.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="m15.3 15.3 5.4 5.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

/** What the network answered, and to which search. */
interface OnlineAnswer {
  query: string;
  places: PlaceEntry[];
}

/** How long a band found stays lit. */
const LIT_MS = 2500;

/**
 * Bring the band found into view in its list, lit a moment.
 * @param id - The id of its record.
 */
function lightBand(id: string): void {
  setTimeout(() => {
    const band = [
      ...document.querySelectorAll<HTMLElement>('[data-sw-id]'),
    ].find(
      (one) =>
        one.dataset.swId === id || one.dataset.swId?.startsWith(`${id}#`),
    );
    if (!band) return;
    band.scrollIntoView({ block: 'center' });
    band.classList.add('search-found');
    setTimeout(() => band.classList.remove('search-found'), LIT_MS);
  }, 400);
}

/**
 * Open what a suggestion names.
 * @param hit - The suggestion.
 */
function openHit(hit: SearchHit): void {
  if (hit.place) {
    showPlace(hit.place);
    return;
  }
  if (hit.kind === 'boat') {
    go('boats', hit.id);
  } else if (hit.kind === 'member') {
    go('people');
    openFiche(hit.id, 'list');
  } else if (hit.kind === 'crew') {
    beginCrewSetEdit(hit.id);
    go('crews');
  } else if (hit.view) {
    go(hit.view);
    lightBand(hit.id);
  } else {
    go(hit.id);
  }
}

/**
 * The search, over the screen: one field, looking only in what the screen
 * holds (places on the map, every field of the boats, the cards, the crews,
 * the marks, the traces, the SOS logs, the navigations, the check-lists).
 * @param props - Closes the window.
 * @returns The window.
 */
function SearchWindow({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<OnlineAnswer | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [context] = useState(() =>
    searchContext(state.view.currentView.peek()),
  );
  useEffect(() => {
    input.current?.focus();
  }, []);
  const asksOnline =
    query.trim().length >= MIN_ONLINE_LETTERS && navigator.onLine;
  useEffect(() => {
    if (!asksOnline) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void onlinePlaces(query, controller.signal).then((places) => {
        if (!controller.signal.aborted) setAnswer({ query, places });
      });
    }, TYPING_PAUSE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, asksOnline]);
  const online = answer?.query === query ? answer.places : [];
  const waiting = asksOnline && answer?.query !== query;
  const here = searchHits(query, context);
  const pick = (hit: SearchHit) => {
    onClose();
    openHit(hit);
  };
  const onlineHits = online.map((place): SearchHit => ({
    kind: 'place',
    key: `o-${place.name}${place.lat}`,
    label: `🌐 ${place.name}`,
    id: place.name,
    place,
  }));
  const typed = query.trim().length > 0;
  const empty = typed && !waiting && here.length + onlineHits.length === 0;
  return createPortal(
    <div
      className="ck-ask search-modal no-print"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ck-ask-box search-box">
        <input
          className="text"
          id="searchInput"
          type="search"
          enterKeyHint="search"
          placeholder={context.placeholder}
          autoComplete="off"
          ref={input}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            const first = here[0] ?? onlineHits[0];
            if (first) pick(first);
          }}
        />
        <HitGroup
          title={context.title}
          hits={context.online ? [...here, ...onlineHits] : here}
          onPick={pick}
        />
        {waiting ? <p className="help">Recherche en ligne…</p> : null}
        {empty ? (
          <p className="help">
            {navigator.onLine
              ? 'Rien trouvé.'
              : 'Rien trouvé sur l’appareil. Les pays et régions demandent du réseau.'}
          </p>
        ) : null}
        <button type="button" className="btn" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>,
    document.body,
  );
}

function HitGroup({
  title,
  hits,
  onPick,
}: {
  title: string;
  hits: readonly SearchHit[];
  onPick: (hit: SearchHit) => void;
}) {
  if (hits.length === 0) return null;
  return (
    <>
      <h3 className="search-group">{title}</h3>
      {hits.map((hit) => (
        <button
          type="button"
          className="search-hit"
          key={hit.key}
          data-hit={hit.kind}
          onClick={() => onPick(hit)}
        >
          {hit.label}
        </button>
      ))}
    </>
  );
}
