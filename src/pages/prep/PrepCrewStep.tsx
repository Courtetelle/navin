import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import { openCrewSet } from '../../features/crew/index.ts';
import { startCrewDraft } from '../../features/prep/prepCrewDraft.ts';
import { pickCrewSet } from '../../features/prep/prepPicks.ts';
import type { CrewSet } from '../../model/types.ts';
import {
  byUse,
  crewSetDate,
  crewSetName,
  crewSetPeople,
  state,
} from '../../state/index.ts';

import type { PrepStepProps } from './PrepFirstSteps.tsx';
import { PrepNav } from './PrepNav.tsx';

/**
 * The crew: the kept compositions, last used first, or a new one.
 * @param props - PréP flow.
 * @returns The compositions.
 */
export function PrepCrewStep({ prep }: PrepStepProps) {
  useSignals();
  const members = state.data.members.value;
  const known = state.data.crewSets.value.filter((set) =>
    set.crew.some((line) =>
      members.some((member) => member.id === line.memberId),
    ),
  );
  const list = byUse(known, 'crew', prep.purpose ?? undefined, crewSetName);
  const used = (state.data.prepUse.value.crew || []).length > 0;
  return (
    <>
      {list.length > 0 ? (
        <div className="row prep-col">
          {list.map((set, position) => (
            <CrewSetPick
              key={set.id}
              set={set}
              lastUsed={position === 0 && used}
            />
          ))}
        </div>
      ) : (
        <HelpText nextIsRow>
          Aucune composition enregistrée. Crée la première : choisis les
          personnes à bord, elle sera gardée pour les prochaines fois.
        </HelpText>
      )}
      <ButtonRow>
        <Button className="btn big" data-p="newcrew" onClick={startCrewDraft}>
          ＋ Nouvelle composition
        </Button>
      </ButtonRow>
      <PrepNav />
    </>
  );
}

function CrewSetPick({ set, lastUsed }: { set: CrewSet; lastUsed: boolean }) {
  const press = useLongPress(() => openCrewSet(set.id));
  const date = crewSetDate(set);
  return (
    <Button
      className={press.hit ? 'btn big lp-hit' : 'btn big'}
      data-pick="crewSet"
      data-v={set.id}
      {...press.handlers}
      onClick={() => pickCrewSet(set.id)}
    >
      👥 {crewSetName(set)}
      <small>
        {lastUsed ? 'dernière utilisée · ' : ''}
        {crewSetPeople(set)}
        {date ? (
          <>
            <br />
            {date}
          </>
        ) : null}
      </small>
    </Button>
  );
}
