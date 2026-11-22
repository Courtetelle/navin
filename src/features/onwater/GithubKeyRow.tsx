import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { GITHUB_KEY_SETTING, checkGithubKey } from '../../model/analysis.ts';
import { state, toast, updateSettings } from '../../state/index.ts';

import { KeyAccount } from './KeyAccount.tsx';
import { KeyGuide } from './KeyGuide.tsx';
import { KeyQr } from './KeyQr.tsx';
import { githubKey } from './githubKey.ts';

const fmtDay = (t: number) =>
  new Date(t).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

/**
 * The GitHub key of the analysis of Météo › Prévisions › Situation
 * générale: with it, NavIn asks for the analysis of a new place by itself.
 * Kept with the weather keys: in the full backup, the synchronisation and
 * the QR codes; saving tries it on GitHub.
 * @returns The row.
 */
export function GithubKeyRow() {
  useSignals();
  const tr = useTr();
  const saved =
    state.preferences.settings.value.windAlert?.[GITHUB_KEY_SETTING];
  const key = typeof saved === 'string' && saved ? saved : githubKey();
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const value = input.current?.value.trim() ?? '';
    buzz();
    input.current?.blur();
    updateSettings((settings) => {
      settings.windAlert = {
        ...settings.windAlert,
        [GITHUB_KEY_SETTING]: value,
      };
    });
    if (!value) {
      setResult('');
      toast('Clé GitHub retirée');
      return;
    }
    setBusy(true);
    setResult('Essai de la clé auprès de GitHub…');
    const { ok, end } = await checkGithubKey(value);
    setBusy(false);
    if (ok === null) {
      setResult('GitHub n’a pas répondu : réessayez plus tard.');
      return;
    }
    setResult(
      ok
        ? `Clé acceptée par GitHub${end ? `, valable jusqu’au ${fmtDay(end)}` : ''}. NavIn demande seul l’analyse d’un nouveau lieu.`
        : 'Clé refusée : vérifiez sur GitHub que le dépôt navin est choisi et « Actions : Read and write » (« Où trouver la clé GitHub »).',
    );
  };
  return (
    <div className="field sea-center key-row" data-key="github">
      <form
        className="key-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="cf">
          <label htmlFor="githubKey">
            {tr('🐙 Clé GitHub (analyse météo)')}
          </label>
          <div className="sea-center-row">
            <input
              className="text"
              id="githubKey"
              ref={input}
              // The key is a secret: pasted, never shown in clear.
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={tr('Aucune clé')}
              defaultValue={key}
              key={key}
            />
            <Button className="btn" type="submit" disabled={busy}>
              {tr(busy ? 'Essai…' : 'Enregistrer')}
            </Button>
          </div>
        </div>
        {result ? (
          <p className="keep-help mf-check" role="status">
            {tr(result)}
          </p>
        ) : null}
      </form>
      <KeyQr id="github" value={key} />
      <KeyGuide id="github" name="GitHub" />
      <KeyAccount id="github" name="GitHub" url="https://github.com/login" />
      <HelpText>
        {tr(
          'Facultatif. Une clé GitHub « à droits fins », limitée au dépôt navin (Actions : lecture et écriture). Avec elle, Météo › Prévisions › Situation générale demande seule l’analyse quand la zone de Paramètres change ou quand la dernière a plus de 6 h. Sans elle, « Faire l’analyse de ce lieu » ouvre la page GitHub de l’analyse. Elle part dans la sauvegarde complète et la synchronisation, jamais dans un partage.',
        )}
      </HelpText>
    </div>
  );
}
