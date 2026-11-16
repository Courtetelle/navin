import { useSignals } from '@preact/signals-react/runtime';

import { state } from '../../state/index.ts';

import { keyProblems, standing } from './keyHealth.ts';

/**
 * At the top of Paramétrages › Clés météo: a key ended, ending soon or refused,
 * and what to do, until a new key is saved (NavIn says it once a day too).
 * @returns The notice, or nothing.
 */
export function KeyHealthNotice() {
  useSignals();
  // The settings read: a new key saved clears its line at once.
  const problems = standing(
    keyProblems.value,
    state.preferences.settings.value.windAlert ?? {},
  );
  if (problems.length === 0) return null;
  return (
    <div className="key-health" role="alert">
      {problems.map((problem) => (
        <p key={problem.id}>
          <b>⚠️ {problem.text}</b>
          <br />À faire : {problem.todo}
        </p>
      ))}
    </div>
  );
}
