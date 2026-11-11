import { useEffect, useRef, useState } from 'react';

import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtPos } from '../../lib/geo.ts';
import type { PlaceEntry } from '../../shell/search/searchIndex.ts';
import { onlinePlaces } from '../../shell/search/searchIndex.ts';

import { plain, zoomOf } from './placeCenter.ts';

/** A place a map can open on. */
interface CenterPlace {
  name: string;
  lat: number;
  lon: number;
  /**
   * Zoom that shows it whole, when known.
   * @default undefined
   */
  zoom?: number;
}

/** Letters typed before the network is asked, as the magnifier. */
const MIN_ONLINE_LETTERS = 2;
/** Pause in the typing before the network is asked. */
const TYPING_PAUSE_MS = 450;
interface Answer {
  query: string;
  places: PlaceEntry[];
}

/**
 * Where a map opens: the place chosen, written in full, and a field that
 * proposes, while typing, the places of the device then those found on the
 * network, as the magnifier does.
 * @param props - The field.
 * @param props.id - Id of the input.
 * @param props.title - Title of the row.
 * @param props.icon - Icon of the places of the device.
 * @param props.current - The place chosen now.
 * @param props.known - Places of the device, offered first.
 * @param props.placeholder - Text of the empty field.
 * @param props.help - Help under the row.
 * @param props.onPick - A place is chosen.
 * @returns The row.
 */
export function PlaceCenterField({
  id,
  title,
  icon,
  current,
  known,
  placeholder,
  help,
  onPick,
}: {
  id: string;
  title: string;
  icon: string;
  current: CenterPlace;
  known: readonly CenterPlace[];
  placeholder: string;
  help: string;
  onPick: (place: CenterPlace) => void;
}) {
  const tr = useTr();
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const typed = query.trim();
  const asksOnline = typed.length >= MIN_ONLINE_LETTERS && navigator.onLine;
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
  const local = typed
    ? known.filter((place) => plain(place.name).includes(plain(typed)))
    : [];
  const online = answer?.query === query ? answer.places : [];
  const waiting = asksOnline && answer?.query !== query;
  const pick = (place: CenterPlace) => {
    buzz();
    onPick(place);
    setQuery('');
    setAnswer(null);
    input.current?.blur();
  };
  const empty = typed && !waiting && local.length + online.length === 0;
  return (
    <div className="field place-center">
      <div className="cf">
        <label htmlFor={id}>{tr(title)}</label>
        <p className="place-chosen" aria-live="polite">
          <span className="place-tick">✓</span>
          <span>
            <b>{tr('Choisi :')}</b> {current.name}
            <small>{fmtPos(current)}</small>
          </span>
        </p>
        <input
          className="text"
          id={id}
          ref={input}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder={tr(placeholder)}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const first = local[0] ?? online[0];
            if (first) {
              pick('bounds' in first ? found(first) : first);
            }
          }}
        />
        {local.length + online.length > 0 ? (
          <div className="place-hits" role="listbox">
            {local.map((place) => (
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="search-hit"
                key={`k${place.name}`}
                onClick={() => pick(place)}
              >
                {icon} {place.name}
              </button>
            ))}
            {online.length > 0 ? <h3>{tr('En ligne')}</h3> : null}
            {online.map((place) => (
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="search-hit"
                key={`o${place.name}${place.lat}`}
                onClick={() => pick(found(place))}
              >
                🌐 {place.name}
              </button>
            ))}
          </div>
        ) : null}
        {waiting ? <p className="help">{tr('Recherche en ligne…')}</p> : null}
        {empty ? (
          <p className="help">
            {tr(
              navigator.onLine
                ? 'Rien trouvé.'
                : 'Rien trouvé sur l’appareil. Les autres lieux demandent du réseau.',
            )}
          </p>
        ) : null}
      </div>
      <HelpText>{help}</HelpText>
    </div>
  );
}

function found(place: PlaceEntry): CenterPlace {
  const zoom = zoomOf(place.bounds);
  return zoom === undefined
    ? { name: place.name.trim(), lat: place.lat, lon: place.lon }
    : { name: place.name.trim(), lat: place.lat, lon: place.lon, zoom };
}
