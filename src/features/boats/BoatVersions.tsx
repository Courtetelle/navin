import { useSignals } from '@preact/signals-react/runtime';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate, pad } from '../../lib/format.ts';
import {
  boatInfoOf,
  boatSections,
  infoDiffKeys,
} from '../../model/boatSheet.ts';
import type { Boat, BoatVersion, CruiseInfo } from '../../model/types.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { boatById, restoreBoatVersion, toast } from '../../state/index.ts';

import { versionValueText } from './versionText.ts';
import { withKeys } from './withKeys.ts';

/** Props of {@link BoatVersionsButton}. */
export interface BoatVersionsButtonProps {
  /** Boat. */
  boat: Boat;
  /** Opens the versions. */
  onOpen: () => void;
}

/**
 * Button « ↺ Versions précédentes » (legacy `boatVersBtn`), only when the boat
 * has versions.
 * @param props - Boat and action.
 * @returns The row, or nothing.
 */
export function BoatVersionsButton({ boat, onOpen }: BoatVersionsButtonProps) {
  const tr = useTr();
  const count = (boat.hist ?? []).length;
  if (count === 0) return null;
  return (
    <ButtonRow style={{ padding: '0 14px' }}>
      <Button
        className="btn no-navact btn-provisoire"
        data-vers={boat.id}
        title="Bouton provisoire (mode dégradé), à retirer"
        onClick={(event) => {
          event.preventDefault();
          buzz();
          onOpen();
        }}
      >
        {tr(`↺ Versions précédentes des données (${count})`)}
      </Button>
    </ButtonRow>
  );
}

/** Props of {@link BoatVersions}. */
export interface BoatVersionsProps {
  /** Boat id. */
  boatId: string;
  /** Leaves the screen. */
  onBack: () => void;
}

/**
 * Previous versions of a boat sheet: differences with the current sheet and
 * « Remettre cette version » (legacy `renderBoatVersions`).
 * @param props - Boat and way back.
 * @returns The screen content.
 */
export function BoatVersions({ boatId, onBack }: BoatVersionsProps) {
  useSignals();
  const tr = useTr();
  const boat = boatById(boatId);
  if (!boat) return null;
  const labels = Object.fromEntries(
    boatSections(boat)
      .flatMap((section) => section.fields)
      .map((field) => [field.key, field.label]),
  );
  const current = boatInfoOf(boat, boat.info);
  const versions = boat.hist ?? [];
  return (
    <>
      <PageBack
        label="◀ Le bateau"
        id="verBack"
        onClick={() => {
          buzz();
          onBack();
        }}
      >
        {tr('◀ Le bateau')}
      </PageBack>
      <PageTitle>{`↺ ${boat.info.boat || 'Bateau'} : versions`}</PageTitle>
      {withKeys(versions, versionKey).map(({ key, item }, position) => (
        <VersionSection
          key={key}
          boatId={boatId}
          version={item}
          position={position}
          current={current}
          labels={labels}
          onBack={onBack}
        />
      ))}
      {versions.length === 0 ? (
        <HelpText>{tr('Aucune version gardée.')}</HelpText>
      ) : null}
    </>
  );
}

function versionKey(version: BoatVersion): string {
  return version.at;
}

interface VersionSectionProps {
  boatId: string;
  version: BoatVersion;
  position: number;
  current: CruiseInfo;
  labels: Record<string, string | undefined>;
  onBack: () => void;
}

function VersionSection({
  boatId,
  version,
  position,
  current,
  labels,
  onBack,
}: VersionSectionProps) {
  const tr = useTr();
  const date = new Date(version.at);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const keys = infoDiffKeys(version.info, current).filter(
    (key) => !key.startsWith('pairSrc_'),
  );
  const lines = keys.map((key) => ({
    key,
    label: labels[key] || key,
    change: ` : ${versionValueText(version.info[key])} → ${versionValueText(current[key])}`,
  }));
  return (
    <FoldSection title={`${fmtShortDate(date)} ${time} · ${version.from}`}>
      {keys.length > 0 ? (
        <>
          <HelpText>
            {`${keys.length} différence${keys.length > 1 ? 's' : ''} avec la fiche actuelle (cette version → actuelle) :`}
          </HelpText>
          <HelpText
            as="ul"
            items={lines.map((line) => `${line.label}${line.change}`)}
            text={lines.map((line) => `${line.label}${line.change}`).join('')}
            nextIsRow
          >
            {lines.map((line) => (
              <li key={line.key}>
                <b>{tr(line.label)}</b>
                {line.change}
              </li>
            ))}
          </HelpText>
        </>
      ) : (
        <HelpText>Identique à la fiche actuelle.</HelpText>
      )}
      {keys.length > 0 ? (
        <ButtonRow>
          <ArmedButton
            className="btn primary no-navact"
            data-vput={position}
            armedLabel="Toucher encore : remettre"
            onClick={buzz}
            onConfirm={() => {
              restoreBoatVersion(boatId, position);
              toast('Version remise');
              onBack();
            }}
          >
            {tr('Remettre cette version')}
          </ArmedButton>
        </ButtonRow>
      ) : null}
    </FoldSection>
  );
}
