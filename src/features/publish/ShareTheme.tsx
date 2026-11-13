import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

import { setShareTheme, shareTheme } from './shareTheme.ts';
import { LX_THEMES } from './themes.ts';

/**
 * The choice of the layout of every share, in Réglages. A new layout added
 * to {@link LX_THEMES} shows here.
 * @returns The buttons.
 */
export function ShareThemePicker() {
  useSignals();
  const tr = useTr();
  const theme = shareTheme();
  return (
    <>
      <p className="keep-help nav-hint">
        {tr(
          'Une seule mise en page pour toutes les images et tous les PDF partagés.',
        )}
      </p>
      <div className="pub-themes share-themes">
        {LX_THEMES.map(([id, label]) => (
          <Button
            key={id}
            type="button"
            className={theme === id ? 'btn on' : 'btn'}
            data-shareth={id}
            onClick={() => {
              buzz();
              setShareTheme(id);
            }}
          >
            {tr(label)}
          </Button>
        ))}
      </div>
    </>
  );
}

/**
 * The layout a share window will use, and where it is changed.
 * @returns One line.
 */
export function ShareThemeNote() {
  useSignals();
  const tr = useTr();
  const label = LX_THEMES.find(([id]) => id === shareTheme())?.[1] ?? '';
  return (
    <p className="help pub-h share-theme-note">
      {tr(`Mise en page : ${label} (se change dans Réglages › Partages)`)}
    </p>
  );
}
