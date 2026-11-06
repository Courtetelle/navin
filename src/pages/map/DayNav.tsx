import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtDate, fr, keyToDate } from '../../lib/format.ts';
import { daysWithData, navLabel } from '../../state/index.ts';

/** Props of {@link DayNav}. */
export interface DayNavProps {
  /** Day shown, `null` for the whole cruise. */
  day: string | null;
  /** Distance sailed in NM. */
  nm: number;
  /** Entries with a position. */
  entries: number;
  /** Show another day, or `'all'`. */
  onShowDay: (day: string) => void;
}

/**
 * The day shown above the map, with its arrows and the way back to the whole cruise.
 * @param props - Day and its figures.
 * @returns `.daynav`, and the row of the whole cruise when a day is shown.
 */
export function DayNav({ day, nm, entries, onShowDay }: DayNavProps) {
  const tr = useTr();
  const move = (step: number) => {
    buzz();
    const days = daysWithData();
    if (days.length === 0) return;
    let from = day ? days.indexOf(day) : days.length;
    if (!day && step > 0) from = -1;
    const next = days[Math.min(days.length - 1, Math.max(0, from + step))];
    if (next) onShowDay(next);
  };
  const label = day ? navLabel(day) : '';
  const period = label ? ` · navigation ${label}` : '';
  const count = `${entries} entrée${entries > 1 ? 's' : ''}`;
  return (
    <>
      <div className="daynav">
        <Button
          className="btn"
          data-md="-1"
          aria-label="Jour précédent"
          onClick={() => move(-1)}
        >
          ◀
        </Button>
        <div>
          <div className="dn-date">
            {day ? fmtDate(keyToDate(day)) : tr('Toute la croisière')}
          </div>
          <div className="dn-sub">{tr(`${fr(nm)} NM${period} · ${count}`)}</div>
        </div>
        <Button
          className="btn"
          data-md="1"
          aria-label="Jour suivant"
          onClick={() => move(1)}
        >
          ▶
        </Button>
      </div>
      {day ? (
        <ButtonRow style={{ marginBottom: '10px' }}>
          <Button
            className="btn"
            data-md="all"
            onClick={() => {
              buzz();
              onShowDay('all');
            }}
          >
            {tr('Toute la croisière')}
          </Button>
        </ButtonRow>
      ) : null}
    </>
  );
}
