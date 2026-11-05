import { ArmedButton } from '../../../components/shared/ArmedButton.tsx';
import { Button } from '../../../components/shared/Button.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { buzz } from '../../../lib/dom.ts';
import type { Task } from '../../../model/types.ts';
import { updateTaskTpl } from '../../../state/index.ts';
import { TextInput } from '../TextInput.tsx';

/** Props of {@link TaskLine}. */
export interface TaskLineProps {
  task: Task;
  /** Position in the template. */
  index: number;
  /** Rebuild the screen. */
  onRebuilt: () => void;
}

/**
 * One task of the template: name, people, role, ▲ and ✕ (legacy `renderTaskTplEdit`).
 * @param props - Task and position.
 * @returns The line.
 */
export function TaskLine({ task, index, onRebuilt }: TaskLineProps) {
  const tr = useTr();
  const change = (recipe: (draft: Task) => void) => {
    updateTaskTpl((draft) => {
      const target = draft.tasks[index];
      if (target) recipe(target);
    });
  };
  return (
    <div className="ck-row tt-row">
      <TextInput
        className="text"
        data-tname={index}
        defaultValue={task.name}
        aria-label={`Tâche ${index + 1}`}
        onInput={(event) => {
          const value = event.currentTarget.value.trim();
          if (!value) return;
          change((draft) => {
            draft.name = value;
          });
        }}
      />
      <label className="ck-unit">
        {tr('Personnes ')}
        <select
          data-tn={index}
          defaultValue={String(task.n)}
          onChange={(event) => {
            const value = Number(event.currentTarget.value);
            change((draft) => {
              draft.n = value;
            });
          }}
        >
          {[1, 2, 3, 4].map((count) => (
            <option key={count}>{count}</option>
          ))}
        </select>
      </label>
      <textarea
        className="text"
        rows={2}
        data-tdesc={index}
        placeholder={tr.placeholder('Rôle, consignes (facultatif)')}
        defaultValue={task.desc ?? ''}
        onInput={(event) => {
          const value = event.currentTarget.value.trim();
          change((draft) => {
            draft.desc = value;
          });
        }}
      />
      <div className="ck-tools">
        <Button
          className="btn"
          data-up={index}
          disabled={index === 0}
          aria-label="Monter"
          onClick={() => {
            buzz();
            updateTaskTpl((draft) => {
              const { tasks } = draft;
              const above = tasks[index - 1] as Task;
              tasks[index - 1] = tasks[index] as Task;
              tasks[index] = above;
            });
            onRebuilt();
          }}
        >
          ▲
        </Button>
        <ArmedButton
          className="btn danger"
          data-del={index}
          aria-label="Supprimer"
          armedLabel="Sûr ?"
          onClick={buzz}
          onConfirm={() => {
            updateTaskTpl((draft) => {
              draft.tasks.splice(index, 1);
            });
            onRebuilt();
          }}
        >
          ✕
        </ArmedButton>
      </div>
    </div>
  );
}
