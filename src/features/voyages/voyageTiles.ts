import { VOYAGE_SECTIONS } from '../../model/voyages.ts';
import { state } from '../../state/index.ts';

import { voyageRecords } from './voyageRecords.ts';

/** One tile of a cruise menu. */
export interface VoyageTile {
  key: string;
  title: string;
  sub: string;
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
  const { crew, categories, docs, sections, id } = voyage;
  const cards = categories.reduce((sum, cat) => sum + cat.cards.length, 0);
  const subs: Record<string, string> = {
    crew:
      crew.length > 0
        ? `${plural(crew.length, 'personne')} pour la croisière`
        : 'qui part, avec les rôles et les contacts',
    contracts: `agence, loueur, assurances · ${plural(cards, 'fiche')}`,
    docs:
      docs.length > 0
        ? `${plural(docs.length, 'document')} PDF et photos`
        : 'contrats, conditions générales et particulières, photos',
  };
  const tiles: VoyageTile[] = VOYAGE_SECTIONS.filter((section) =>
    sections.includes(section.key),
  ).map((section) => ({
    key: section.view,
    title: section.title,
    sub: subs[section.key] ?? section.sub,
  }));
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
