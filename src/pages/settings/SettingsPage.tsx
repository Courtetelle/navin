import { useSignals } from '@preact/signals-react/runtime';
import type { ReactNode } from 'react';
import { useLayoutEffect, useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { installPrompt } from '../../features/data/install.ts';
import { lakesNote } from '../../features/map/index.ts';
import { WindAlert, windAlertClick } from '../../features/onwater/index.ts';
import { DepthDev, DepthSet, ZoneSim } from '../../features/tracking/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import type { PageProps } from '../../shell/pageTypes.ts';
import { toggleTheme } from '../../shell/theme.ts';
import { UiEditSection } from '../../shell/uiEdit/UiEditSection.tsx';
import { nightOK, state, toast } from '../../state/index.ts';

import { BackupSections } from './BackupSections.tsx';
import { InstallGuide } from './InstallGuide.tsx';
import { MarginRows } from './MarginRows.tsx';
import { OfflineSection } from './OfflineSection.tsx';
import { SimulationSection } from './SimulationSection.tsx';
import {
  AutoLogRows,
  GotoArrivalRows,
  MapLinksRow,
  MapRadiusRows,
  PrefillRow,
  WakeRow,
  WeatherRow,
} from './settingsControls.tsx';
import {
  changeSetting,
  enterSettings,
  noteSectionToggle,
  openSections,
  redrawSettings,
  settingsRedraws,
} from './settingsState.ts';

interface SettingsSectionProps {
  /** Key of the section (`data-sec`). */
  section: string;
  /** Text of the banner. */
  title: string;
  children: ReactNode;
}

function SettingsSection({ section, title, children }: SettingsSectionProps) {
  useSignals();
  const tr = useTr();
  return (
    <details
      className="set-sec"
      data-sec={section}
      open={openSections.value.has(section)}
      onToggle={(event) => {
        noteSectionToggle(section, event.currentTarget.open);
      }}
    >
      <summary>{tr(title)}</summary>
      <div className="set-body">{children}</div>
    </details>
  );
}

function ThemeRow() {
  useSignals();
  const tr = useTr();
  const night = state.preferences.settings.value.theme === 'night';
  return (
    <ButtonRow>
      <Button className="btn big" id="themeToggle" onClick={toggleTheme}>
        {tr(night ? '☀︎ Passer en mode jour' : '☾ Passer en mode nuit')}
        <small>
          {tr(
            night
              ? 'mode nuit actif (rouge, pour garder la vision nocturne)'
              : 'mode jour actif',
          )}
        </small>
      </Button>
    </ButtonRow>
  );
}

function HelpBubblesRow() {
  useSignals();
  const tr = useTr();
  const { noHelpI } = state.preferences.settings.value;
  return (
    <ButtonRow>
      <Button
        className={noHelpI ? 'btn' : 'btn on'}
        id="popBtn"
        onClick={() => {
          changeSetting((settings) => {
            settings.noHelpI = !settings.noHelpI;
          });
          if (noHelpI) {
            setTimeout(() => toast('Bulles d’aide réaffichées'), 50);
          }
        }}
      >
        {tr(
          `${noHelpI ? 'Activer' : 'Désactiver'} l’affichage des bulles d’aide (i)`,
        )}
        <small>{tr('pastilles « i » qui expliquent chaque écran')}</small>
      </Button>
    </ButtonRow>
  );
}

function TestsSection() {
  useSignals();
  const tr = useTr();
  return (
    <>
      <h3>{tr('💨 Test des alertes de vent')}</h3>
      <p className="keep-help nav-hint">
        {tr(
          'Deux bips et deux flashs de couleur, du plus faible au plus fort.',
        )}
      </p>
      <ButtonRow>
        <Button
          className="btn"
          data-walert="test"
          onClick={() => {
            buzz();
            windAlertClick('test');
          }}
        >
          {tr('▶ Test des alertes de vent')}
        </Button>
      </ButtonRow>
      <DepthDev key={settingsRedraws.value} inAlerts />
    </>
  );
}

/**
 * Screen `settings` (legacy `VIEWS.settings`): full-width folding sections, all
 * closed on arrival; the night mode switch only when the gear was touched from
 * a screen used at night.
 * @param props - Page props.
 * @returns The screen.
 */
export function SettingsPage({ from }: PageProps) {
  useSignals();
  const tr = useTr();
  const redrawn = useRef(from === 'settings');
  useLayoutEffect(() => {
    enterSettings(redrawn.current);
  }, []);
  const zone = state.view.zoneSimV.value;
  const { theme, windAlert } = state.preferences.settings.value;
  const prompt = installPrompt.value;
  useLayoutEffect(() => {
    redrawSettings();
  }, [zone, theme, windAlert, prompt]);
  return (
    <>
      <PageTitle>Réglages</PageTitle>
      <div className="set-secs">
        <SettingsSection section="zone" title="🧭 Zone et écran">
          {nightOK() ? <ThemeRow /> : null}
          <ZoneSim />
          <WakeRow />
          <HelpBubblesRow />
        </SettingsSection>
        <SettingsSection section="trace" title="🛰 Traceur et journal">
          <AutoLogRows />
          <GotoArrivalRows />
          <PrefillRow />
          <WeatherRow />
        </SettingsSection>
        <SettingsSection section="alert" title="⚠️ Alertes">
          <h3>{tr('Alertes de vent')}</h3>
          <WindAlert noTest />
          <DepthSet />
        </SettingsSection>
        <SettingsSection section="simu" title="🆘 Simulation SOS">
          <SimulationSection />
        </SettingsSection>
        <SettingsSection section="tests" title="🧪 Tests">
          <TestsSection />
        </SettingsSection>
        <SettingsSection section="maps" title="🗺 Cartes">
          <MapRadiusRows />
          <HelpText nextIsRow>{`🗺 Cartes intégrées : ${lakesNote()}`}</HelpText>
          <MapLinksRow />
        </SettingsSection>
        <SettingsSection section="boats" title="🚤 Calculs des bateaux">
          <MarginRows />
        </SettingsSection>
        <SettingsSection
          section="data"
          title="🔄 Sauvegarde et synchronisation"
        >
          <BackupSections />
        </SettingsSection>
        <SettingsSection
          section="install"
          title="📲 Installation et hors ligne"
        >
          <InstallGuide />
          <OfflineSection />
        </SettingsSection>
        <SettingsSection section="dev" title="🛠 Mode développeur">
          <UiEditSection />
        </SettingsSection>
      </div>
    </>
  );
}
