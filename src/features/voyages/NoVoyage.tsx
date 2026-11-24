import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';

/**
 * Shown by a page of a cruise when none is opened.
 * @returns A line and the way to the list.
 */
export function NoVoyage() {
  const tr = useTr();
  return (
    <>
      <HelpText>Aucune croisière ouverte.</HelpText>
      <ButtonRow>
        <Button
          className="btn big"
          data-go="voyages"
          onClick={() => {
            buzz();
            go('voyages');
          }}
        >
          {tr('⛵ Croisières')}
        </Button>
      </ButtonRow>
    </>
  );
}
