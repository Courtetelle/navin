import { checklistSub } from '../../features/checklists/index.ts';
import { hasAboard, isLake, sosLogsCount, state } from '../../state/index.ts';

/** One tile of the data menu. */
export interface MoreTile {
  /** View opened, and key of the tile in the learnt order. */
  key: string;
  /** Main text. */
  title: string;
  /** Text in the `<small>`. */
  sub: string;
}

const TRACES: MoreTile = {
  key: 'traces',
  title: '🛰 Mes traces',
  sub: 'traces enregistrées, carte, GPX',
};
const CHECKLIST_BASES: MoreTile = {
  key: 'ckbases',
  title: '✅ Mes check-lists',
  sub: 'check-in, bases modèles',
};
const LISTS: MoreTile = {
  key: 'lists',
  title: '📋 Listes',
  sub: 'échelles de Beaufort et de Douglas, alphabet phonétique',
};
const RULES: MoreTile = {
  key: 'rules',
  title: '📘 Règles du Léman',
  sub: 'permis, priorités, rives, feux de tempête',
};
const NMEA: MoreTile = {
  key: 'nmea',
  title: '📡 Instruments du bateau',
  sub: 'NMEA en Wi-Fi (Signal K), import de fichiers NMEA',
};
const STATS: MoreTile = {
  key: 'stats',
  title: '📊 Cumul sur le lac',
  sub: 'milles et heures par semaine, mois, année',
};

/**
 * Tiles of the data menu without an open cruise (legacy `VIEWS.more`).
 * @returns The tiles in their default order.
 */
export function tilesWithoutCruise(): MoreTile[] {
  const { boats, crewSets, marks, members } = state.data;
  const boatCount = boats.value.length;
  const tiles = [
    TRACES,
    CHECKLIST_BASES,
    {
      key: 'boats',
      title: '🚤 Mes bateaux',
      sub: `${boatCount} bateau${boatCount > 1 ? 'x' : ''}, données et check-lists du lac`,
    },
    peopleTile(members.value.length),
    {
      key: 'crews',
      title: '👥 Équipages',
      sub: `${crewSets.value.length} groupe${crewSets.value.length > 1 ? 's' : ''} de navigants, avec les rôles`,
    },
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
    RULES,
    {
      key: 'docs',
      title: '📄 Documents obligatoires à bord',
      sub: 'permis, titre de navigation, RPP, RGP',
    },
    chartsTile(),
    NMEA,
    marksTile(marks.value.length),
    LISTS,
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
  const { boats, crewSets, cruise, marks, members } = state.data;
  const boatCount = boats.value.length;
  const setCount = crewSets.value.length;
  const setPlural = setCount > 1 ? 's' : '';
  const tiles: MoreTile[] = [
    {
      key: 'day',
      title: '📅 Journée',
      sub: lake ? 'fiche de la sortie' : 'fiche du jour, météo, route prévue',
    },
    { key: 'log', title: '📜 Journal', sub: 'toutes les entrées' },
    sosLogsTile(),
    TRACES,
  ];
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
  if (lake) {
    tiles.push(
      {
        key: 'sheet',
        title: '📸 Fiche du jour',
        sub: 'à envoyer sur WhatsApp',
      },
      RULES,
      {
        key: 'docs',
        title: '📄 Documents obligatoires à bord',
        sub: 'permis, titre de navigation, RPP, RGP, accord franco-suisse',
      },
    );
  }
  if (hasLakeCruise()) tiles.push(STATS);
  tiles.push(
    {
      key: 'boats',
      title: '🚤 Mes bateaux',
      sub: `${boatCount} bateau${boatCount > 1 ? 'x' : ''}, données et check-lists`,
    },
    {
      key: 'info',
      title: '⚓ Bateau et croisière',
      sub: 'identité radio, moteur, numéros utiles',
    },
    peopleTile(members.value.length),
    {
      key: 'crews',
      title: '👥 Équipages',
      sub: `${cruise.value?.crew.length} à bord · ${setCount} groupe${setPlural} enregistré${setPlural}`,
    },
    LISTS,
    marksTile(marks.value.length),
    chartsTile(),
    {
      key: 'map',
      title: `🗺 ${lake ? 'Carte du Léman' : 'Carte'}`,
      sub: lake
        ? 'carte nationale suisse, profondeurs, position GPS'
        : 'trace et entrées sur la carte',
    },
    NMEA,
    {
      key: 'print',
      title: '📤 Publier le livre de bord',
      sub: 'PDF A4, choisir les pages',
    },
    {
      key: 'export',
      title: '⇪ Échanges de fichiers',
      sub: lake ? 'tableur, sauvegarde' : 'tableur, sauvegarde, trace GPX',
    },
  );
  return tiles;
}

function hasLakeCruise(): boolean {
  return state.data.index.value.some((meta) => meta.type === 'lac');
}

function sosLogsTile(): MoreTile {
  return { key: 'soslogs', title: '🆘 Logs SOS', sub: sosLogsCount() };
}

function peopleTile(count: number): MoreTile {
  return {
    key: 'people',
    title: '🧭 Les coéquipiers·ères',
    sub: `${count} fiche${count > 1 ? 's' : ''} : les personnes et leurs caractéristiques`,
  };
}

function marksTile(count: number): MoreTile {
  return {
    key: 'marks',
    title: '📌 Mes marques',
    sub: `${count} marque(s), Go to`,
  };
}

function chartsTile(): MoreTile {
  const radius = state.preferences.settings.value.mapRadius || 50;
  return {
    key: 'cartes',
    title: '🗺 Mes cartes',
    sub: `OpenStreetMap et OpenSeaMap chargées autour de moi (${radius} km), sans réseau`,
  };
}
