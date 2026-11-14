import type { LazyExoticComponent } from 'react';
import { lazy } from 'react';

import type { PageComponent } from './pageTypes.ts';
import type { ViewName } from './routing.ts';

type PageModule = Promise<{ default: PageComponent }>;

/** Module loader of every screen (one folder per screen in `src/pages`). */
const pageLoaders: Record<ViewName, () => PageModule> = {
  aboard: () =>
    import('../pages/aboard/AboardPage.tsx').then((module) => ({
      default: module.AboardPage,
    })),
  alpha: () =>
    import('../pages/alpha/AlphaPage.tsx').then((module) => ({
      default: module.AlphaPage,
    })),
  beaufort: () =>
    import('../pages/beaufort/BeaufortPage.tsx').then((module) => ({
      default: module.BeaufortPage,
    })),
  boats: () =>
    import('../pages/boats/BoatsPage.tsx').then((module) => ({
      default: module.BoatsPage,
    })),
  cartes: () =>
    import('../pages/cartes/CartesPage.tsx').then((module) => ({
      default: module.CartesPage,
    })),
  checklist: () =>
    import('../pages/checklist/ChecklistPage.tsx').then((module) => ({
      default: module.ChecklistPage,
    })),
  ckbases: () =>
    import('../pages/ckbases/CkbasesPage.tsx').then((module) => ({
      default: module.CkbasesPage,
    })),
  crew: () =>
    import('../pages/crew/CrewPage.tsx').then((module) => ({
      default: module.CrewPage,
    })),
  crews: () =>
    import('../pages/crews/CrewsPage.tsx').then((module) => ({
      default: module.CrewsPage,
    })),
  cruises: () =>
    import('../pages/cruises/CruisesPage.tsx').then((module) => ({
      default: module.CruisesPage,
    })),
  day: () =>
    import('../pages/day/DayPage.tsx').then((module) => ({
      default: module.DayPage,
    })),
  dock: () =>
    import('../pages/dock/DockPage.tsx').then((module) => ({
      default: module.DockPage,
    })),
  docs: () =>
    import('../pages/docs/DocsPage.tsx').then((module) => ({
      default: module.DocsPage,
    })),
  dossier: () =>
    import('../pages/dossier/DossierPage.tsx').then((module) => ({
      default: module.DossierPage,
    })),
  douglas: () =>
    import('../pages/douglas/DouglasPage.tsx').then((module) => ({
      default: module.DouglasPage,
    })),
  export: () =>
    import('../pages/export/ExportPage.tsx').then((module) => ({
      default: module.ExportPage,
    })),
  info: () =>
    import('../pages/info/InfoPage.tsx').then((module) => ({
      default: module.InfoPage,
    })),
  lists: () =>
    import('../pages/lists/ListsPage.tsx').then((module) => ({
      default: module.ListsPage,
    })),
  log: () =>
    import('../pages/log/LogPage.tsx').then((module) => ({
      default: module.LogPage,
    })),
  map: () =>
    import('../pages/map/MapPage.tsx').then((module) => ({
      default: module.MapPage,
    })),
  marks: () =>
    import('../pages/marks/MarksPage.tsx').then((module) => ({
      default: module.MarksPage,
    })),
  weather: () =>
    import('../pages/weather/WeatherPage.tsx').then((module) => ({
      default: module.WeatherPage,
    })),
  meteo: () =>
    import('../pages/meteo/MeteoPage.tsx').then((module) => ({
      default: module.MeteoPage,
    })),
  mob: () =>
    import('../pages/mob/MobPage.tsx').then((module) => ({
      default: module.MobPage,
    })),
  more: () =>
    import('../pages/more/MorePage.tsx').then((module) => ({
      default: module.MorePage,
    })),
  new: () =>
    import('../pages/new/NewPage.tsx').then((module) => ({
      default: module.NewPage,
    })),
  nmea: () =>
    import('../pages/nmea/NmeaPage.tsx').then((module) => ({
      default: module.NmeaPage,
    })),
  nonav: () =>
    import('../pages/nonav/NonavPage.tsx').then((module) => ({
      default: module.NonavPage,
    })),
  people: () =>
    import('../pages/people/PeoplePage.tsx').then((module) => ({
      default: module.PeoplePage,
    })),
  prepmenu: () =>
    import('../pages/prepmenu/PrepMenuPage.tsx').then((module) => ({
      default: module.PrepMenuPage,
    })),
  prep: () =>
    import('../pages/prep/PrepPage.tsx').then((module) => ({
      default: module.PrepPage,
    })),
  print: () =>
    import('../pages/print/PrintPage.tsx').then((module) => ({
      default: module.PrintPage,
    })),
  rules: () =>
    import('../pages/rules/RulesPage.tsx').then((module) => ({
      default: module.RulesPage,
    })),
  settings: () =>
    import('../pages/settings/SettingsPage.tsx').then((module) => ({
      default: module.SettingsPage,
    })),
  sheet: () =>
    import('../pages/sheet/SheetPage.tsx').then((module) => ({
      default: module.SheetPage,
    })),
  sos: () =>
    import('../pages/sos/SosPage.tsx').then((module) => ({
      default: module.SosPage,
    })),
  soslogs: () =>
    import('../pages/soslogs/SoslogsPage.tsx').then((module) => ({
      default: module.SoslogsPage,
    })),
  stats: () =>
    import('../pages/stats/StatsPage.tsx').then((module) => ({
      default: module.StatsPage,
    })),
  tasktpl: () =>
    import('../pages/tasktpl/TasktplPage.tsx').then((module) => ({
      default: module.TasktplPage,
    })),
  traces: () =>
    import('../pages/traces/TracesPage.tsx').then((module) => ({
      default: module.TracesPage,
    })),
  tracker: () =>
    import('../pages/tracker/TrackerPage.tsx').then((module) => ({
      default: module.TrackerPage,
    })),
  vhf: () =>
    import('../pages/vhf/VhfPage.tsx').then((module) => ({
      default: module.VhfPage,
    })),
};

/**
 * Every screen, loaded on demand: a page module that fails to load or to
 * render only breaks its own screen (see `PageHost`).
 */
export const pages = Object.fromEntries(
  Object.entries(pageLoaders).map(([view, loader]) => [view, lazy(loader)]),
) as Record<ViewName, LazyExoticComponent<PageComponent>>;

/**
 * Start loading every page module in the background, so that later
 * navigations render at once, like legacy synchronous views.
 */
export function preloadPages(): void {
  for (const loader of Object.values(pageLoaders)) {
    loader().catch(() => {
      // The page reports its own failure when it is opened.
    });
  }
}
