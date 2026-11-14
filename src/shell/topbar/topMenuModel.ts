import {
  FLAG_PREP_SVG,
  FLAG_SVG,
  FLAG_WAVE_SVG,
  MOOR_SVG,
  NAVIN_LAC_SVG,
  NAVIN_MED_SVG,
  NAVIN_MER_SVG,
  PHONE_SVG,
  PHONE_W_SVG,
  PIN_SVG,
  SOS_SVG,
  WEATHER_SVG,
} from './tabIcons.ts';

/** The three top tabs (`data-view` of each). */
export type TopTabKey = 'tracker' | 'more' | 'sos';

/** What a tab shows: its label and how it is drawn (legacy `setLabel`). */
export interface TabFace {
  /** Text label; also the tab name shown in `data-base`. */
  label: string;
  /** SVG markups drawn instead of the text (one or two pictograms). */
  html?: readonly string[];
  /** Pictogram without the tab frame (class `bare`). */
  bare?: boolean;
  /** Phone drawn in a box (class `ph-box`). */
  box?: boolean;
  /** Yellow VHF state (class `vhf-on`). */
  vhfOn?: boolean;
  /**
   * Blinks in the colour of PréP (class `menu-here`): a track recorded.
   * @default undefined
   */
  blink?: boolean;
  /** A PréP closed, waiting for START: green when complete, orange when not. */
  ready?: 'ok' | 'part';
}

/** One choice of a tab menu (prep.js:200-231). */
export interface TopMenuItem extends TabFace {
  /** First item: the tab name, which triggers nothing on a long press. */
  base?: boolean;
  /** The FIN (stop track) item: a long press arms the stop. */
  stop?: boolean;
  /** Bubble shown when the item appears. */
  hint?: string;
  /** Action of a long press (or Enter). */
  act: () => void;
}

/** Context the menus depend on. */
export interface TopMenuContext {
  currentView: string;
  /** A PréP flow exists (legacy `prep` not null). */
  prepActive: boolean;
  /** A PréP closed and waiting for START: `ok` complete, `part` not. */
  prepReady: 'ok' | 'part' | null;
  /** The PréP page or the PréP bar is shown (legacy `inPrep`). */
  inPrep: boolean;
  /** A track is being recorded. */
  tracking: boolean;
  /** Navigation zone. */
  zone: 'lac' | 'mer';
  /**
   * The sea chosen with NavIn: the Atlantic, or the Mediterranean.
   * @default 'atl'
   */
  sea?: 'atl' | 'med';
  /**
   * Landscape tablet: Météo has its own button in the left column, so the
   * NavIn menu goes without it.
   * @default false
   */
  wide?: boolean;
}

/** Actions the menus trigger; domains plug theirs with `setTopMenuActions`. */
export interface TopMenuActions {
  go: (view: string) => void;
  armStop: () => void;
  prepStart: () => void;
  quickStart: () => void;
  pointNow: () => void;
  moorNow: () => void;
}

const SOS_HINT =
  'Appui court : outils SOS de la zone · appui long : tous les outils, lac et mer';
const PHONE_HINT =
  'Toucher encore : menu suivant · appui long : appeler les secours par téléphone (eaux intérieures)';
const VHF_HINT =
  'Toucher encore : menu suivant · appui long : VHF (appels de routine en mer)';

/**
 * The choices of each tab (legacy `MENUS`): index 0 is the tab name.
 * @param key - Tab.
 * @param context - Screen, PréP, tracking and zone.
 * @param actions - Actions triggered by the choices.
 * @returns The menu items.
 */
export function topMenu(
  key: TopTabKey,
  context: TopMenuContext,
  actions: TopMenuActions,
): TopMenuItem[] {
  if (key === 'more') {
    return [{ label: 'data', base: true, act: () => actions.go('more') }];
  }
  if (key === 'sos') return sosMenu(context, actions);
  return trackerMenu(context, actions);
}

/**
 * The logo of NavIn for the zone chosen: the lake, the swell of the Atlantic,
 * the sun over the Mediterranean.
 * @param context - The zone and the sea.
 * @returns The drawing.
 */
export function navinLogo(context: TopMenuContext): string {
  if (context.zone === 'lac') return NAVIN_LAC_SVG;
  return context.sea === 'med' ? NAVIN_MED_SVG : NAVIN_MER_SVG;
}

/**
 * The face of the NavIn tab when it shows its name (legacy `baseNav`).
 * @param context - Screen, PréP, tracking and zone.
 * @returns The face.
 */
export function baseNav(context: TopMenuContext): TabFace {
  const inland = context.zone === 'lac';
  const logo = navinLogo(context);
  // Landscape tablet: VHF, PréP and the track have their own buttons in the
  // columns, which show their state; NavIn stays NavIn.
  if (context.wide) {
    return { label: 'NavIn', html: [logo] };
  }
  if (context.currentView === 'vhf') {
    return inland
      ? { label: 'Téléphone', html: phoneHtml(true), box: true, vhfOn: true }
      : { label: 'VHF', vhfOn: true };
  }
  if (context.prepActive) {
    return context.inPrep
      ? { label: 'PréP en cours', html: [FLAG_WAVE_SVG], bare: true }
      : {
          label: 'PréP en cours (autre page)',
          html: [FLAG_PREP_SVG],
          bare: true,
        };
  }
  if (context.prepReady && !context.tracking) {
    return {
      label:
        context.prepReady === 'ok'
          ? 'PréP terminée, prêt au départ'
          : 'PréP close, check-in incomplète',
      html: [FLAG_SVG],
      bare: true,
      ready: context.prepReady,
    };
  }
  return { label: 'NavIn', html: [logo] };
}

/**
 * The two phone pictograms (day and night versions), prep.js:197.
 * @param still - Phone that does not ring.
 * @returns The two SVG markups.
 */
export function phoneHtml(still: boolean): string[] {
  const day = PHONE_SVG.replace('tb-phone', 'tb-phone ph-day');
  const night = PHONE_W_SVG.replace('tb-phone', 'tb-phone ph-night');
  return [day, night].map((markup) =>
    still ? markup.replace('tb-phone', 'tb-phone tb-still') : markup,
  );
}

function vhfItem(
  context: TopMenuContext,
  actions: TopMenuActions,
  hint: string,
  still: boolean,
): TopMenuItem {
  const act = () => actions.go('vhf');
  return context.zone === 'lac'
    ? {
        label: 'Téléphone',
        html: phoneHtml(still),
        box: true,
        hint: PHONE_HINT,
        act,
      }
    : { label: 'VHF', hint, act };
}

function weatherItem(actions: TopMenuActions): TopMenuItem {
  // The same during a track: LiveMétéo is inside the Météo menu.
  return {
    label: 'Météo',
    html: [WEATHER_SVG],
    bare: true,
    hint: 'Toucher encore : menu suivant · appui long : prévisions et LiveMétéo',
    act: () => actions.go('weather'),
  };
}

function trackerMenu(
  context: TopMenuContext,
  actions: TopMenuActions,
): TopMenuItem[] {
  const base: TopMenuItem = {
    ...baseNav(context),
    base: true,
    hint: 'Touche « NavIn » plusieurs fois (appuis courts) · pour faire défiler ses menus',
    act: () => actions.go('tracker'),
  };
  // The track has its own button (START, pause, FIN): NavIn keeps none of
  // its steps. The landscape tablet has its own buttons for the rest.
  if (context.wide) return [base];
  if (context.tracking) {
    return [
      base,
      weatherItem(actions),
      {
        label: 'Point',
        html: [PIN_SVG],
        bare: true,
        hint: 'Toucher encore : menu suivant · appui long : enregistrer un point dans le journal',
        act: actions.pointNow,
      },
      vhfItem(context, actions, VHF_HINT, true),
      {
        label: 'Amarrage',
        html: [MOOR_SVG],
        bare: true,
        hint: 'Toucher encore : menu suivant · appui long : fin de la trace, puis check-out',
        act: actions.moorNow,
      },
    ];
  }
  return [
    base,
    weatherItem(actions),
    {
      label: 'PréP',
      html: [FLAG_SVG],
      bare: true,
      hint: 'Toucher encore : menu suivant · appui long : préparer la sortie pas à pas',
      act: actions.prepStart,
    },
    vhfItem(context, actions, VHF_HINT, true),
  ];
}

function sosMenu(
  context: TopMenuContext,
  actions: TopMenuActions,
): TopMenuItem[] {
  const items: TopMenuItem[] = [
    {
      label: 'SOS',
      html: [SOS_SVG],
      bare: true,
      base: true,
      hint: SOS_HINT,
      act: () => actions.go('sos'),
    },
    {
      label: 'MOB',
      hint: 'Toucher encore : menu suivant · appui long : homme à la mer',
      act: () => actions.go('mob'),
    },
    {
      label: 'Alphabet',
      hint: 'Toucher encore : menu suivant · appui long : alphabet phonétique',
      act: () => actions.go('alpha'),
    },
  ];
  if (context.zone === 'mer') {
    items.push({
      label: 'VHF',
      hint: 'Toucher encore : menu suivant · appui long : appels VHF de routine',
      act: () => actions.go('vhf'),
    });
  }
  return items;
}
