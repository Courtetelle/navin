import type { ComponentPropsWithRef, ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import { buzz } from '../../lib/dom.ts';

import { Button } from './Button.tsx';
import type { ShareFormat } from './shareFormat.ts';
import { SHARE_FORMAT_NAMES } from './shareFormat.ts';

/** The two choices stay this long without a touch, then fold back. */
const FOLD_MS = 8000;

/**
 * The icon of a format: a chat bubble for the image, a printer for the PDF.
 * @param props - The format.
 * @returns The SVG.
 */
export function ShareIcon({ format }: { format: ShareFormat }): ReactElement {
  if (format === 'image') {
    return (
      <svg
        className="share-ic share-ic-chat"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <path
          className="share-ic-fill"
          d="M24 4C12.4 4 3 12.3 3 22.6c0 5.6 2.8 10.6 7.2 14L8 45l9.4-5.3c2.1.6 4.3.9 6.6.9 11.6 0 21-8.3 21-18.6S35.6 4 24 4Z"
        />
        <circle className="share-ic-dot" cx="14" cy="22.6" r="3.2" />
        <circle className="share-ic-dot" cx="24" cy="22.6" r="3.2" />
        <circle className="share-ic-dot" cx="34" cy="22.6" r="3.2" />
      </svg>
    );
  }
  return (
    <svg
      className="share-ic share-ic-print"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path className="share-ic-paper" d="M13 4h17l6 6v10H13Z" />
      <path
        className="share-ic-fill"
        d="M8 18h32a5 5 0 0 1 5 5v13h-7v-6H10v6H3V23a5 5 0 0 1 5-5Z"
      />
      <path className="share-ic-paper" d="M12 32h24v12H12Z" />
      <path className="share-ic-line" d="M16 36.5h16M16 40.5h11" />
      <circle className="share-ic-dot" cx="38" cy="24.5" r="2" />
    </svg>
  );
}

/** Props of {@link ShareButton}: the share, and the attributes of its button. */
export interface ShareButtonProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'onClick' | 'children'
> {
  /** The format was chosen. */
  onShare: (format: ShareFormat) => void;
  /**
   * A small, inline button instead of the full-width one.
   * @default false
   */
  small?: boolean;
  /**
   * As tall as big buttons beside it; otherwise the height of a normal
   * button, the same as the buttons around it.
   * @default false
   */
  big?: boolean;
  /**
   * The words of the button: « 📤 Tout partager » under a whole list.
   * @default '📤 Partager'
   */
  label?: string;
  /**
   * A GPX file can be shared too (marks): the first choice is then 📝 Texte
   * or 📍 GPX, the text going on to 💬 image or 🖨 PDF.
   * @default undefined
   */
  onGpx?: () => void;
}

/**
 * The one « 📤 Partager » button of the app. A touch turns it into two
 * buttons with an icon only: 💬 the image (WhatsApp…), 🖨 the PDF (mail,
 * print). Left alone, they fold back into « Partager ».
 * @param props - The share and the button attributes.
 * @returns The button, or the two choices.
 */
export function ShareButton({
  onShare,
  small = false,
  big = false,
  label = '📤 Partager',
  onGpx,
  className = '',
  ...rest
}: ShareButtonProps): ReactElement {
  // Closed, then 📝 Texte or 📍 GPX (when a GPX can be shared), then the
  // format of the text.
  const [step, setStep] = useState<'closed' | 'kind' | 'format'>('closed');
  const open = step !== 'closed';
  const setOpen = (value: boolean) => {
    setStep(value ? (onGpx ? 'kind' : 'format') : 'closed');
  };
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (step === 'closed') return undefined;
    const timer = setTimeout(() => setStep('closed'), FOLD_MS);
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setStep('closed');
    };
    document.addEventListener('pointerdown', away, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', away, true);
    };
  }, [step]);
  let size = 'btn ck-pub share-wide';
  if (small) size = 'btn ck-pub';
  else if (big) size = 'btn big ck-pub';
  if (!open) {
    return (
      <Button
        type="button"
        className={`${size} share-btn ${className}`.trim()}
        {...rest}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          buzz();
          setOpen(true);
        }}
      >
        {label}
      </Button>
    );
  }
  const pick = small ? 'share-pick share-pick-small' : 'share-pick';
  if (step === 'kind' && onGpx) {
    return (
      <span ref={box} className={`${pick} share-kind`}>
        <Button
          type="button"
          noUiEdit
          className={`${size} share-kind-btn`}
          data-share-kind="text"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            buzz();
            setStep('format');
          }}
        >
          📝 Texte
        </Button>
        <Button
          type="button"
          noUiEdit
          className={`${size} share-kind-btn`}
          data-share-kind="gpx"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            buzz();
            setStep('closed');
            onGpx();
          }}
        >
          📍 GPX
        </Button>
      </span>
    );
  }
  return (
    <span ref={box} className={pick}>
      {(['image', 'pdf'] as const).map((format) => (
        <Button
          key={format}
          type="button"
          noUiEdit
          className={`${size} share-fmt share-fmt-${format}`}
          data-share-fmt={format}
          aria-label={SHARE_FORMAT_NAMES[format]}
          title={SHARE_FORMAT_NAMES[format]}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            buzz();
            setOpen(false);
            onShare(format);
          }}
        >
          <ShareIcon format={format} />
        </Button>
      ))}
    </span>
  );
}

/** Props of {@link SendButton}. */
export interface SendButtonProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'children'
> {
  /** The format chosen with « Partager ». */
  format: ShareFormat;
}

/**
 * The last button of a share window: send in the format chosen, its icon
 * first.
 * @param props - The format and the button attributes.
 * @returns The button.
 */
export function SendButton({
  format,
  className = '',
  ...rest
}: SendButtonProps): ReactElement {
  return (
    <Button
      type="button"
      noUiEdit
      // The height of every action button (« Partager » before it), never a menu tile.
      className={`btn ck-pub share-send share-fmt-${format} ${className}`.trim()}
      data-share-send={format}
      aria-label={`Envoyer · ${SHARE_FORMAT_NAMES[format]}`}
      {...rest}
    >
      <ShareIcon format={format} />
      <span>Envoyer</span>
    </Button>
  );
}
