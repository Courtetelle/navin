import { Button } from '../../components/shared/Button.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { updateSettings } from '../../state/index.ts';

import { useScaleEnglish } from './useScaleEnglish.ts';

/**
 * The language choice of the Beaufort and Douglas scales (legacy `scaleLangBar`).
 * @returns The chips.
 */
export function ScaleLanguage() {
  const english = useScaleEnglish();
  const tr = useTr();
  return (
    <div className="chips scale-lang">
      <Button
        className={english ? 'btn' : 'btn on'}
        data-slang="fr"
        choice
        onClick={() => choose('fr')}
      >
        {tr('🇫🇷 Français')}
      </Button>
      <Button
        className={english ? 'btn on' : 'btn'}
        data-slang="en"
        choice
        onClick={() => choose('en')}
      >
        {tr('🇬🇧 English')}
      </Button>
    </div>
  );
}

function choose(language: string): void {
  buzz();
  updateSettings((settings) => {
    settings.scaleLang = language;
  });
}
