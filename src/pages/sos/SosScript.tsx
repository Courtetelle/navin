import { untracked } from '@preact/signals-react';
import { useLayoutEffect } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { ScriptLines } from '../../features/safety/ScriptLines.tsx';
import { sosContext } from '../../features/safety/sosContext.ts';
import type { SosKind } from '../../features/safety/sosScripts.ts';
import { SOS } from '../../features/safety/sosScripts.ts';
import { buzz } from '../../lib/dom.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { lastKnownPos, state } from '../../state/index.ts';

/** Props of {@link SosScript}. */
export interface SosScriptProps {
  kind: SosKind;
  /** Index of the nature chosen, or `null`. */
  nature: number | null;
  onNature: (nature: number) => void;
  onBack: () => void;
}

/**
 * A pre-filled radio message (legacy `renderSosScript`); it needs an open cruise.
 * @param props - Message, nature and actions.
 * @returns The screen content.
 */
export function SosScript({ kind, nature, onNature, onBack }: SosScriptProps) {
  const procedure = SOS[kind];
  const chosen =
    procedure.natures && nature != null ? procedure.natures[nature] : null;
  const lines = untracked(() => {
    const cruise = state.data.cruise.value;
    if (!cruise) return [];
    return procedure.script(
      sosContext(
        {
          info: cruise.info,
          crew: cruise.crew,
          position: lastKnownPos(),
          now: new Date(),
        },
        chosen ?? null,
      ),
    );
  });
  useLayoutEffect(() => {
    globalThis.scrollTo(0, 0);
  }, []);
  return (
    <>
      <PageBack
        label="◀ Retour"
        id="back"
        onClick={() => {
          buzz();
          onBack();
        }}
      />
      <h1 className={`sos-title ${procedure.cls}`}>{procedure.title}</h1>
      <details className="section" open>
        <summary>Procédure ASN (bouton DSC de la VHF)</summary>
        <ol className="asn">
          {procedure.asn.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>
      {procedure.natures ? (
        <>
          <h2 className="sub-h">Nature</h2>
          <ButtonRow className="row c2">
            {procedure.natures.map((item, index) => (
              <Button
                key={item[0]}
                className={index === nature ? 'btn on' : 'btn'}
                data-n={index}
                onClick={() => {
                  buzz();
                  onNature(index);
                }}
              >
                {item[0]}
              </Button>
            ))}
          </ButtonRow>
        </>
      ) : null}
      <div className="script">
        <ScriptLines lines={lines} />
      </div>
      <HelpText>
        Heure UTC calculée par le téléphone. Position : dernière position GPS
        connue (actualisable sur la page SOS).
      </HelpText>
    </>
  );
}
