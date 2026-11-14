import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { SwipeRow } from '../../features/prep/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import type { ModeKey } from '../../model/modes.ts';
import { MODES } from '../../model/modes.ts';
import { runBootHook } from '../../shell/bootHooks.ts';
import { go } from '../../shell/router.ts';
import {
  hooks,
  openCruise,
  removeCruise,
  state,
  toast,
} from '../../state/index.ts';

import type { CruiseLine } from './CruisesPage.tsx';

const PURPOSE_ICONS: Readonly<Record<string, string>> = {
  Location: '🔑',
  Invitation: '🤝',
};

function open(id: string): void {
  buzz();
  if (state.view.tracking.value) void hooks.stopTracking?.(false);
  openCruise(id);
  state.view.currentDay.value = null;
  toast('Ouverte');
  runBootHook('autoResumeTrip');
  go('tracker');
}

function summary({ meta, cruise }: CruiseLine): string {
  const count = cruise.entries.length;
  const purpose = cruise.purpose
    ? `${PURPOSE_ICONS[cruise.purpose] ?? '🎯'} ${cruise.purpose} · `
    : '';
  return `${purpose}${count} entrée${count > 1 ? 's' : ''} · créée le ${fmtShortDate(new Date(meta.created))}`;
}

/** Props of {@link CruiseList}. */
interface CruiseListProps {
  /** Mode shown. */
  mode: ModeKey;
  /** Navigations of that mode, newest first. */
  lines: readonly CruiseLine[];
}

/**
 * Navigations of a mode: open, change or delete each one (by its button or a
 * swipe).
 * @param props - Mode and navigations.
 * @returns The title and the list.
 */
export function CruiseList({ mode, lines }: CruiseListProps) {
  useSignals();
  const tr = useTr();
  const openId = state.data.cruise.value?.id;
  return (
    <>
      {lines.length > 0 ? (
        <h2 className="sub-h">
          {tr(
            `${MODES[mode].icon} ${MODES[mode].name} : mes ${mode === 'lacj' ? 'sorties' : 'croisières'}`,
          )}
        </h2>
      ) : null}
      {lines.map((line) => {
        const { id, name } = line.meta;
        const current = openId === id;
        return (
          <SwipeRow
            key={id}
            id={id}
            name={name}
            onDelete={removeCruise}
            onView={() => {
              if (current) go('info');
              else open(id);
            }}
          >
            <article
              className={current ? 'entry current' : 'entry'}
              data-id={id}
            >
              <div className="when">
                <span>{name}</span>
                {current ? <span>{tr('● en cours')}</span> : null}
              </div>
              <HelpText>{summary(line)}</HelpText>
              <div className="actions">
                {current ? (
                  <Button
                    className="btn"
                    data-act="info"
                    onClick={() => {
                      buzz();
                      go('info');
                    }}
                  >
                    {tr('Modifier')}
                  </Button>
                ) : (
                  <Button
                    className="btn primary"
                    data-act="open"
                    onClick={() => open(id)}
                  >
                    {tr('Ouvrir')}
                  </Button>
                )}
              </div>
            </article>
          </SwipeRow>
        );
      })}
    </>
  );
}
