import type { ReactNode } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import type { ShareFormat } from '../../components/shared/shareFormat.ts';

/** Props of {@link BubbleActions}. */
interface BubbleActionsProps {
  /** Words said for the 👁 button. */
  detailLabel: string;
  /**
   * Opens the detail screen; no 👁 without it.
   * @default undefined
   */
  onDetail?: (() => void) | undefined;
  /** The middle button (LiveMétéo, the map), its click left to the bubble. */
  children?: ReactNode;
  /**
   * Shares the alert; no 📤 without it.
   * @default undefined
   */
  onShare?: ((format: ShareFormat) => void) | undefined;
  /** Translates a text into the language of the screen. */
  translate: (text: string) => string;
}

/**
 * The buttons of an alert bubble, side by side with an icon only: 👁 the
 * detail screen, the middle one (🌬 LiveMétéo or 🗺 the map), 📤 Partager.
 * @param props - The actions.
 * @returns The row.
 */
export function BubbleActions({
  detailLabel,
  onDetail,
  children,
  onShare,
  translate,
}: BubbleActionsProps) {
  return (
    <div className="wp-actions">
      {onDetail ? (
        <Button
          className="btn wp-more"
          noUiEdit
          aria-label={translate(detailLabel)}
          title={translate(detailLabel)}
          onClick={(event) => {
            event.stopPropagation();
            onDetail();
          }}
        >
          👁
        </Button>
      ) : null}
      {children}
      {onShare ? (
        <span className="wp-publish">
          <ShareButton
            label="📤"
            aria-label={translate('Partager')}
            title={translate('Partager')}
            onShare={onShare}
          />
        </span>
      ) : null}
    </div>
  );
}
