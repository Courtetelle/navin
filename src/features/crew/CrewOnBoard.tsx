import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { LinkButton } from '../../components/shared/EditableLinks.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { telOf } from '../../lib/phone.ts';
import { LAKE_ROLES, SEA_ROLES, roleLabel } from '../../model/crewFields.ts';
import type { CrewMember } from '../../model/types.ts';
import { isLake, memberLockMsg } from '../../state/index.ts';
import { SwipeRow } from '../prep/index.ts';

import { moveCrewLineUp, setCrewRole } from './aboard.ts';
import { deleteMemberCard, openFiche } from './ficheNavigation.ts';
import { showCrewPick } from './screen.ts';

/** Props of {@link CrewOnBoard}. */
export interface CrewOnBoardProps {
  /** Crew line. */
  line: CrewMember;
  /** Its position. */
  index: number;
}

/**
 * A person on board: phone, role, card, move up (lake.js:1836-1841).
 * @param props - Crew line and position.
 * @returns The block.
 */
export function CrewOnBoard({ line, index }: CrewOnBoardProps) {
  const tr = useTr();
  const roles = isLake() ? LAKE_ROLES : SEA_ROLES;
  const phone = line.tel as string | undefined;
  return (
    <div className="crew-on">
      <div className="crew-on-name">
        <b>{`${index + 1}. ${line.nom || '…'}`}</b>
        {phone ? (
          <LinkButton className="btn crew-tel" href={`tel:${telOf(phone)}`}>
            {`📞 ${phone}`}
          </LinkButton>
        ) : null}
      </div>
      <ButtonRow className="row c3">
        {roles.map(([role]) => (
          <Button
            key={role}
            className={`btn ${line.fonction === role ? 'on' : ''}`}
            data-role={index}
            data-f={role}
            onClick={() => {
              buzz();
              setCrewRole(index, role);
              showCrewPick();
            }}
          >
            {tr(roleLabel(role, line.sexe))}
          </Button>
        ))}
      </ButtonRow>
      <div
        className={
          line.memberId ? 'row c2 crew-on-act row-stack' : 'row c2 crew-on-act'
        }
      >
        {line.memberId ? (
          <SwipeRow
            id={line.memberId}
            name="✎ Fiche"
            block={memberLockMsg}
            onDelete={deleteMemberCard}
          >
            {(swipe) => (
              <Button
                {...swipe}
                className="btn act-plain"
                data-fiche={line.memberId}
                onClick={() => {
                  buzz();
                  openFiche(line.memberId ?? '', null);
                }}
              >
                {tr('✎ Fiche')}
              </Button>
            )}
          </SwipeRow>
        ) : (
          <span />
        )}
        <Button
          className={line.memberId ? 'btn act-plain' : 'btn'}
          data-up={index}
          disabled={index === 0}
          onClick={() => {
            buzz();
            moveCrewLineUp(index);
            showCrewPick();
          }}
        >
          {tr('▲ Monter')}
        </Button>
      </div>
    </div>
  );
}
