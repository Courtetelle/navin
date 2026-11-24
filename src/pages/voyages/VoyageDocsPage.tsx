import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { DocImport, DocList } from '../../features/voyages/VoyageDocs.tsx';
import { docsOf, shareVoyageDocs } from '../../features/voyages/voyageFiles.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { docCategories } from '../../model/voyages.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { state } from '../../state/index.ts';

/**
 * Screen `vdocs` (data › Croisières › Documents): the PDF and photos kept
 * for the cruise, by category; each gets a category and a title when it is
 * added.
 * @returns The screen content.
 */
export function VoyageDocsPage() {
  useSignals();
  const tr = useTr();
  const voyages = state.data.voyages.value;
  return (
    <>
      <PageBack
        label="◀ Croisières"
        data-go="voyages"
        onClick={() => {
          buzz();
          go('voyages');
        }}
      >
        {tr('◀ Croisières')}
      </PageBack>
      <PageTitle
        helps={[
          'Contrats, conditions générales et particulières, attestations d’assurance, photos : chaque fichier reçoit un titre et une catégorie. Toucher un document l’ouvre, sans réseau.',
        ]}
      >
        📎 Documents
      </PageTitle>
      <DocImport />
      {docCategories(voyages).map((cat) => {
        const count = docsOf(cat.id).length;
        return (
          <FoldSection
            key={cat.id}
            data-voydoccat={cat.id}
            title={`${cat.name} · ${count}`}
            titleText={cat.id}
          >
            <DocList cat={cat.id} />
          </FoldSection>
        );
      })}
      <HelpText>
        Les documents restent sur cet appareil et partent avec la sauvegarde et
        la synchronisation.
      </HelpText>
      <ButtonRow>
        <Button
          className="btn ck-pub share-wide share-btn"
          data-voyshare="docs"
          onClick={() => {
            buzz();
            void shareVoyageDocs(voyages.docs, 'Documents de la croisière');
          }}
        >
          {tr('📤 Tout partager')}
        </Button>
      </ButtonRow>
    </>
  );
}
