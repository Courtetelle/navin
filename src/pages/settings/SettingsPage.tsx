import { useSignals } from '@preact/signals-react/runtime';
import type { ReactNode } from 'react';
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { TitleInNav } from '../../components/shared/TitleInNav.tsx';
import { installPrompt } from '../../features/data/install.ts';
import { WindKeys, windAlertClick } from '../../features/onwater/index.ts';
import { lightningTest } from '../../features/onwater/lightningWatch.ts';
import { ShareThemePicker } from '../../features/publish/index.ts';
import { DepthDev, DepthSet, ZoneSim } from '../../features/tracking/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { BUILD_ID } from '../../model/buildId.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import type { PageProps } from '../../shell/pageTypes.ts';
import { go } from '../../shell/router.ts';
import { toggleTheme } from '../../shell/theme.ts';
import { UiEditSection } from '../../shell/uiEdit/UiEditSection.tsx';
import { nightOK, state, toast } from '../../state/index.ts';

import { BackupSections } from './BackupSections.tsx';
import { InstallGuide } from './InstallGuide.tsx';
import { LakeCenterRow } from './LakeCenterRow.tsx';
import { LangRow } from './LangRow.tsx';
import { LiveRow } from './LiveRow.tsx';
import { MarginRows } from './MarginRows.tsx';
import { OfflineSection } from './OfflineSection.tsx';
import { SeaCenterRow } from './SeaCenterRow.tsx';
import { SimulationSection } from './SimulationSection.tsx';
import {
  AutoLogRows,
  GotoArrivalRows,
  PrefillRow,
  WakeRow,
  WeatherRow,
} from './settingsControls.tsx';
import {
  changeSetting,
  enterSettings,
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

/** The section shown, empty on the menu of the settings. */
const ShownSection = createContext('');

/**
 * A section of the settings, as the wind alerts of the Météo menu: on the
 * menu a band that opens it; opened, its content alone on the page (its
 * title fixed at the top, ◀ back to the menu).
 * @param props - The section.
 * @returns The band, the content, or nothing.
 */
function SettingsSection({ section, title, children }: SettingsSectionProps) {
  const tr = useTr();
  const shown = useContext(ShownSection);
  if (!shown) {
    return (
      <Button
        type="button"
        className="btn big set-entry"
        data-sec={section}
        onClick={() => {
          buzz();
          go('settings', section);
        }}
      >
        {tr(title)}
      </Button>
    );
  }
  if (shown !== section) return null;
  return (
    <>
      <TitleInNav>
        <h1>{tr(title)}</h1>
      </TitleInNav>
      <div className="set-page set-body" data-sec={section}>
        {children}
      </div>
    </>
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
      <h3>{tr('⚡ Test de l’alerte foudre')}</h3>
      <p className="keep-help nav-hint">
        {tr(
          'Trois bips courts, l’écran qui flashe et la bulle, comme pour un orage à 12 NM qui se rapproche.',
        )}
      </p>
      <ButtonRow>
        <Button
          className="btn"
          data-lightning="test"
          onClick={() => {
            buzz();
            lightningTest();
          }}
        >
          {tr('▶ Test de l’alerte foudre')}
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
export function SettingsPage({ from, arg }: PageProps) {
  useSignals();
  const tr = useTr();
  const redrawn = useRef(from === 'settings');
  // A section opened alone (from the menu, or « Clés météo » of Météo).
  const section = typeof arg === 'string' ? arg : '';
  // A section opened straight from another screen, not from this menu.
  const [elsewhere] = useState(() => Boolean(section) && from !== 'settings');
  // Réglages forgets the history: the screen it came from is kept here.
  const [cameFrom] = useState(() => from || 'tracker');
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
      {section ? null : (
        <TitleInNav>
          <h1>{tr('Réglages')}</h1>
        </TitleInNav>
      )}
      {section ? (
        // At the top of the page: it joins the fixed title line.
        // Opened from elsewhere (the radius button of the map, the Météo
        // menu): ◀ goes back there; from the menu of Réglages, back to it.
        <PageBack
          label={elsewhere ? '◀ Retour' : '◀ Réglages'}
          data-go={elsewhere ? 'back' : 'settings'}
          onClick={() => {
            buzz();
            if (elsewhere) go(cameFrom);
            else go('settings');
          }}
        >
          {tr(elsewhere ? '◀ Retour' : '◀ Réglages')}
        </PageBack>
      ) : null}
      <ShownSection.Provider value={section}>
        <div className={section ? 'set-one' : 'set-secs set-menu'}>
          <SettingsSection section="zone" title="🧭 Zone et écran">
            {nightOK() ? <ThemeRow /> : null}
            <ZoneSim />
            <SeaCenterRow basin="atl" />
            <SeaCenterRow basin="med" />
            <LakeCenterRow />
            <LangRow />
            <WakeRow />
            <HelpBubblesRow />
          </SettingsSection>
          <SettingsSection section="trace" title="🛰 Traceur et journal">
            <AutoLogRows />
            <GotoArrivalRows />
            <PrefillRow />
            <WeatherRow />
          </SettingsSection>
          <SettingsSection section="live" title="🌬 LiveMétéo">
            <LiveRow />
          </SettingsSection>
          <SettingsSection section="keys" title="🔑 Clés météo">
            <WindKeys />
          </SettingsSection>
          <SettingsSection section="alert" title="⚠️ Alerte de profondeur">
            <DepthSet />
          </SettingsSection>
          <SettingsSection section="share" title="📤 Partages">
            <h3>{tr('Mise en page')}</h3>
            <ShareThemePicker />
          </SettingsSection>
          <SettingsSection section="simu" title="🆘 Simulation SOS">
            <SimulationSection />
          </SettingsSection>
          <SettingsSection section="tests" title="🧪 Tests">
            <TestsSection />
          </SettingsSection>
          <SettingsSection
            section="boats"
            title="🚤 Marges de sécurité et rapports de longueurs"
          >
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
      </ShownSection.Provider>
      {section ? null : (
        <p className="help" id="buildId">
          Version {BUILD_ID}
        </p>
      )}
    </>
  );
}
