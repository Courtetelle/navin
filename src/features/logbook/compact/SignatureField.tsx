import type { MouseEvent } from 'react';
import { useState } from 'react';

import { ArmedButton } from '../../../components/shared/ArmedButton.tsx';
import { Button } from '../../../components/shared/Button.tsx';
import { ButtonRow } from '../../../components/shared/ButtonRow.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { buzz } from '../../../lib/dom.ts';
import { textOf } from '../../../lib/format.ts';
import type { FieldDefinition } from '../../../model/field.ts';
import { toast } from '../../../state/index.ts';

import { Cell } from './Cell.tsx';
import { FieldLabel } from './FieldLabel.tsx';
import { SignatureOverlay } from './SignatureOverlay.tsx';
import { useCompactForm } from './compactContext.ts';
import { newFieldId } from './fieldIds.ts';

/**
 * A signature: a preview that opens the full screen pad, and once signed the
 * buttons to sign again or erase (legacy `signature`).
 * @param props - The field.
 * @param props.field - Field definition.
 * @returns The cell.
 */
export function SignatureField({ field }: { field: FieldDefinition }) {
  const form = useCompactForm();
  const tr = useTr();
  const [signing, setSigning] = useState(false);
  const [redrawnId, setRedrawnId] = useState<string | undefined>(undefined);
  const { key, label = '' } = field;
  const signature = textOf(form.shown[key]);
  const open = (event: MouseEvent) => {
    event.preventDefault();
    buzz();
    setSigning(true);
  };
  return (
    <Cell field={field} wide>
      <FieldLabel field={field} htmlFor={redrawnId} />
      <Button
        className="sig-preview"
        data-sigopen={key}
        data-label={label}
        onClick={open}
      >
        {signature ? (
          <img src={signature} alt="Signature" />
        ) : (
          <span>{tr('✍ Toucher pour signer')}</span>
        )}
      </Button>
      {signature ? (
        <ButtonRow className="row c2">
          <Button
            className="btn"
            data-sigopen={key}
            data-label={label}
            onClick={open}
          >
            {tr('✍ Signer à nouveau')}
          </Button>
          <ArmedButton
            className="btn"
            data-sigclear={key}
            armedLabel="Confirmer ?"
            onClick={(event) => {
              event.preventDefault();
              buzz();
            }}
            onConfirm={() => {
              form.set(key, null);
              setRedrawnId(newFieldId(key));
            }}
          >
            {tr('Effacer')}
          </ArmedButton>
        </ButtonRow>
      ) : null}
      {signing ? (
        <SignatureOverlay
          title={label}
          onClose={() => setSigning(false)}
          onSave={(image) => {
            form.set(key, image);
            setRedrawnId(newFieldId(key));
            toast('Signature enregistrée');
          }}
        />
      ) : null}
    </Cell>
  );
}
