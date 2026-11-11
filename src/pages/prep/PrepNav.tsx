import { Button } from '../../components/shared/Button.tsx';
import { prepBack, prepNext } from '../../features/prep/prepBack.ts';
import { PageBack, PageValidate } from '../../shell/navbar/PageBack.tsx';

/** Props of {@link PrepNav}. */
interface PrepNavProps {
  /**
   * Label of the button that goes on, none by default.
   * @default ''
   */
  next?: string;
  /**
   * Action of that button.
   * @default prepNext
   */
  onNext?: () => void;
}

/**
 * Buttons under a PréP step: « ◀ Retour », hidden and relayed by the nav bar,
 * and the optional next button; « Valider ▶ » moves up into the green ✔.
 * @param props - Next button.
 * @returns The row.
 */
export function PrepNav({ next = '', onNext = prepNext }: PrepNavProps) {
  return (
    <div className="row prep-nav">
      <PageBack
        label="◀ Retour"
        className="btn big nav-dup"
        data-p="back"
        onClick={prepBack}
      />
      {next.startsWith('Valider') ? (
        <PageValidate
          label={next}
          className="btn big primary"
          data-p="next"
          onClick={() => onNext()}
        />
      ) : next ? (
        <Button
          className="btn big primary"
          data-p="next"
          onClick={() => onNext()}
        >
          {next}
        </Button>
      ) : null}
    </div>
  );
}
