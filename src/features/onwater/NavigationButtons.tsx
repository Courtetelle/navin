import { useState } from 'react';

import { buzz } from '../../lib/dom.ts';
import { boatById, isLake, state } from '../../state/index.ts';

import { BathingRow, PhotoRow, PropulsionRow } from './NavigationRows.tsx';
import { SailChips } from './SailChips.tsx';
import type { LakeState } from './lakeState.ts';
import { NAV_ALLURES, NAV_AVANT, NAV_GV, lakeState } from './lakeState.ts';
import type { BoxTr } from './useBoxTr.ts';
import { useBoxTr } from './useBoxTr.ts';

/** Props of {@link NavigationButtons}. */
interface NavigationButtonsProps {
  /** Today's key. */
  today: string;
  /** The open outing is on the lake. */
  lake: boolean;
  /** Shown outside `#view`. */
  inPopup: boolean;
}

/**
 * Engine, sail, sails, bathing, photo and black water buttons.
 * @param props - Day and water.
 * @returns The content of the « En navigation » section.
 */
export function NavigationButtons({
  today,
  lake,
  inPopup,
}: NavigationButtonsProps) {
  const tr = useBoxTr(inPopup);
  const current = lakeState(today);
  const [pending, setPending] = useState<string | null>(null);
  const start = (key: string) => {
    buzz();
    setPending(key);
  };
  const row = { current, pending, start, tr };
  return (
    <>
      <PropulsionRow {...row} />
      {current.motor && current.sail ? (
        <p className="help prop-both">
          {tr('⛵⚙️ Voile + moteur', { help: true })}
        </p>
      ) : null}
      {current.sail ? <SailSection {...row} inPopup={inPopup} /> : null}
      {lake ? <BathingRow {...row} /> : null}
      <PhotoRow today={today} tr={tr} />
    </>
  );
}

interface SailSectionProps {
  current: LakeState;
  pending: string | null;
  start: (key: string) => void;
  tr: BoxTr;
  inPopup: boolean;
}

function SailSection({
  current,
  pending,
  start,
  tr,
  inPopup,
}: SailSectionProps) {
  const headsails = headsailNames();
  return (
    <>
      {current.motor ? null : (
        <>
          <h3 className="sub-h">{tr('Allure')}</h3>
          <SailChips
            field="allure"
            options={NAV_ALLURES}
            columns={3}
            current={current}
            pending={pending}
            onPick={start}
            inPopup={inPopup}
          />
        </>
      )}
      <h3 className="sub-h">{tr('Grand-voile')}</h3>
      <SailChips
        field="gv"
        options={NAV_GV}
        columns={4}
        current={current}
        pending={pending}
        onPick={start}
        inPopup={inPopup}
      />
      <h3 className="sub-h">{tr('Voile d’avant')}</h3>
      <SailChips
        field="avant"
        options={headsails.length > 0 ? [...headsails, 'Aucune'] : NAV_AVANT}
        columns={headsails.length === 3 ? 4 : 3}
        current={current}
        pending={pending}
        onPick={start}
        inPopup={inPopup}
      />
    </>
  );
}

function headsailNames(): string[] {
  const cruise = state.data.cruise.value;
  const boat = isLake() ? boatById(cruise?.boatId) : undefined;
  const list = cruise?.info.voilesAvant || boat?.info.voilesAvant || '';
  return (list as string)
    .split(/[,;\n]/)
    .map((name) => name.trim())
    .filter(Boolean);
}
