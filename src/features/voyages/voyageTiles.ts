import { state } from '../../state/index.ts';

/** One tile of the Croisières menu. */
export interface VoyageTile {
  key: string;
  title: string;
  sub: string;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? 's' : ''}`;
}

/**
 * The tiles of data › Croisières; more sections will come beside these.
 * @returns The tiles in their order.
 */
export function voyageTiles(): VoyageTile[] {
  const { crew, categories, docs } = state.data.voyages.value;
  const cards = categories.reduce((sum, cat) => sum + cat.cards.length, 0);
  return [
    {
      key: 'vcrew',
      title: '👥 Équipage',
      sub:
        crew.length > 0
          ? `${plural(crew.length, 'personne')} pour la croisière`
          : 'qui part, avec les rôles et les contacts',
    },
    {
      key: 'vcontracts',
      title: '📑 Contrats',
      sub: `agence, loueur, assurances · ${plural(cards, 'fiche')}`,
    },
    {
      key: 'vdocs',
      title: '📎 Documents',
      sub:
        docs.length > 0
          ? `${plural(docs.length, 'document')} PDF et photos`
          : 'contrats, conditions générales et particulières, photos',
    },
  ];
}
