import { untracked } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { TzTime } from '../../components/shared/TzTime.tsx';
import { utcText } from '../../components/shared/timeText.ts';
import { askText } from '../../features/map/dialogs.ts';
import { setGoto } from '../../features/map/goto.ts';
import { marksFly } from '../../features/map/longPress.ts';
import { relativeParts } from '../../features/map/relativeText.ts';
import { SwipeRow } from '../../features/prep/index.ts';
import { openListPublish } from '../../features/publish/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { fmtPos } from '../../lib/geo.ts';
import type { Mark } from '../../model/types.ts';
import { go } from '../../shell/router.ts';
import { updateMarks } from '../../state/index.ts';

/** Props of {@link MarkItem}. */
interface MarkItemProps {
  /** The mark. */
  mark: Mark;
}

/**
 * One mark of the directory: date, position, course from my position, actions.
 * @param props - The mark.
 * @returns The `section.mark-item`.
 */
export function MarkItem({ mark }: MarkItemProps) {
  useSignals();
  const tr = useTr();
  const title = `📌 ${mark.name}${mark.note ? ` · ${mark.note}` : ''}`;
  const date = fmtShortDate(new Date(mark.at));
  const position = fmtPos(mark);
  const depth = mark.depth ? ` · 🌊 ${mark.depth}` : '';
  // Read when the list is drawn: the text does not follow the boat.
  const relative = untracked(() => relativeParts(mark));
  const relativeText = relative
    ? `${relative.distance} · cap à suivre ${relative.bearing} (vrai)${relative.eta}`
    : 'Ma position : en attente du GPS…';
  const plain = `${date} · ${utcText(new Date(mark.at), false)}UTC · ${position}${depth}🧭 ${relativeText}`;
  const rename = () => {
    buzz();
    const note = askText(`Nom ou note pour ${mark.name}`, mark.note || '');
    if (note === null) return;
    updateMarks((marks) => {
      const found = marks.find((item) => item.id === mark.id);
      if (found) found.note = note.trim();
    });
  };
  const view = () => {
    marksFly.position = [mark.lat, mark.lon];
    go('tracker');
  };
  return (
    <SwipeRow
      id={mark.id}
      name={mark.name}
      onView={view}
      onShare={(format) => openListPublish('marks', mark.id, format)}
      onDelete={(id) => {
        updateMarks((marks) => {
          const index = marks.findIndex((item) => item.id === id);
          if (index !== -1) marks.splice(index, 1);
        });
      }}
    >
      <FoldSection
        className="field mark-item"
        data-id={mark.id}
        title={title}
        titleText={title}
      >
        <HelpText text={plain} nextIsRow>
          <>
            {`${date} · `}
            <TzTime date={mark.at} />
            {` · ${position}${depth}`}
            <br />
            🧭{' '}
            {relative ? (
              <>
                <b>{relative.distance}</b> · cap à suivre{' '}
                <b>{relative.bearing}</b> (vrai){relative.eta}
              </>
            ) : (
              relativeText
            )}
          </>
        </HelpText>
        <ButtonRow className="row c2">
          <Button
            className="btn primary"
            data-mk="goto"
            onClick={() => {
              buzz();
              const note = mark.note ? ` · ${mark.note}` : '';
              setGoto({
                lat: mark.lat,
                lon: mark.lon,
                name: `${mark.name}${note}`,
              });
            }}
          >
            {tr('🎯 Go to')}
          </Button>
          <Button className="btn" data-mk="note" onClick={rename}>
            {tr('✏️ Nom')}
          </Button>
        </ButtonRow>
      </FoldSection>
    </SwipeRow>
  );
}
