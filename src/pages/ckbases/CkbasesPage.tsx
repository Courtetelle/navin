import { ChecklistSubScreen } from '../../features/checklists/ChecklistSubScreen.tsx';
import { prepareChecklists } from '../../features/checklists/checklistNavigation.ts';
import { useChecklistScreens } from '../../features/checklists/useChecklistScreens.ts';
import type { ChecklistBase } from '../../model/types.ts';
import type { PageProps } from '../../shell/pageTypes.ts';
import { state } from '../../state/index.ts';

import { BaseEditScreen } from './BaseEditScreen.tsx';
import { CkbasesHome } from './CkbasesHome.tsx';

/**
 * Screen `ckbases` (legacy `VIEWS.ckbases`): the check-in lists of the boats and
 * the bases, or a base when its id is given.
 * @param props - Page props: the id of a base to open.
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function CkbasesPage({ arg }: PageProps) {
  const { screen, revision, show } = useChecklistScreens(() =>
    typeof arg === 'string' && arg
      ? { kind: 'base', id: arg }
      : { kind: 'home' },
  );
  const showHome = () => {
    prepareChecklists('ckbases', null);
    show({ kind: 'home' });
  };
  const base =
    screen.kind === 'base'
      ? state.data.ckLib.value.find((item) => item.id === screen.id)
      : undefined;
  if (screen.kind === 'home' || (screen.kind === 'base' && !base)) {
    return (
      <CkbasesHome
        key={revision}
        onBase={(id) => show({ kind: 'base', id })}
        onBoatList={(boatId, list) =>
          show({ kind: 'edit', boatId, list, mode: 'lacj' })
        }
        onRedraw={showHome}
      />
    );
  }
  if (screen.kind === 'base') {
    return (
      <BaseEditScreen
        key={revision}
        base={base as ChecklistBase}
        onRedraw={() => show(screen)}
        onBack={showHome}
      />
    );
  }
  return (
    <ChecklistSubScreen
      key={revision}
      screen={screen}
      show={show}
      showHome={showHome}
    />
  );
}
