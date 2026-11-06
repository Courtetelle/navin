import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { showPlace } from '../../features/map/placeTarget.ts';
import { go } from '../router.ts';

import type { FunctionEntry, PlaceEntry } from './searchIndex.ts';
import {
  functionEntries,
  matches,
  onlinePlaces,
  placeEntries,
} from './searchIndex.ts';

/** Time without typing before the network is asked, in ms. */
const TYPING_PAUSE_MS = 600;
const MIN_ONLINE_LETTERS = 3;

/**
 * The magnifier on every screen: it finds a function of the app or a place.
 * @returns The button and its window.
 */
export function SearchButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        id="searchBtn"
        className="no-print no-navact"
        aria-label="Rechercher une fonction ou un lieu"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <circle
            cx="10.5"
            cy="10.5"
            r="6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
          />
          <path
            d="m15.5 15.5 5.5 5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open ? <SearchWindow onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** What the network answered, and to which search. */
interface OnlineAnswer {
  query: string;
  places: PlaceEntry[];
}

type SearchMode = 'place' | 'function';

function SearchWindow({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<SearchMode | null>(null);
  return createPortal(
    <div
      className="ck-ask search-modal no-print"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ck-ask-box">
        {mode ? (
          <SearchField
            key={mode}
            mode={mode}
            onClose={onClose}
            onBack={() => setMode(null)}
          />
        ) : (
          <>
            <button
              type="button"
              className="btn big primary"
              data-search="place"
              onClick={() => setMode('place')}
            >
              📍 Un lieu, un pays, une région
            </button>
            <button
              type="button"
              className="btn big primary"
              data-search="function"
              onClick={() => setMode('function')}
            >
              ⚙️ Une fonction de l’application
            </button>
          </>
        )}
        <button type="button" className="btn" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>,
    document.body,
  );
}

function SearchField({
  mode,
  onClose,
  onBack,
}: {
  mode: SearchMode;
  onClose: () => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<OnlineAnswer | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const asksOnline =
    mode === 'place' &&
    query.trim().length >= MIN_ONLINE_LETTERS &&
    navigator.onLine;
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
  const functions =
    mode === 'function'
      ? matches(
          query,
          functionEntries(),
          (entry) => `${entry.title} ${entry.sub}`,
        )
      : [];
  const places =
    mode === 'place'
      ? matches(query, placeEntries(), (entry) => entry.name)
      : [];
  const openFunction = (entry: FunctionEntry) => {
    onClose();
    go(entry.key);
  };
  const openPlace = (place: PlaceEntry) => {
    onClose();
    showPlace(place);
  };
  const empty =
    query.trim() &&
    !waiting &&
    functions.length + places.length + online.length === 0;
  return (
    <>
      <button type="button" className="search-back" onClick={onBack}>
        ◀ Changer de recherche
      </button>
      <input
        className="text"
        id="searchInput"
        type="search"
        placeholder={
          mode === 'place'
            ? 'Lieu, pays, région…'
            : 'Fonction de l’application…'
        }
        autoComplete="off"
        ref={input}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {functions.map((entry) => (
        <button
          type="button"
          className="search-hit"
          key={entry.key}
          onClick={() => openFunction(entry)}
        >
          {entry.title}
        </button>
      ))}
      {places.map((place) => (
        <button
          type="button"
          className="search-hit"
          key={place.name}
          onClick={() => openPlace(place)}
        >
          📍 {place.name}
        </button>
      ))}
      {online.length > 0 ? <h3>En ligne</h3> : null}
      {online.map((place) => (
        <button
          type="button"
          className="search-hit"
          key={`${place.name}${place.lat}`}
          onClick={() => openPlace(place)}
        >
          🌐 {place.name}
        </button>
      ))}
      {waiting ? <p className="help">Recherche en ligne…</p> : null}
      {empty ? (
        <p className="help">
          {mode === 'place' && !navigator.onLine
            ? 'Rien trouvé sur l’appareil. Les pays et régions demandent du réseau.'
            : 'Rien trouvé.'}
        </p>
      ) : null}
    </>
  );
}
