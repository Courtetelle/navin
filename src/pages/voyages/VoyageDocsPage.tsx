import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { NoVoyage } from '../../features/voyages/NoVoyage.tsx';
import { DocImport, DocList } from '../../features/voyages/VoyageDocs.tsx';
import { useChapterEdit } from '../../features/voyages/useChapterEdit.tsx';
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
  // No document yet: the import buttons show at once.
  const { editing, validate } = useChapterEdit(
    undefined,
    docCategories(voyages).every((cat) => docsOf(cat.id).length === 0),
  );
  if (!voyages.id) return <NoVoyage />;
  return (
    <>
      <PageBack
        label="◀ Croisière"
        data-go="voyage"
        onClick={() => {
          buzz();
          go('voyage');
        }}
      >
        {tr('◀ Croisière')}
      </PageBack>
      {validate}
      <PageTitle
        helps={[
          'Contrats, conditions générales et particulières, attestations d’assurance, photos : chaque fichier reçoit un titre et une catégorie. Le crayon en haut permet d’ajouter, renommer, reclasser et supprimer. Toucher un document l’ouvre, sans réseau.',
        ]}
      >
        📎 Documents
      </PageTitle>
      {editing ? <DocImport /> : null}
      {docCategories(voyages).map((cat) => {
        const count = docsOf(cat.id).length;
        return (
          <FoldSection
            key={cat.id}
            data-voydoccat={cat.id}
            title={`${cat.name} · ${count}`}
            titleText={cat.id}
          >
            <DocList cat={cat.id} editing={editing} />
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
