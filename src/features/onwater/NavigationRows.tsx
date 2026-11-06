import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate, fmtTime, fmtUtc } from '../../lib/format.ts';

import {
  lastBlackWater,
  noteBlackWater,
  noteLakeEvent,
} from './lakeActions.ts';
import { refreshLakeButtons } from './lakeRefresh.ts';
import type { LakeState } from './lakeState.ts';
import { LAKE_EVENTS, PROP_EVT } from './lakeState.ts';
import { photosFor, takePhoto } from './photos.ts';
import type { BoxTr } from './useBoxTr.ts';

/** Props of the rows of the « En navigation » section. */
export interface NavigationRowProps {
  /** State of the day. */
  current: LakeState;
  /** Button already touched, disabled until the redraw. */
  pending: string | null;
  /** Called with the key of the button touched. */
  start: (key: string) => void;
  /** Translation of the box. */
  tr: BoxTr;
}

function since(time: string | null | undefined): string {
  return time ? ` depuis ${fmtUtc(new Date(time))}` : '';
}

/**
 * The engine and sail switches.
 * @param props - State of the day and actions.
 * @returns The row.
 */
export function PropulsionRow({
  current,
  pending,
  start,
  tr,
}: NavigationRowProps) {
  return (
    <ButtonRow className="row c2 prop-row">
      <Button
        className={current.motor ? 'btn big on' : 'btn big'}
        data-prop="motor"
        disabled={pending === 'motor'}
        onClick={() => {
          start('motor');
          noteLakeEvent(
            { evt: [current.motor ? PROP_EVT.motOff : PROP_EVT.motOn] },
            current.motor ? '⚙️ Moteur arrêté' : '⚙️ Moteur en marche',
          );
        }}
      >
        <span className="mode-ic">⚙️</span>
        {tr('Moteur')}
        <small>
          {tr(
            current.motor
              ? `en marche${since(current.motorT)} · toucher pour arrêter`
              : 'arrêté · toucher pour démarrer',
          )}
        </small>
      </Button>
      <Button
        className={current.sail ? 'btn big on' : 'btn big'}
        data-prop="sail"
        disabled={pending === 'sail'}
        onClick={() => {
          start('sail');
          noteLakeEvent(
            { evt: [current.sail ? PROP_EVT.sailOff : PROP_EVT.sailOn] },
            current.sail ? '⛵ Voiles affalées' : '⛵ Sous voile',
          );
        }}
      >
        <span className="mode-ic">⛵</span>
        {tr('Voile')}
        <small>
          {tr(
            current.sail
              ? `sous voile${since(current.sailT)} · toucher pour affaler`
              : 'toucher pour hisser',
          )}
        </small>
      </Button>
    </ButtonRow>
  );
}

/**
 * Start or end of a bathing stop.
 * @param props - State of the day and actions.
 * @returns The row.
 */
export function BathingRow({
  current,
  pending,
  start,
  tr,
}: NavigationRowProps) {
  return (
    <ButtonRow className="row">
      {current.bathing ? (
        <Button
          className="btn big bath-on"
          data-lev="bainFin"
          disabled={pending === 'bainFin'}
          onClick={() => {
            start('bainFin');
            noteLakeEvent(
              { evt: [LAKE_EVENTS.bainFin] },
              '🏊 Retour de baignade noté',
            );
          }}
        >
          {tr('🏊 Retour de baignade')}
          <small>
            {tr(`baignade${since(current.bathT)} · compter tout le monde`)}
          </small>
        </Button>
      ) : (
        <Button
          className="btn big"
          data-lev="bain"
          disabled={pending === 'bain'}
          onClick={() => {
            start('bain');
            noteLakeEvent(
              { evt: [LAKE_EVENTS.bain] },
              '🏊 Départ baignade noté',
            );
          }}
        >
          {tr('🏊 Baignade')}
          <small>{tr('moteur coupé, échelle sortie')}</small>
        </Button>
      )}
    </ButtonRow>
  );
}

/**
 * A photo of the outing and the black water note.
 * @param props - Day and translation.
 * @param props.today - Today's key.
 * @param props.tr - Translation of the box.
 * @returns The row.
 */
export function PhotoRow({ today, tr }: { today: string; tr: BoxTr }) {
  const photoCount = photosFor('nav', today).length;
  const black = lastBlackWater();
  const blackDate = black ? new Date(black) : null;
  return (
    <ButtonRow className="row c2">
      <Button
        className="btn big"
        data-navphoto="1"
        onClick={() => {
          buzz();
          takePhoto('nav', refreshLakeButtons);
        }}
      >
        {tr('📷 + photo')}
        <small>
          {tr(photoCount ? `${photoCount} aujourd’hui` : 'en navigation')}
        </small>
      </Button>
      <ArmedButton
        className="btn big"
        data-black="1"
        armedLabel="Toucher encore : noter la vidange maintenant"
        onConfirm={noteBlackWater}
      >
        {tr('🚽 Eaux noires vidées')}
        <small>
          {tr(
            blackDate
              ? `dernière : ${fmtShortDate(blackDate).slice(0, 5)} à ${fmtTime(blackDate)}`
              : 'date et heure',
          )}
        </small>
      </ArmedButton>
    </ButtonRow>
  );
}
