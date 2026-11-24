import { useSignals } from '@preact/signals-react/runtime';
import type { ReactElement, ReactNode } from 'react';
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { AlertSwitch } from '../../components/shared/AlertSwitch.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { MenuSortButton } from '../../components/shared/MenuSortButton.tsx';
import { TitleInNav } from '../../components/shared/TitleInNav.tsx';
import { WindsockIcon } from '../../components/shared/WindsockIcon.tsx';
import { bumpIn, inMenuOrder } from '../../features/data/dataOrder.ts';
import { RoutingShiftSection } from '../../features/map/RoutingShiftSection.tsx';
import {
  ALERT_KINDS,
  ReOnChoices,
  WindAlert,
  WindKeys,
  alertOn,
  setAlertOn,
  windAlertClick,
} from '../../features/onwater/index.ts';
import {
  alertsInTurnTest,
  lakeWarnTest,
} from '../../features/onwater/lakeWarnWatch.ts';
import { lightningTest } from '../../features/onwater/lightningWatch.ts';
import { ShareThemePicker } from '../../features/publish/index.ts';
import { ShomSection } from '../../features/sea/ShomSection.tsx';
import {
  DepthDev,
  DepthSet,
  ZoneSim,
  depthAlarmSet,
} from '../../features/tracking/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { BUILD_ID } from '../../model/buildId.ts';
import { exitOrigin } from '../../shell/exitOrigin.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import type { PageProps } from '../../shell/pageTypes.ts';
import { go } from '../../shell/router.ts';
import { toggleTheme } from '../../shell/theme.ts';
import { nightOK, state, toast } from '../../state/index.ts';
import { LakeWarnSetting } from '../weather/LakeWarnings.tsx';
import { LightningSetting } from '../weather/LightningAlert.tsx';

import { BackupSections } from './BackupSections.tsx';
import { LakeCenterRow } from './LakeCenterRow.tsx';
import { LangRow } from './LangRow.tsx';
import { LiveRow } from './LiveRow.tsx';
import { MarginRows } from './MarginRows.tsx';
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
  /**
   * A drawn sign before the text (instead of an emoji).
   * @default undefined
   */
  icon?: ReactNode;
  /**
   * Its own menu (Alertes): the keys of the sections it holds, each a band
   * on its page and opened alone.
   * @default undefined
   */
  subs?: readonly string[];
  /**
   * What its page shows above the bands of its sections.
   * @default undefined
   */
  lead?: ReactNode;
  children: ReactNode;
}

/** The section shown, empty on the menu of the settings. */
const ShownSection = createContext('');

/** Keys of the sections in the menu, in the order shown. */
const ShownOrder = createContext<readonly string[]>([]);

/** The menu a section is a band of: '' the menu of Paramétrages. */
const MenuOf = createContext('');

/** The sections of the Alertes menu, in their order (the tests last). */
const ALERT_SECTIONS = [
  'wind',
  'lightning',
  'lakes',
  'alert',
  'live',
  'tests',
] as const;

/**
 * The section is one of the Alertes menu.
 * @param section - Its key.
 * @returns Whether it is.
 */
function inAlerts(section: string): boolean {
  return (ALERT_SECTIONS as readonly string[]).includes(section);
}

/**
 * The sections of the menu in the order chosen at the right of the title:
 * alphabetical, or by their use.
 * @param props - The sections.
 * @param props.children - The `SettingsSection` elements.
 * @returns The sections sorted.
 */
function SortedSections({ children }: { children: ReactNode }) {
  useSignals();
  const tr = useTr();
  const sections = Children.toArray(children).filter(
    (child): child is ReactElement<SettingsSectionProps> =>
      isValidElement<SettingsSectionProps>(child),
  );
  const sorted = inMenuOrder(
    'settings',
    sections,
    (section) => section.props.section,
    (section) => tr(section.props.title),
  );
  return (
    <ShownOrder.Provider value={sorted.map((section) => section.props.section)}>
      {sorted}
    </ShownOrder.Provider>
  );
}

/**
 * A section of the settings, as the wind alerts of the Météo menu: on the
 * menu a band that opens it; opened, its content alone on the page (its
 * title fixed at the top, ◀ back to the menu).
 * @param props - The section.
 * @returns The band, the content, or nothing.
 */
function SettingsSection({
  section,
  title,
  icon,
  subs,
  lead,
  children,
}: SettingsSectionProps) {
  const tr = useTr();
  const shown = useContext(ShownSection);
  const order = useContext(ShownOrder);
  const menu = useContext(MenuOf);
  // A section of its own menu is open: it draws alone.
  if (shown && subs?.includes(shown)) {
    return <MenuOf.Provider value={section}>{children}</MenuOf.Provider>;
  }
  if (shown === menu) {
    return (
      <Button
        type="button"
        className="btn big set-entry"
        data-sec={section}
        onClick={() => {
          buzz();
          // The Alertes menu keeps its own order.
          if (!menu) bumpIn('settings', order, section);
          go('settings', section);
        }}
      >
        {icon ? <span className="set-entry-ico">{icon}</span> : null}
        {tr(title)}
      </Button>
    );
  }
  if (shown !== section) return null;
  return (
    <>
      <TitleInNav>
        <h1>
          {icon ? <span className="set-entry-ico">{icon}</span> : null}
          {tr(title)}
        </h1>
      </TitleInNav>
      <div className="set-page set-body" data-sec={section}>
        {lead}
        <MenuOf.Provider value={section}>{children}</MenuOf.Provider>
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

/**
 * At the top of Alertes: every alert switched off or on at once, and when
 * they come back on.
 * @returns The block.
 */
function AllAlerts() {
  useSignals();
  const tr = useTr();
  const settings = state.preferences.settings.value;
  const live = ALERT_KINDS.filter((kind) => alertOn(kind, settings)).length;
  const anyOn = live > 0;
  // The state first, then what a touch does: green while on, red once off.
  let onText = 'Alertes actives · toucher pour les désactiver';
  if (anyOn && live < ALERT_KINDS.length) {
    onText = `${live} alertes sur ${ALERT_KINDS.length} actives · toucher pour les désactiver`;
  }
  return (
    <div className="all-alerts">
      <ButtonRow>
        <AlertSwitch
          className="big"
          on={anyOn}
          onText={onText}
          offText="Alertes désactivées · toucher pour les réactiver"
          data-alerts="all"
          onClick={() => {
            buzz();
            for (const kind of ALERT_KINDS) {
              if (alertOn(kind) === anyOn) setAlertOn(kind, !anyOn);
            }
            // An alarm sounding stops at once.
            if (anyOn) depthAlarmSet(0);
            toast(
              anyOn
                ? '🔕 Toutes les alertes coupées'
                : '🔔 Toutes les alertes actives',
            );
          }}
        />
      </ButtonRow>
      <ReOnChoices kind="all" />
      <h3>{tr('Chaque alerte')}</h3>
    </div>
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
      <h3>{tr('⚡ Test de l’alerte orage')}</h3>
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
          {tr('▶ Test de l’alerte orage')}
        </Button>
      </ButtonRow>
      <h3>{tr('🚨 Test des feux d’avis des lacs')}</h3>
      <p className="keep-help nav-hint">
        {tr(
          'La bulle et le son pour le Grand Lac : 40 éclats/min (vent fort, trois bips) ou 90 éclats/min (tempête, six bips aigus plus forts, lampe et écran qui flashent).',
        )}
      </p>
      <ButtonRow className="row c2">
        <Button
          className="btn"
          data-lakewarn="test"
          onClick={() => {
            buzz();
            lakeWarnTest(2);
          }}
        >
          {tr('▶ 40 éclats/min · vent fort')}
        </Button>
        <Button
          className="btn"
          data-lakewarn="test-storm"
          onClick={() => {
            buzz();
            lakeWarnTest(3);
          }}
        >
          {tr('▶ 90 éclats/min · tempête')}
        </Button>
      </ButtonRow>
      <h3>{tr('🔔 Test de plusieurs alertes à la suite')}</h3>
      <p className="keep-help nav-hint">
        {tr(
          'Vent, orages et feux d’avis en même temps : les bulles viennent l’une après l’autre, chacune au toucher de la précédente.',
        )}
      </p>
      <ButtonRow>
        <Button
          className="btn"
          data-alerts="in-turn"
          onClick={() => {
            buzz();
            alertsInTurnTest();
          }}
        >
          {tr('▶ Test de plusieurs alertes à la suite')}
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
  // Paramétrages forgets the history: the screen it came from is kept here.
  const [cameFrom] = useState(() => from || 'tracker');
  // Opened by a « sortir vers Paramétrages » link: « Revenir » in the fixed
  // line of the menu of Paramétrages, until it is left another way.
  const [origin] = useState(() => {
    const kept = exitOrigin.peek();
    if (kept && from !== 'settings' && from !== kept.view) {
      exitOrigin.value = null;
    }
    return exitOrigin.peek();
  });
  useLayoutEffect(() => {
    enterSettings(redrawn.current);
  }, []);
  let backLabel = '◀ Paramétrages';
  if (elsewhere) backLabel = '◀ Retour';
  else if (inAlerts(section)) backLabel = '◀ Alertes';
  const zone = state.view.zoneSimV.value;
  const { theme, windAlert } = state.preferences.settings.value;
  useLayoutEffect(() => {
    redrawSettings();
  }, [zone, theme, windAlert]);
  return (
    <>
      {section ? null : (
        <TitleInNav>
          <h1 className="menu-title">
            {tr('Paramétrages')}
            <MenuSortButton menu="settings" />
          </h1>
        </TitleInNav>
      )}
      {origin && (!section || elsewhere) ? (
        // Opened by a « sortir vers Paramétrages » link: « Revenir » in the
        // fixed line, at the left of the title, back there.
        <PageBack
          label="◀ Revenir"
          data-go={origin.view}
          data-revenir="1"
          onClick={() => {
            buzz();
            exitOrigin.value = null;
            go(origin.view, origin.arg);
          }}
        >
          {tr('◀ Revenir')}
        </PageBack>
      ) : null}
      {section && !(origin && elsewhere) ? (
        // At the top of the page: it joins the fixed title line.
        // Opened from elsewhere (the radius button of the map, the Météo
        // menu): ◀ goes back there; from the menu of Paramétrages, back to
        // it; a section of Alertes, back to Alertes.
        <PageBack
          label={backLabel}
          data-go={elsewhere ? 'back' : 'settings'}
          onClick={() => {
            buzz();
            if (elsewhere) go(cameFrom);
            else if (inAlerts(section)) go('settings', 'alerts');
            else go('settings');
          }}
        >
          {tr(backLabel)}
        </PageBack>
      ) : null}
      <ShownSection.Provider value={section}>
        <div className={section ? 'set-one' : 'set-secs set-menu'}>
          <SortedSections>
            <SettingsSection
              section="zone"
              title="🧭 Zone de carte, Langue, Préférences d’affichage"
            >
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
            <SettingsSection
              section="alerts"
              title="🔔 Alertes"
              subs={ALERT_SECTIONS}
              lead={<AllAlerts />}
            >
              <SettingsSection
                section="wind"
                title="Alerte vent"
                icon={<WindsockIcon />}
              >
                <WindAlert noTest />
              </SettingsSection>
              <SettingsSection section="lightning" title="⚡ Alerte orage">
                <LightningSetting />
              </SettingsSection>
              <SettingsSection
                section="lakes"
                title="🚨 Alerte feux d’avis des lacs"
              >
                <LakeWarnSetting />
              </SettingsSection>
              <SettingsSection section="alert" title="⚠️ Alerte de profondeur">
                <DepthSet reOn={<ReOnChoices kind="depth" />} />
              </SettingsSection>
              <SettingsSection
                section="live"
                title="🌬 LiveMétéo · zones et enregistrement des stations"
              >
                <LiveRow />
              </SettingsSection>
              <SettingsSection section="tests" title="🧪 Tests des alertes">
                <TestsSection />
              </SettingsSection>
            </SettingsSection>
            <SettingsSection
              section="keys"
              title="🔑 Clés météos et compte relais (Cloudflare)"
            >
              <WindKeys />
            </SettingsSection>
            <SettingsSection section="routages" title="🧭 Routages">
              <RoutingShiftSection />
            </SettingsSection>
            <SettingsSection
              section="shom"
              title="🌊 Courants et marées : Copernicus, ou abonnement SHOM"
            >
              <ShomSection />
            </SettingsSection>
            <SettingsSection
              section="share"
              title="📤 Style des documents partagés"
            >
              <ShareThemePicker />
            </SettingsSection>
            <SettingsSection section="simu" title="🆘 Simulation SOS">
              <SimulationSection />
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
          </SortedSections>
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
