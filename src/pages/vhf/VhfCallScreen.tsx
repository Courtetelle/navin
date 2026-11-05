import { useSignals } from '@preact/signals-react/runtime';
import { useLayoutEffect } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { MarqueeInput } from '../../features/safety/MarqueeInput.tsx';
import { ScriptLines } from '../../features/safety/ScriptLines.tsx';
import { TitleWithHelp } from '../../features/safety/TitleWithHelp.tsx';
import { VHF_ASK, VHF_CALLS } from '../../features/safety/vhfCalls.ts';
import { vhfSettingKey } from '../../features/safety/vhfContext.ts';
import { currentVhfContext } from '../../features/safety/vhfState.ts';
import type { VhfCallKey } from '../../features/safety/vhfTypes.ts';
import { buzz } from '../../lib/dom.ts';
import { textOf } from '../../lib/format.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { go } from '../../shell/router.ts';
import { state, updateSettings } from '../../state/index.ts';

/** Props of {@link VhfCallScreen}. */
export interface VhfCallScreenProps {
  call: VhfCallKey;
  onBack: () => void;
}

/**
 * A routine call: the fields to complete and the message, redrawn on every
 * keystroke (legacy `renderVhfScript`).
 * @param props - Call and back action.
 * @returns The screen content.
 */
export function VhfCallScreen({ call, onBack }: VhfCallScreenProps) {
  useSignals();
  useNavFields();
  const definition = VHF_CALLS[call];
  const context = currentVhfContext(call);
  const info = state.data.cruise.value?.info;
  useLayoutEffect(() => {
    globalThis.scrollTo(0, 0);
  }, []);
  return (
    <>
      <PageBack
        label="◀ Appels VHF"
        id="back"
        onClick={() => {
          buzz();
          onBack();
        }}
      />
      <TitleWithHelp className="sos-title vhf" help={definition.tip}>
        {definition.title}
      </TitleWithHelp>
      <div className="vhf-ask">
        {definition.ask.map((field) => {
          const ask = VHF_ASK[field];
          return (
            <label
              key={field}
              className={ask.num || field === 'eta' ? 'field' : 'field wide'}
            >
              <span>{ask.label}</span>
              <MarqueeInput
                data-ask={field}
                defaultValue={textOf(context.raw(field))}
                placeholder={ask.ph}
                inputMode={ask.num ? 'numeric' : undefined}
                autoComplete="off"
                onChange={(event) => {
                  const { value } = event.target;
                  updateSettings((settings) => {
                    const remembered = settings.vhf as Record<string, string>;
                    remembered[vhfSettingKey(field, call)] = value;
                  });
                }}
              />
            </label>
          );
        })}
      </div>
      <div className="script" id="vhfScript">
        <ScriptLines lines={definition.script(context)} />
      </div>
      <HelpText>
        Bateau, indicatif, MMSI et dimensions viennent de Bateau et croisière.
        Position : dernière position GPS connue.
      </HelpText>
      {!info?.boat || !info.loa ? (
        <Button
          className="btn"
          data-go="info"
          onClick={() => {
            buzz();
            go('info');
          }}
        >
          Compléter dans Bateau et croisière
        </Button>
      ) : null}
    </>
  );
}
