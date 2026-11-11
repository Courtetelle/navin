import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { go } from '../../../shell/router.ts';
import { state, updateCruise } from '../../../state/index.ts';

import { AboardPlanView } from './AboardPlanView.tsx';
import { PickCrew } from './PickCrew.tsx';
import { TaskTplEdit } from './TaskTplEdit.tsx';
import { aboardCrew } from './aboardPlan.ts';
import { useKeepScroll } from './useKeepScroll.ts';

/** Props of {@link AboardFlow}. */
interface AboardFlowProps {
  /** First screen: the plan, or the template (legacy `renderTaskTplEdit`). */
  initial: 'plan' | 'edit';
}

/** Who is being replaced: day and slot of the rotation. */
interface PickTarget {
  key: string;
  slot: number;
}

type Screen = 'plan' | 'edit' | PickTarget;

/**
 * The aboard task rotation and its sub-screens, shown in place without a
 * navigation, like the legacy renders did.
 * @param props - First screen.
 * @returns The screen content.
 */
export function AboardFlow({ initial }: AboardFlowProps) {
  useSignals();
  const [screen, changeScreen] = useState<Screen>(initial);
  const keepScroll = useKeepScroll();
  const setScreen = (next: Screen) => {
    keepScroll();
    changeScreen(next);
  };
  const cruise = state.data.cruise.value;
  if (screen === 'edit' || !cruise) {
    return (
      <TaskTplEdit
        onDone={() => {
          if (state.data.cruise.value) setScreen('plan');
          else go('more');
        }}
      />
    );
  }
  if (screen === 'plan') {
    return (
      <AboardPlanView
        onEdit={() => setScreen('edit')}
        onPick={(key, slot) => setScreen({ key, slot })}
      />
    );
  }
  return (
    <PickCrew
      crew={aboardCrew(cruise)}
      onBack={() => setScreen('plan')}
      onPick={(person) => {
        updateCruise((draft) => {
          const swaps = (draft.taskOv ?? {}) as Record<
            string,
            Record<string, number>
          >;
          swaps[screen.key] ??= {};
          (swaps[screen.key] as Record<string, number>)[screen.slot] = person;
          draft.taskOv = swaps;
        });
        setScreen('plan');
      }}
    />
  );
}
