import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { openView } from '../../features/safety/openView.ts';
import { useTr } from '../../i18n/useTr.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';

/**
 * Screen `lists` (legacy `VIEWS.lists`): the Beaufort and Douglas scales and the
 * phonetic alphabet.
 * @returns The screen content.
 */
export function ListsPage() {
  const tr = useTr();
  return (
    <>
      <PageBack label="◀ data" data-go="more" onClick={() => openView('more')}>
        {tr('◀ data')}
      </PageBack>
      <h1>{tr('📋 Listes')}</h1>
      <ButtonRow className="row prep-col">
        <Button
          className="btn big"
          data-go="beaufort"
          onClick={() => openView('beaufort')}
        >
          {tr('🌬 Échelle de Beaufort')}
          <small>{tr('force du vent en nœuds, aspect de la mer')}</small>
        </Button>
        <Button
          className="btn big"
          data-go="douglas"
          onClick={() => openView('douglas')}
        >
          {tr('🌊 Échelle de Douglas')}
          <small>{tr('état de la mer, hauteur des vagues')}</small>
        </Button>
        <Button
          className="btn big"
          data-go="alpha"
          onClick={() => openView('alpha')}
        >
          {tr('🔤 Alphabet phonétique')}
          <small>{tr('Alfa, Bravo, Charlie…')}</small>
        </Button>
      </ButtonRow>
    </>
  );
}
