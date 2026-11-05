import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { ArmedButton } from '../../../components/shared/ArmedButton.tsx';
import { Button } from '../../../components/shared/Button.tsx';
import { ButtonRow } from '../../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../../components/shared/FoldSection.tsx';
import { PageTitle } from '../../../components/shared/PageTitle.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { buzz } from '../../../lib/dom.ts';
import { uid } from '../../../lib/format.ts';
import { TASK_TPL_DEFAULT } from '../../../model/taskTemplate.ts';
import { PageBack, PageDone } from '../../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../../shell/navbar/navHooks.ts';
import {
  resetTaskTpl,
  state,
  toast,
  updateTaskTpl,
} from '../../../state/index.ts';
import { TextInput } from '../TextInput.tsx';

import { TaskLine } from './TaskLine.tsx';
import { useKeepScroll } from './useKeepScroll.ts';

/** Props of {@link TaskTplEdit}. */
export interface TaskTplEditProps {
  /** Leaves the screen. */
  onDone: () => void;
}

/**
 * The rotation template, used by every cruise; saved as it is typed (legacy
 * `renderTaskTplEdit`).
 * @param props - Exit.
 * @returns The screen content.
 */
export function TaskTplEdit({ onDone }: TaskTplEditProps) {
  const [revision, setRevision] = useState(0);
  const keepScroll = useKeepScroll();
  return (
    <EditContent
      key={revision}
      rebuilt={revision > 0}
      onDone={onDone}
      onRebuilt={() => {
        keepScroll();
        setRevision((count) => count + 1);
      }}
    />
  );
}

function EditContent({
  rebuilt,
  onDone,
  onRebuilt,
}: TaskTplEditProps & { rebuilt: boolean; onRebuilt: () => void }) {
  useSignals();
  useNavFields();
  const tr = useTr();
  // The screen shows the template as it was when built, like the legacy render.
  const [template] = useState(
    () => state.data.taskTpl.value ?? TASK_TPL_DEFAULT,
  );
  const tasks = template.tasks;
  const newTask = useRef<HTMLInputElement>(null);
  const exit = () => {
    buzz();
    onDone();
  };
  const add = () => {
    buzz();
    const input = newTask.current;
    const name = input?.value.trim();
    if (!name) {
      toast('Écrivez la tâche');
      input?.focus();
      return;
    }
    updateTaskTpl((draft) => {
      draft.tasks.push({ id: uid(), name, n: 1 });
    });
    toast('Tâche ajoutée');
    onRebuilt();
  };
  const taskOptions = tasks.map((task) => (
    <option key={task.id} value={task.id}>
      {tr(task.name)}
    </option>
  ));
  return (
    <>
      <PageBack label="◀ À bord" id="ttBack" onClick={exit}>
        {tr('◀ À bord')}
      </PageBack>
      <PageTitle
        helps={['Sert à toutes les croisières. Enregistrement automatique.']}
        atTop={!rebuilt}
      >
        Modèle du tournus
      </PageTitle>
      <div className="ck-edit">
        {tasks.map((task, index) => (
          <TaskLine
            key={task.id}
            task={task}
            index={index}
            onRebuilt={onRebuilt}
          />
        ))}
      </div>
      <FoldSection title="Nouvelle tâche">
        <input
          ref={newTask}
          className="text"
          id="ttNew"
          placeholder={tr.placeholder('ex. Quart de nuit, Avitaillement')}
          autoComplete="off"
        />
        <ButtonRow className="row">
          <Button className="btn big primary" id="ttAdd" onClick={add}>
            {tr('＋ Ajouter cette tâche')}
          </Button>
        </ButtonRow>
      </FoldSection>
      <FoldSection title="Premier et dernier jour">
        <label className="cf wide">
          <span>{tr('Le jour de l’arrivée, on commence par')}</span>
          <select
            className="text"
            id="ttFirst"
            defaultValue={template.first}
            onChange={(event) => {
              const { value } = event.currentTarget;
              updateTaskTpl((draft) => {
                draft.first = value;
              });
            }}
          >
            {taskOptions}
          </select>
        </label>
        <label className="cf wide">
          <span>{tr('Le jour du départ, on finit par')}</span>
          <select
            className="text"
            id="ttLast"
            defaultValue={template.last}
            onChange={(event) => {
              const { value } = event.currentTarget;
              updateTaskTpl((draft) => {
                draft.last = value;
              });
            }}
          >
            {taskOptions}
          </select>
        </label>
        <label className="cf wide">
          <span>{tr('Dernier jour, pour tout l’équipage')}</span>
          <TextInput
            className="text"
            id="ttEnd"
            defaultValue={template.end || ''}
            onInput={(event) => {
              const value = event.currentTarget.value.trim();
              updateTaskTpl((draft) => {
                draft.end = value;
              });
            }}
          />
        </label>
      </FoldSection>
      <FoldSection title="Consignes générales">
        <textarea
          className="text"
          id="ttNote"
          rows={4}
          defaultValue={template.note || ''}
          onInput={(event) => {
            const value = event.currentTarget.value.trim();
            updateTaskTpl((draft) => {
              draft.note = value;
            });
          }}
        />
      </FoldSection>
      <ButtonRow className="row c2">
        <PageDone
          label="✔ Terminé"
          className="btn big"
          id="ttDone"
          onClick={exit}
        >
          {tr('✔ Terminé')}
        </PageDone>
        <ArmedButton
          className="btn"
          id="ttDefault"
          armedLabel="Toucher encore : modèle d’origine"
          onClick={buzz}
          onConfirm={() => {
            resetTaskTpl();
            onRebuilt();
          }}
        >
          {tr('↺ Revenir au modèle d’origine')}
        </ArmedButton>
      </ButtonRow>
    </>
  );
}
