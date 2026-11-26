import {
  CONTRACT_KINDS,
  VOYAGE_SECTIONS,
  contractFilled,
} from '../../model/voyages.ts';
import { state } from '../../state/index.ts';

import { voyageBoat } from './voyageBoat.ts';
import { voyageCrewLines, voyageCrewSet } from './voyageCrew.ts';
import { voyageRecords } from './voyageRecords.ts';

/** One tile of a cruise menu. */
export interface VoyageTile {
  /** Unique key (also the view when no {@link VoyageTile.view}). */
  key: string;
  title: string;
  sub: string;
  /** The view opened, when not the key. */
  view?: string;
  /** Its argument (a contract kind). */
  arg?: string;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? 's' : ''}`;
}

/**
 * The tiles of the cruise opened: its sections, then what was recorded
 * while it was active.
 * @returns The tiles in their order.
 */
export function voyageTiles(): VoyageTile[] {
  const voyage = state.data.voyages.value;
  const { categories, docs, sections, id } = voyage;
  const crew = voyageCrewLines(voyage);
  const crewSet = voyageCrewSet(voyage);
  const boat = voyageBoat(voyage);
  const subs: Record<string, string> = {
    crew:
      crew.length > 0
        ? `${crewSet?.name ? `${crewSet.name} · ` : ''}${plural(crew.length, 'personne')}`
        : 'choisi dans data › Équipages',
    boat: boat
      ? boat.info.boat || 'bateau sans nom'
      : 'choisi dans data › Bateaux',
    docs:
      docs.length > 0
        ? `${plural(docs.length, 'document')} PDF et photos`
        : 'contrats, conditions générales et particulières, photos',
  };
  // The 4 contracts sit at the level of the other chapters (Corban, 26/11).
  const tiles: VoyageTile[] = VOYAGE_SECTIONS.filter((section) =>
    sections.includes(section.key),
  ).flatMap((section) =>
    section.key === 'contracts'
      ? CONTRACT_KINDS.map((kind) => {
          const card = categories.find((cat) => cat.id === kind.id)?.cards[0];
          const org = card?.org.trim() ?? '';
          return {
            key: `contract-${kind.id}`,
            view: 'vcontracts',
            arg: kind.id,
            title: `${kind.icon} ${kind.name}`,
            sub:
              org ||
              (card && contractFilled(card) ? 'renseigné' : 'à renseigner'),
          };
        })
      : [
          {
            key: section.view,
            title: section.title,
            sub: subs[section.key] ?? section.sub,
          },
        ],
  );
  const records = voyageRecords(id);
  const total =
    records.navigations.length +
    records.routes.length +
    records.routings.length;
  tiles.push({
    key: 'vrecords',
    title: '🛰 Enregistrements',
    sub:
      total > 0
        ? `${plural(records.navigations.length, 'navigation')} (traces, photos) · ${plural(records.routes.length, 'route')} · ${plural(records.routings.length, 'routage')}`
        : 'navigations, traces, photos, routes et routages de la croisière',
  });
  return tiles;
}
