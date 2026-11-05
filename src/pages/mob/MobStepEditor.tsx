import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { MarqueeInput } from '../../features/safety/MarqueeInput.tsx';
import type { MobSection, MobStep } from '../../features/safety/mobDefaults.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

/** Props of {@link MobStepEditor}. */
export interface MobStepEditorProps {
  /** Index of the step. */
  step: number;
  title: string;
  details: string;
  /** Changes the section and saves. */
  onEdit: (recipe: (section: MobSection) => void) => void;
  onRedraw: () => void;
}

/**
 * One step in the editor: title, details, move up, delete.
 * @param props - Step and actions.
 * @returns The row.
 */
export function MobStepEditor({
  step,
  title,
  details,
  onEdit,
  onRedraw,
}: MobStepEditorProps) {
  const tr = useTr();
  return (
    <div className="ck-row tt-row">
      <MarqueeInput
        className="text"
        data-mt={step}
        defaultValue={title}
        aria-label={`Étape ${step + 1}`}
        onChange={(event) => {
          const value = event.target.value.trim();
          if (!value) return;
          onEdit((section) => {
            (section.steps[step] as MobStep)[0] = value;
          });
        }}
      />
      <textarea
        className="text"
        rows={3}
        data-md={step}
        placeholder={tr.placeholder('Détail (facultatif)')}
        defaultValue={details}
        onChange={(event) => {
          const value = event.target.value.trim();
          onEdit((section) => {
            (section.steps[step] as MobStep)[1] = value;
          });
        }}
      />
      <div className="ck-tools">
        <Button
          className="btn"
          data-up={step}
          disabled={step === 0}
          aria-label="Monter"
          onClick={() => {
            buzz();
            onEdit(({ steps }) => {
              const moved = steps[step] as MobStep;
              steps[step] = steps[step - 1] as MobStep;
              steps[step - 1] = moved;
            });
            onRedraw();
          }}
        >
          ▲
        </Button>
        <ArmedButton
          className="btn danger"
          data-del={step}
          aria-label="Supprimer"
          armedLabel={tr('Sûr ?')}
          onClick={buzz}
          onConfirm={() => {
            onEdit((section) => {
              section.steps.splice(step, 1);
            });
            onRedraw();
          }}
        >
          ✕
        </ArmedButton>
      </div>
    </div>
  );
}
