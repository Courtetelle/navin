import type { ReactNode } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { buzz } from '../../../lib/dom.ts';
import { PageBack } from '../../../shell/navbar/PageBack.tsx';

/** Props of {@link PickCrew}. */
export interface PickCrewProps {
  /** Crew names. */
  crew: readonly string[];
  /** Receives the index of the person chosen. */
  onPick: (person: number) => void;
  /** Back to the plan. */
  onBack: () => void;
}

/**
 * Choice of the person doing a task that day (legacy `pickCrew`).
 * @param props - Crew and actions.
 * @returns The screen content.
 */
export function PickCrew({ crew, onPick, onBack }: PickCrewProps) {
  const tr = useTr();
  const buttons: ReactNode[] = [];
  for (const [index, name] of crew.entries()) {
    buttons.push(
      <Button
        key={index}
        className="btn"
        data-c={index}
        onClick={() => {
          buzz();
          onPick(index);
        }}
      >
        {index + 1}. {name}
      </Button>,
    );
  }
  return (
    <>
      <PageBack
        label="◀ Retour"
        id="pcBack"
        onClick={() => {
          buzz();
          onBack();
        }}
      >
        {tr('◀ Retour')}
      </PageBack>
      <h1>{tr('Qui fait cette tâche ?')}</h1>
      <div className="checks">{buttons}</div>
    </>
  );
}
