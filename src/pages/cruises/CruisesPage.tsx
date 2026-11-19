import { useSignals } from '@preact/signals-react/runtime';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import type { ModeKey } from '../../model/modes.ts';
import { MODES, modeOf } from '../../model/modes.ts';
import type { Cruise, CruiseMeta } from '../../model/types.ts';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import type { PageProps } from '../../shell/pageTypes.ts';
import { go } from '../../shell/router.ts';
import { state } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { CruiseList } from './CruiseList.tsx';
import { NewCruiseSection } from './NewCruiseSection.tsx';
import {
  enterForm,
  redrawForm,
  resolveMode,
  searchPlace,
} from './newCruiseForm.ts';

const WELCOME =
  'Bienvenue ! Choisissez le type de navigation, ou récupérez vos données d’un autre appareil.';

/** A stored cruise with what the list shows about it. */
export interface CruiseLine {
  /** Index line. */
  meta: CruiseMeta;
  /** Stored cruise (entries and purpose are read from it). */
  cruise: Pick<Cruise, 'entries' | 'purpose'>;
  /** Mode of the cruise. */
  mode: ModeKey;
}

function cruiseLines(index: readonly CruiseMeta[]): CruiseLine[] {
  const sorted = index.toSorted((first, second) =>
    second.created.localeCompare(first.created),
  );
  const lines: CruiseLine[] = [];
  for (const meta of sorted) {
    const cruise = store.get<Cruise>(`ldb.cruise.${meta.id}`, {
      entries: [],
    } as unknown as Cruise);
    const mode = modeOf({
      type: meta.type as Cruise['type'],
      duree: meta.duree || cruise.duree,
    });
    lines.push({ meta, cruise, mode });
  }
  return lines;
}

function keepBoatShown(mode: ModeKey): boolean {
  return Boolean(state.data.cruise.peek()) && mode === 'mer';
}

function openBackupSettings(): void {
  buzz();
  go('settings');
  revealBackup(20);
}

// The settings page is lazily loaded: its section shows up after `go`.
function revealBackup(attempts: number): void {
  setTimeout(() => {
    const section = document.querySelector('#backup');
    if (section) section.scrollIntoView();
    else if (attempts > 0) revealBackup(attempts - 1);
  }, 50);
}

/**
 * Screen `cruises` (legacy `VIEWS.cruises`): the three navigation modes, the
 * form of a new navigation and the list of those of the mode.
 * @param props - Page props.
 * @returns The screen.
 */
export function CruisesPage({ from }: PageProps) {
  useSignals();
  useNavFields();
  const tr = useTr();
  const mode = resolveMode(state.view.newType.value);
  const index = state.data.index.value;
  const lines = useMemo(() => cruiseLines(index), [index]);
  const [redraws, setRedraws] = useState(0);
  useLayoutEffect(() => {
    state.view.newType.value = mode;
  }, [mode]);
  const opening = useRef<{ redrawn: boolean; mode: ModeKey } | null>({
    redrawn: from === 'cruises',
    mode,
  });
  useLayoutEffect(() => {
    if (!opening.current) return;
    const { redrawn, mode: opened } = opening.current;
    enterForm(redrawn, keepBoatShown(opened));
    searchPlace(opened);
    opening.current = null;
  }, []);
  const redraw = (change: () => void) => {
    buzz();
    const shown = keepBoatShown(mode);
    change();
    redrawForm(shown);
    setRedraws((count) => count + 1);
    searchPlace(resolveMode(state.view.newType.peek()));
  };
  const cruise = state.data.cruise.value;
  return (
    <>
      <PageTitle helps={cruise ? [] : [WELCOME]} atTop={redraws === 0}>
        Mes navigations
      </PageTitle>
      {cruise ? null : (
        <ButtonRow style={{ marginBottom: '16px' }}>
          <Button
            className="btn big"
            data-go-settings="1"
            onClick={openBackupSettings}
          >
            {tr('⬆ Récupérer mes données')}
          </Button>
        </ButtonRow>
      )}
      <div className="mode-tiles">
        {Object.entries(MODES).map(([key, definition]) => {
          let count = 0;
          for (const line of lines) if (line.mode === key) count++;
          return (
            <Button
              key={key}
              className={
                key === mode ? 'btn big mode-tile on' : 'btn big mode-tile'
              }
              data-type={key}
              onClick={() => {
                redraw(() => {
                  state.view.newType.value = key;
                });
              }}
            >
              <span className="mode-ic">{definition.icon}</span>
              {tr(definition.name)}
              <small>
                {tr(`${definition.sub}${count ? ` · ${count}` : ''}`)}
              </small>
            </Button>
          );
        })}
      </div>
      <NewCruiseSection key={redraws} mode={mode} onRedraw={redraw} />
      <CruiseList mode={mode} lines={lines.filter((l) => l.mode === mode)} />
    </>
  );
}
