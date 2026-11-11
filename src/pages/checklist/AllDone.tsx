import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { dayKey } from '../../lib/format.ts';
import { go } from '../../shell/router.ts';

/** Props of {@link AllDone}. */
interface AllDoneProps {
  /** Name of the list. */
  name: string;
  /** `dep` or `quit`; `null` for a free list. */
  list: string | null;
  /** Check-in step of the PréP flow. */
  inPrep: boolean;
  /** Lake outing. */
  lake: boolean;
  /** Name of the leaving list. */
  quitName: string;
  /** Shows a list. */
  onList: (list: string) => void;
}

/**
 * Message of a finished list, with what comes next for a built-in one.
 * @param props - List and callback.
 * @returns The message and its buttons.
 */
export function AllDone({
  name,
  list,
  inPrep,
  lake,
  quitName,
  onList,
}: AllDoneProps) {
  const tr = useTr();
  const message = tr(`✅ ${name} : tout est fait !`);
  if (!list) return <div className="ck-allok">{message}</div>;
  return (
    <>
      <div className="ck-allok">
        {message}
        <small>
          {tr(
            list === 'dep'
              ? 'Bonne navigation !'
              : 'Le bateau est prêt. Bonne journée !',
          )}
        </small>
      </div>
      {list === 'dep' && !inPrep ? (
        <ButtonRow className="row c2">
          <Button
            className="btn big primary"
            data-auto="1"
            onClick={() => {
              buzz();
              go('new');
            }}
          >
            {tr('▶ Journal automatique')}
          </Button>
          <Button
            className="btn big"
            data-list="quit"
            onClick={() => {
              buzz();
              onList('quit');
            }}
          >
            {tr(`🔒 ${quitName}`)}
          </Button>
        </ButtonRow>
      ) : null}
      {lake && list !== 'dep' ? (
        <ButtonRow>
          <Button
            className="btn big"
            data-sheet="1"
            onClick={() => {
              buzz();
              go('sheet', dayKey(new Date()));
            }}
          >
            {tr('📸 Fiche du jour')}
          </Button>
        </ButtonRow>
      ) : null}
    </>
  );
}
