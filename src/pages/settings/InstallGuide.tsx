import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import {
  APP_HOST,
  APP_URL,
  guideTab,
  installPrompt,
  isStandalone,
  platform,
} from '../../features/data/install.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

import { AndroidSteps, IosSteps } from './installSteps.tsx';
import { redrawSettings } from './settingsState.ts';

const SHARED_TEXT =
  'NavIn, le livre de bord du bateau, à installer sur ton téléphone :';
const BEFORE_TITLE = 'Avant de partir :';
const BEFORE_TEXT =
  ' ouvrez l’appli une fois avec du réseau. Elle fonctionne ensuite en mer sans connexion. Les mises à jour arrivent seules quand on l’ouvre avec du réseau, et les données saisies sont conservées.';

function chooseTab(tab: 'ios' | 'android'): void {
  buzz();
  guideTab.value = tab;
  redrawSettings();
  document.querySelector('#installGuide')?.scrollIntoView();
}

async function installNow(): Promise<void> {
  buzz();
  const prompt = installPrompt.value;
  if (!prompt) return;
  void prompt.prompt();
  await prompt.userChoice.catch(() => undefined);
  installPrompt.value = null;
  redrawSettings();
}

async function shareLink(): Promise<void> {
  buzz();
  if (!('share' in navigator)) {
    globalThis.location.href = `mailto:?subject=NavIn&body=${encodeURIComponent(`${SHARED_TEXT} ${APP_URL}`)}`;
    return;
  }
  try {
    await navigator.share({
      title: 'NavIn',
      text: SHARED_TEXT,
      url: APP_URL,
    });
  } catch {
    // The user closed the share sheet.
  }
}

async function copyLink(): Promise<void> {
  buzz();
  try {
    await navigator.clipboard.writeText(APP_URL);
    toast('Lien copié');
  } catch {
    toast(APP_URL);
  }
}

/**
 * Guide to install the app on a phone (legacy `installGuideHtml`,
 * `bindInstallGuide`).
 * @returns The section.
 */
export function InstallGuide() {
  useSignals();
  const tr = useTr();
  const tab = guideTab.value ?? (platform() === 'android' ? 'android' : 'ios');
  const standalone = isStandalone();
  const beforeTitle = tr(BEFORE_TITLE, { help: true });
  const beforeText = tr(BEFORE_TEXT, { help: true });
  return (
    <FoldSection id="installGuide" title="Installer l’appli sur un téléphone">
      {standalone ? (
        <p className="ok-line">
          {tr('✔ L’appli est installée sur ce téléphone.')}
        </p>
      ) : null}
      {installPrompt.value && !standalone ? (
        <ButtonRow>
          <Button
            className="btn big primary"
            id="installNow"
            onClick={() => {
              void installNow();
            }}
          >
            {tr('⬇ Installer maintenant sur ce téléphone')}
          </Button>
        </ButtonRow>
      ) : null}
      <ButtonRow className="row c2">
        <Button
          className={tab === 'ios' ? 'btn on' : 'btn'}
          data-guide="ios"
          onClick={() => chooseTab('ios')}
        >
          {tr('iPhone / iPad')}
        </Button>
        <Button
          className={tab === 'android' ? 'btn on' : 'btn'}
          data-guide="android"
          onClick={() => chooseTab('android')}
        >
          {tr('Android')}
        </Button>
      </ButtonRow>
      <ol className="steps">
        {tab === 'ios' ? (
          <IosSteps host={APP_HOST} />
        ) : (
          <AndroidSteps host={APP_HOST} />
        )}
      </ol>
      <HelpText
        text={`${BEFORE_TITLE}${BEFORE_TEXT}`}
        items={[`${beforeTitle}${beforeText}`]}
      >
        <b>{beforeTitle}</b>
        {beforeText}
      </HelpText>
      <ButtonRow className="row c2">
        <Button
          className="btn"
          id="shareLink"
          onClick={() => {
            void shareLink();
          }}
        >
          {tr('Envoyer le lien')}
        </Button>
        <Button
          className="btn"
          id="copyLink"
          onClick={() => {
            void copyLink();
          }}
        >
          {tr('Copier le lien')}
        </Button>
      </ButtonRow>
      <HelpText style={{ textAlign: 'center' }}>
        {APP_URL.replace('https://', '')}
      </HelpText>
    </FoldSection>
  );
}
