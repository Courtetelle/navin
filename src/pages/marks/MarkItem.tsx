import { untracked } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { utcText } from '../../components/shared/timeText.ts';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import { setGoto } from '../../features/map/goto.ts';
import { marksFly } from '../../features/map/longPress.ts';
import { relativeParts } from '../../features/map/relativeText.ts';
import { showZoomOnMap } from '../../features/map/zoomShown.ts';
import { SwipeRow } from '../../features/prep/index.ts';
import { openListPublish } from '../../features/publish/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { fmtPos } from '../../lib/geo.ts';
import type { Mark } from '../../model/types.ts';
import { go } from '../../shell/router.ts';
import { renameMark, updateMarks } from '../../state/index.ts';

/** Props of {@link MarkItem}. */
interface MarkItemProps {
  /** The mark. */
  mark: Mark;
}

/**
 * The text of a mark: its own, or its number, and the note of old.
 * @param mark - The mark.
 * @returns The text.
 */
function markLabel(mark: Mark): string {
  return `${mark.name}${mark.note ? ` · ${mark.note}` : ''}`;
}

/**
 * One mark of the directory, a band: a touch shows it on the map, a long
 * press changes its text in place; swiped, 🎯 Go to, Partager, Effacer.
 * @param props - The mark.
 * @returns The band.
 */
export function MarkItem({ mark }: MarkItemProps) {
  useSignals();
  const tr = useTr();
  const [editing, setEditing] = useState<string | null>(null);
  const press = useLongPress(() => setEditing(markLabel(mark)));
  const date = fmtShortDate(new Date(mark.at));
  const depth = mark.depth ? ` · 🌊 ${mark.depth}` : '';
  // Read when the list is drawn: the text does not follow the boat.
  const relative = untracked(() => relativeParts(mark));
  const where = relative
    ? `${relative.distance} · ${relative.bearing}`
    : fmtPos(mark);
  const view = () => {
    buzz();
    marksFly.position = [mark.lat, mark.lon];
    go('tracker');
    showZoomOnMap();
  };
  const goTo = () => {
    setGoto({ lat: mark.lat, lon: mark.lon, name: markLabel(mark) });
    // The map shows the mark and the boat.
    marksFly.position = [mark.lat, mark.lon];
    marksFly.withMe = true;
    go('tracker');
  };
  const save = (text: string) => {
    setEditing(null);
    if (text.trim() !== markLabel(mark)) renameMark(mark.id, text);
  };
  return (
    <SwipeRow
      id={mark.id}
      name={mark.name}
      onView={goTo}
      viewAs={{ icon: '🎯', label: 'Go to' }}
      onShare={(format) => openListPublish('marks', mark.id, format)}
      onDelete={(id) => {
        updateMarks((marks) => {
          const index = marks.findIndex((item) => item.id === id);
          if (index !== -1) marks.splice(index, 1);
        });
      }}
    >
      <div className="section mark-item" data-id={mark.id}>
        {editing === null ? (
          <button
            type="button"
            className={`mark-head${press.hit ? ' lp-hit' : ''}`}
            aria-label={tr(
              `${markLabel(mark)} · toucher : sur la carte · appui long : changer le texte`,
            )}
            onClick={view}
            {...press.handlers}
          >
            <span className="mk-pin" aria-hidden="true">
              📌
            </span>
            <span className="mk-text">
              <b className="b-nm">{markLabel(mark)}</b>
              <small>
                {`${date} · ${utcText(new Date(mark.at), false)}UTC · ${where}${depth}`}
              </small>
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
              📌
            </span>
            <input
              className="text"
              data-mk="text"
              // Opened by a long press, to be written in at once.
              autoFocus
              enterKeyHint="done"
              value={editing}
              aria-label={tr(`Texte de ${mark.name}`)}
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
