import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { TitleInNav } from '../../components/shared/TitleInNav.tsx';
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
      <TitleInNav>
        <h1>{tr('📋 Listes')}</h1>
      </TitleInNav>
      <ButtonRow className="row prep-col">
        <Button
          className="btn big"
          data-go="beaufort"
          onClick={() => openView('beaufort')}
        >
          {tr('🌬🌊 Beaufort et Douglas')}
          <small>
            {tr('vent et mer lus ensemble, outil de lecture combinée')}
          </small>
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
