import { Button } from '../../components/shared/Button.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

/**
 * Copy a key kept (shown hidden), to paste it elsewhere, such as a secret of
 * the repository for the archive of the stations on GitHub.
 * @param props - The props.
 * @param props.value - The key kept, empty without one.
 * @returns The button.
 */
export function CopyKeyButton({ value }: { value: string }) {
  const tr = useTr();
  return (
    <Button
      className="btn"
      type="button"
      disabled={!value}
      data-copy-key
      onClick={() => {
        buzz();
        navigator.clipboard
          .writeText(value)
          .then(() => toast('Clé copiée'))
          .catch(() => toast('Copie impossible ici'));
      }}
    >
      {tr('Copier')}
    </Button>
  );
}
