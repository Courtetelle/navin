import { HelpText } from '../../components/shared/HelpText.tsx';

import { PrepNav } from './PrepNav.tsx';

/**
 * The check-in step without a boat: a reminder to choose one first.
 * @returns The step.
 */
export function PrepNoBoatStep() {
  return (
    <>
      <HelpText nextIsRow>
        Choisis d’abord le bateau (pastille 2) : cette étape s’active ensuite.
      </HelpText>
      <PrepNav />
    </>
  );
}
