import { useSignals } from '@preact/signals-react/runtime';

import { TzTime } from '../../components/shared/TzTime.tsx';
import type { MobLogRecord } from '../../features/safety/mobLog.ts';
import { mobActive, mobLive } from '../../features/safety/mobLog.ts';
import { mobZone } from '../../features/safety/mobProcedures.ts';
import { pad } from '../../lib/format.ts';
import { bearing, distNM, fmtPos } from '../../lib/geo.ts';
import { lastKnownPos } from '../../state/index.ts';

/**
 * The MOB position and ours, updated as the GPS answers (legacy `#mobPosBox`).
 * @returns The box.
 */
export function MobPosBox() {
  useSignals();
  const log = mobActive();
  const lake = mobZone.value === 'lac';
  return (
    <div className={lake ? 'mob-pos mob-pos-lake' : 'mob-pos'} id="mobPosBox">
      {log ? <RecordedPosition log={log} /> : <NoPositionYet />}
    </div>
  );
}

function NoPositionYet() {
  const current = mobLive.value ?? lastKnownPos();
  return (
    <>
      <div className="mob-pos-main">
        📍 MOB : <b>pas encore enregistrée</b>
        <br />
        <small>« Démarrer le log » l’enregistre tout de suite</small>
      </div>
      <div className="mob-pos-cur">
        Nous :{' '}
        {current ? (
          <>
            <b>{fmtPos(current)}</b>
            {current.at ? (
              <>
                {' '}
                <TzTime date={current.at} seconds />
              </>
            ) : null}
          </>
        ) : (
          'recherche GPS…'
        )}
      </div>
    </>
  );
}

function RecordedPosition({ log }: { log: MobLogRecord }) {
  const { mobPos, lastPos } = log;
  if (!mobPos) return <b>📍 Position MOB : recherche GPS…</b>;
  const metres = lastPos ? distNM(lastPos, mobPos) * 1852 : 0;
  return (
    <>
      <div className="mob-pos-main">
        📍 MOB : <b>{fmtPos(mobPos)}</b> <TzTime date={mobPos.t} seconds />
      </div>
      {lastPos ? (
        <div className="mob-pos-cur">
          Nous : {fmtPos(lastPos)} <TzTime date={lastPos.t} seconds />
          {metres >= 5 ? (
            <>
              {' · MOB à '}
              <b>{Math.round(metres)} m</b>
              {' au '}
              <b>{pad(Math.round(bearing(lastPos, mobPos)) % 360, 3)}°</b>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
