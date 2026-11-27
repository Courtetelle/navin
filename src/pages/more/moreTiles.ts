import { checklistSub } from '../../features/checklists/index.ts';
import {
  alertLog,
  hasAboard,
  isLake,
  sosLogsCount,
  state,
} from '../../state/index.ts';

/** One tile of the data menu. */
interface MoreTile {
  /** View opened, and key of the tile in the learnt order. */
  key: string;
  /** Main text. */
  title: string;
  /** Text in the `<small>`. */
  sub: string;
}

const TRACES: MoreTile = {
  key: 'traces',
  title: '🛰 Toutes les traces',
  sub: 'de toutes les croisières et sorties, carte, GPX',
};
// The records of every cruise and outing (Corban, 27/11): each one shows
// its own under Enregistrements.
const ROUTES: MoreTile = {
  key: 'routes',
  title: '✏️ Toutes les routes',
  sub: 'de toutes les croisières et sorties',
};
const ROUTINGS: MoreTile = {
  key: 'routings',
  title: '⛵ Tous les routages',
  sub: 'de toutes les croisières et sorties',
};
const MARKS: MoreTile = {
  key: 'marks',
  title: '📌 Toutes les marques',
  sub: 'de toutes les croisières et sorties, Go to',
};
const CHECKLIST_BASES: MoreTile = {
  key: 'ckbases',
  title: '✅ Mes check-lists',
  sub: 'check-in, bases modèles',
};
const METEO: MoreTile = {
  key: 'meteo',
  title: '🌬 LiveMétéo',
  sub: 'vent mesuré par les stations autour, carte',
};
const LISTS: MoreTile = {
  key: 'lists',
  title: '📋 Listes',
  sub: 'échelles de Beaufort et de Douglas, alphabet phonétique',
};
const RULES: MoreTile = {
  key: 'rules',
  title: '📘 Règles du Léman et documents obligatoires à bord',
  sub: 'permis, priorités, rives, feux de tempête, titre de navigation, RPP, RGP',
};
const NMEA: MoreTile = {
  key: 'nmea',
  title: '📡 Instruments du bateau',
  sub: 'NMEA en Wi-Fi (Signal K), import de fichiers NMEA',
};
const SITES: MoreTile = {
  key: 'sites',
  title: '🌐 Sites internet',
  sub: 'les sites liés dans NavIn : texte des boutons et adresses',
};
const VOYAGES: MoreTile = {
  key: 'voyages',
  title: '⛵ Croisières maritimes',
  sub: 'équipage, contrats, assurances, documents',
};
const OUTINGS: MoreTile = {
  key: 'sorties',
  title: '🏞 Sorties lacustres',
  sub: 'bateau, propriétaire, équipage, documents',
};
const STATS: MoreTile = {
  key: 'stats',
  title: '📊 NM effectués sur les lacs',
  sub: 'milles et heures par semaine, mois, année',
};

/**
 * Tiles of the data menu without an open cruise (legacy `VIEWS.more`).
 * @returns The tiles in their default order.
 */
export function tilesWithoutCruise(): MoreTile[] {
  const { boats, crewSets, members } = state.data;
  const boatCount = boats.value.length;
  const tiles = [
    TRACES,
    ROUTES,
    ROUTINGS,
    MARKS,
    METEO,
    CHECKLIST_BASES,
    {
      key: 'boats',
      title: '🚤 Bateaux',
      sub: `${boatCount} bateau${boatCount > 1 ? 'x' : ''}, données et check-lists du lac`,
    },
    peopleTile(members.value.length),
    {
      key: 'crews',
      title: '👥 Équipages',
      sub: `${crewSets.value.length} groupe${crewSets.value.length > 1 ? 's' : ''} de navigants, avec les rôles`,
    },
    VOYAGES,
    OUTINGS,
    {
      key: 'tasktpl',
      title: '🧑‍🤝‍🧑 Modèle des tâches à bord',
      sub: 'repas, propreté, technique',
    },
    {
      key: 'mob',
      title: '🛟 Homme à la mer',
      sub: 'procédures cas réel et entraînement',
    },
    sosLogsTile(),
    alertsTile(),
    RULES,
    chartsTile(),
    NMEA,
    LISTS,
    SITES,
  ];
  if (hasLakeCruise()) tiles.push(STATS);
  return tiles;
}

/**
 * Tiles of the data menu with an open cruise (legacy `VIEWS.more`).
 * @returns The tiles in their default order.
 */
export function tilesWithCruise(): MoreTile[] {
  const lake = isLake();
  const { boats, crewSets, cruise, members } = state.data;
  const boatCount = boats.value.length;
  const setCount = crewSets.value.length;
  const setPlural = setCount > 1 ? 's' : '';
  const tiles: MoreTile[] = [];
  // Journée et fiche du jour live in the cruise or outing of the navigation
  // (Corban, 27/11): here only when the navigation has none.
  if (!navigationInVoyage()) {
    tiles.push({
      key: 'day',
      title: '📅 Journée et fiche du jour',
      sub: lake ? 'fiche de la sortie' : 'fiche du jour, météo, route prévue',
    });
  }
  tiles.push(
    sosLogsTile(),
    alertsTile(),
    TRACES,
    ROUTES,
    ROUTINGS,
    MARKS,
    METEO,
  );
  if (hasAboard()) {
    tiles.push({
      key: 'aboard',
      title: '🧑‍🤝‍🧑 À bord',
      sub: 'tournus des tâches : repas, propreté, technique',
    });
  }
  tiles.push(
    { key: 'checklist', title: '✅ Check-lists', sub: checklistSub() },
    CHECKLIST_BASES,
  );
  if (lake) tiles.push(RULES);
  if (hasLakeCruise()) tiles.push(STATS);
  tiles.push(
    {
      key: 'boats',
      title: '🚤 Bateaux',
      sub: `${boatCount} bateau${boatCount > 1 ? 'x' : ''}, données et check-lists`,
    },
    peopleTile(members.value.length),
    {
      key: 'crews',
      title: '👥 Équipages',
      sub: `${cruise.value?.crew.length} à bord · ${setCount} groupe${setPlural} enregistré${setPlural}`,
    },
    VOYAGES,
    OUTINGS,
    LISTS,
    chartsTile(),
    NMEA,
    SITES,
    {
      key: 'export',
      title: '⇪ Échanges de fichiers',
      sub: lake ? 'tableur, sauvegarde' : 'tableur, sauvegarde, trace GPX',
    },
  );
  return tiles;
}

function navigationInVoyage(): boolean {
  const voyage = state.data.cruise.value?.voyage;
  return (
    typeof voyage === 'string' &&
    state.data.voyageStore.value.list.some((item) => item.id === voyage)
  );
}

function hasLakeCruise(): boolean {
  return state.data.index.value.some((meta) => meta.type === 'lac');
}

function alertsTile(): MoreTile {
  const count = alertLog.value.length;
  return {
    key: 'alerts',
    title: '🔔 Journal des alertes',
    sub: count
      ? `${count} alerte${count > 1 ? 's' : ''} : vent, orage, feux d’avis, profondeur`
      : 'vent, orage, feux d’avis, profondeur',
  };
}

function sosLogsTile(): MoreTile {
  return { key: 'soslogs', title: '🆘 Journal SOS', sub: sosLogsCount() };
}

function peopleTile(count: number): MoreTile {
  return {
    key: 'people',
    title: '🧭 Équipiers·ères',
    sub: `${count} fiche${count > 1 ? 's' : ''} : les personnes et leurs caractéristiques`,
  };
}

function chartsTile(): MoreTile {
  return {
    key: 'cartes',
    title: '🗺 Fonds de cartes',
    sub: 'cartes gardées sur l’appareil',
  };
}
