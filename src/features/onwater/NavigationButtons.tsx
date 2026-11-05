import { useState } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate, fmtTime, fmtUtc } from '../../lib/format.ts';
import { boatById, isLake, state } from '../../state/index.ts';

import { SailChips } from './SailChips.tsx';
import {
  lastBlackWater,
  noteBlackWater,
  noteLakeEvent,
} from './lakeActions.ts';
import { refreshLakeButtons } from './lakeRefresh.ts';
import {
  LAKE_EVENTS,
  NAV_ALLURES,
  NAV_AVANT,
  NAV_GV,
  PROP_EVT,
  lakeState,
} from './lakeState.ts';
import { photosFor, takePhoto } from './photos.ts';

function since(time: string | null | undefined): string {
  return time ? ` depuis ${fmtUtc(new Date(time))}` : '';
}

/** Props of {@link NavigationButtons}. */
export interface NavigationButtonsProps {
  /** Today's key. */
  today: string;
  /** The open outing is on the lake. */
  lake: boolean;
}

/**
 * Engine, sail, sails, bathing, photo and black water buttons.
 * @param props - Day and water.
 * @returns The content of the « En navigation » section.
 */
export function NavigationButtons({ today, lake }: NavigationButtonsProps) {
  const current = lakeState(today);
  const [pending, setPending] = useState<string | null>(null);
  const start = (key: string) => {
    buzz();
    setPending(key);
  };
  const headsails = headsailNames();
  const photoCount = photosFor('nav', today).length;
  const black = lastBlackWater();
  const blackDate = black ? new Date(black) : null;
  return (
    <>
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
          <span className="mode-ic">⚙️</span>Moteur
          <small>
            {current.motor
              ? `en marche${since(current.motorT)} · toucher pour arrêter`
              : 'arrêté · toucher pour démarrer'}
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
          <span className="mode-ic">⛵</span>Voile
          <small>
            {current.sail
              ? `sous voile${since(current.sailT)} · toucher pour affaler`
              : 'toucher pour hisser'}
          </small>
        </Button>
      </ButtonRow>
      {current.motor && current.sail ? (
        <p className="help prop-both">⛵⚙️ Voile + moteur</p>
      ) : null}
      {current.sail ? (
        <>
          {current.motor ? null : (
            <>
              <h3 className="sub-h">Allure</h3>
              <SailChips
                field="allure"
                options={NAV_ALLURES}
                columns={3}
                current={current}
                pending={pending}
                onPick={start}
              />
            </>
          )}
          <h3 className="sub-h">Grand-voile</h3>
          <SailChips
            field="gv"
            options={NAV_GV}
            columns={4}
            current={current}
            pending={pending}
            onPick={start}
          />
          <h3 className="sub-h">Voile d’avant</h3>
          <SailChips
            field="avant"
            options={
              headsails.length > 0 ? [...headsails, 'Aucune'] : NAV_AVANT
            }
            columns={headsails.length === 3 ? 4 : 3}
            current={current}
            pending={pending}
            onPick={start}
          />
        </>
      ) : null}
      {lake ? (
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
              🏊 Retour de baignade
              <small>
                baignade{since(current.bathT)} · compter tout le monde
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
              🏊 Baignade<small>moteur coupé, échelle sortie</small>
            </Button>
          )}
        </ButtonRow>
      ) : null}
      <ButtonRow className="row c2">
        <Button
          className="btn big"
          data-navphoto="1"
          onClick={() => {
            buzz();
            takePhoto('nav', refreshLakeButtons);
          }}
        >
          📷 + photo
          <small>
            {photoCount ? `${photoCount} aujourd’hui` : 'en navigation'}
          </small>
        </Button>
        <ArmedButton
          className="btn big"
          data-black="1"
          armedLabel="Toucher encore : noter la vidange maintenant"
          onConfirm={noteBlackWater}
        >
          🚽 Eaux noires vidées
          <small>
            {blackDate
              ? `dernière : ${fmtShortDate(blackDate).slice(0, 5)} à ${fmtTime(blackDate)}`
              : 'date et heure'}
          </small>
        </ArmedButton>
      </ButtonRow>
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
