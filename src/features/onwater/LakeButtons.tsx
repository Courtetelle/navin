import { useSignals } from '@preact/signals-react/runtime';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { buzz } from '../../lib/dom.ts';
import { dayKey } from '../../lib/format.ts';
import { ensureDay, getDay, isLake, state } from '../../state/index.ts';

import { NavigationButtons } from './NavigationButtons.tsx';
import { WeatherNowBlock } from './WeatherNowBlock.tsx';
import { WindAlert } from './WindAlert.tsx';
import { lakeRefresh, refreshLakeButtons } from './lakeRefresh.ts';
import { updateLakeWx } from './weather.ts';
import type { WeatherNow } from './weatherLogic.ts';

/** Props of {@link LakeButtons}. */
export interface LakeButtonsProps {
  /**
   * Shown in the map's window, outside `#view`: no folding, explanations stay visible.
   * @default false
   */
  inPopup?: boolean;
}

/**
 * Weather, wind alerts and the « En navigation » buttons: engine, sail, sail +
 * engine, point of sail, sails, bathing, photo, black water (legacy
 * `renderLakeButtons`).
 * @param props - Context.
 * @returns `div#lakeBtns`, empty without an open cruise.
 */
export function LakeButtons({ inPopup = false }: LakeButtonsProps) {
  useSignals();
  const open = Boolean(state.data.cruise.value);
  return (
    <div id="lakeBtns">
      {open ? <LakeBox key={lakeRefresh.value} inPopup={inPopup} /> : null}
    </div>
  );
}

function LakeBox({ inPopup }: { inPopup: boolean }) {
  useSignals();
  const lake = isLake();
  const today = dayKey(new Date());
  const weather = getDay(today).wxNow as WeatherNow | undefined;
  const [wxPhase, setWxPhase] = useState<'idle' | 'busy' | 'stuck'>('idle');
  useEffect(() => ensureDay(today), [today]);
  // Discreet update every 30 minutes with a network, once per rebuild of the box.
  const [weatherDue] = useState(
    () => lake && (!weather || Date.now() - weather.at > 30 * 60_000),
  );
  useEffect(() => {
    if (!weatherDue) return undefined;
    const timer = setTimeout(
      () => updateLakeWx({ quiet: true, onDone: refreshLakeButtons }),
      1500,
    );
    return () => clearTimeout(timer);
  }, [weatherDue]);
  return (
    <>
      {lake ? (
        <Box
          inPopup={inPopup}
          className="field lake-wx"
          title="🌤 Météo MeteoSwiss"
        >
          <WeatherNowBlock weather={weather} keep={inPopup} />
          <ButtonRow className="row">
            <Button
              className="btn"
              data-wx="1"
              disabled={wxPhase === 'busy'}
              onClick={() => {
                buzz();
                updateLakeWx({
                  onStart: () => setWxPhase('busy'),
                  onFail: () => setWxPhase('stuck'),
                  onDone: refreshLakeButtons,
                });
              }}
            >
              {wxPhase === 'idle' ? '↻ Mettre à jour (réseau)' : '⏳ Météo…'}
            </Button>
          </ButtonRow>
          <WindAlert keep={inPopup} />
        </Box>
      ) : (
        <Box
          inPopup={inPopup}
          className="field lake-wx"
          title="💨 Alertes de vent"
        >
          <WindAlert keep={inPopup} />
        </Box>
      )}
      <Box inPopup={inPopup} className="field lake-btns" title="En navigation">
        <NavigationButtons today={today} lake={lake} />
      </Box>
    </>
  );
}

function Box({
  inPopup,
  className,
  title,
  children,
}: {
  inPopup: boolean;
  className: string;
  title: string;
  children: ReactNode;
}) {
  if (inPopup) {
    return (
      <section className={className}>
        <h2>
          <span>{title}</span>
        </h2>
        {children}
      </section>
    );
  }
  return (
    <FoldSection
      className={className}
      title={<span>{title}</span>}
      titleText={title}
    >
      {children}
    </FoldSection>
  );
}
