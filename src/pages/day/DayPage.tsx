import { useSignals } from '@preact/signals-react/runtime';
import { useMemo } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { autoFillLakeDay } from '../../features/boats/index.ts';
import { CompactForm } from '../../features/logbook/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { dayKey, fmtDate, keyToDate } from '../../lib/format.ts';
import { DAY_INFO_KEYS } from '../../model/daySections.ts';
import type { FieldData } from '../../model/field.ts';
import type { Cruise, Day } from '../../model/types.ts';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { go } from '../../shell/router.ts';
import {
  daySections,
  isLake,
  shownDay,
  state,
  updateCruise,
} from '../../state/index.ts';

const ROW_STYLE = { marginBottom: '12px' };
// The rental amount is the only value refreshed on screen by the automatic fill.
const FOLLOWED_KEYS: readonly string[] = ['montant'];

/**
 * Screen `day`: the day sheet, saved automatically (legacy `VIEWS.day`).
 * @returns The screen content.
 */
export function DayPage() {
  useSignals();
  useNavFields();
  const tr = useTr();
  const cruise = state.data.cruise.value;
  const key = shownDay();
  const lake = isLake();
  const day = cruise?.days[key];
  const info = cruise?.info;
  const data = useMemo(() => dayFormData(day, info), [day, info]);
  if (!cruise) return null;
  const today = dayKey(new Date());
  let count = 0;
  for (const entry of cruise.entries) {
    if (dayKey(new Date(entry.t)) === key) count++;
  }
  const move = (days: number) => {
    buzz();
    const date = keyToDate(key);
    date.setDate(date.getDate() + days);
    go('day', dayKey(date));
  };
  return (
    <>
      <div className="daynav">
        <Button
          className="btn"
          data-d="-1"
          aria-label="Jour précédent"
          onClick={() => move(-1)}
        >
          ◀
        </Button>
        <div>
          <div className="dn-date">{tr(fmtDate(keyToDate(key)))}</div>
          <div className="dn-sub">
            {tr(`${count} entrée${count > 1 ? 's' : ''} au journal`)}
          </div>
        </div>
        <Button
          className="btn"
          data-d="1"
          aria-label="Jour suivant"
          onClick={() => move(1)}
        >
          ▶
        </Button>
      </div>
      <ButtonRow className={key === today ? 'row' : 'row c2'} style={ROW_STYLE}>
        {key === today ? null : (
          <Button className="btn" data-today="1" onClick={browse('day', today)}>
            {tr('Aujourd’hui')}
          </Button>
        )}
        <Button className="btn" data-mapday="1" onClick={browse('map', key)}>
          {tr('🗺 Carte du jour')}
        </Button>
      </ButtonRow>
      {lake ? (
        <ButtonRow className="row c2" style={ROW_STYLE}>
          <Button className="btn" data-crew="1" onClick={browse('crew', null)}>
            {tr('👥 Équipage')}
            <small>{tr(`${cruise.crew.length} à bord`)}</small>
          </Button>
          <Button
            className="btn primary"
            data-sheet="1"
            onClick={browse('sheet', key)}
          >
            {tr('📸 Fiche à envoyer')}
          </Button>
        </ButtonRow>
      ) : null}
      <HelpText>
        Enregistrement automatique. Remplissez au calme, au port ou au
        mouillage.
      </HelpText>
      <div id="dayForm">
        <CompactForm
          sections={daySections()}
          data={data}
          followKeys={lake ? FOLLOWED_KEYS : undefined}
          onChange={(next) => {
            saveDayForm(key, next);
            if (lake) autoFillLakeDay(key);
          }}
        />
      </div>
    </>
  );
}

function browse(view: string, arg: string | null) {
  return () => {
    buzz();
    go(view, arg);
  };
}

// The engine counter, the fuel at departure and the engine speed show in the
// day sheet but stay values of the cruise.
function dayFormData(
  day: Day | undefined,
  info: Cruise['info'] | undefined,
): FieldData {
  const data: FieldData = { ...day };
  for (const key of DAY_INFO_KEYS) {
    Reflect.deleteProperty(data, key);
    if (info?.[key] != null) data[key] = info[key];
  }
  return data;
}

function saveDayForm(key: string, values: FieldData): void {
  updateCruise((cruise) => {
    const day: FieldData = { ...values };
    for (const name of DAY_INFO_KEYS) {
      if (values[name] == null) Reflect.deleteProperty(cruise.info, name);
      else cruise.info[name] = values[name];
      Reflect.deleteProperty(day, name);
    }
    cruise.days[key] = day;
  });
}
