/** What a share sends: an image (WhatsApp, Messages…) or a PDF (mail, print). */
export type ShareFormat = 'image' | 'pdf';

/** Spoken names of the two formats, for screen readers and long presses. */
export const SHARE_FORMAT_NAMES: Readonly<Record<ShareFormat, string>> = {
  image: 'Image, pour WhatsApp, Messages…',
  pdf: 'PDF, pour un mail ou l’impression',
};
