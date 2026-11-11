import {
  commentsApi,
  pendingRemarks,
  remarkContext,
  remarks,
  remarksDigest,
  saveRemarks,
} from './remarkContext.ts';

/** Outcome of sending a remark. */
interface SendOutcome {
  /** Delivered (directly or as a preview comment). */
  sent: boolean;
  /** Message to show: a bubble when `toast`, else under the form. */
  message: string;
  /** Close the window and show `message` in the bubble. */
  toast: boolean;
}

/**
 * Send a remark (nav.js:1433-1459): kept in `ldb.remarks` first, then sent to
 * Claude through the preview comments when available (direct send, else a
 * comment anchored on the element), else copied to the clipboard.
 * @param text - Remark typed.
 * @param element - Element aimed at.
 * @param anchor - Anchor prepared when the window opened.
 * @returns What to show.
 */
export async function sendRemark(
  text: string,
  element: Element | null,
  anchor: Promise<unknown> | null,
): Promise<SendOutcome> {
  const full = `${text}\n\n${remarkContext(element)}`;
  saveRemarks([
    ...remarks(),
    { t: new Date().toISOString(), text: full, sent: false },
  ]);
  const delivered = await deliverToClaude(full, element, anchor);
  if (delivered) {
    const list = remarks();
    const last = list.at(-1);
    if (last) saveRemarks([...list.slice(0, -1), { ...last, sent: true }]);
    return {
      sent: true,
      message: delivered,
      toast: delivered.startsWith('Envoy'),
    };
  }
  try {
    await navigator.clipboard.writeText(full);
    return {
      sent: false,
      message:
        'Pas d’envoi direct ici : remarque gardée dans « Mes remarques » et copiée, collez-la dans la conversation.',
      toast: false,
    };
  } catch {
    return {
      sent: false,
      message:
        'Pas d’envoi direct ici : remarque gardée dans « Mes remarques ».',
      toast: false,
    };
  }
}

/**
 * Keep a remark on the phone, without sending it.
 * @param text - Remark typed.
 * @param element - Element aimed at.
 */
export function keepRemark(text: string, element: Element | null): void {
  saveRemarks([
    ...remarks(),
    {
      t: new Date().toISOString(),
      text: `${text}\n\n${remarkContext(element)}`,
      sent: false,
    },
  ]);
}

/**
 * Copy the remarks waiting to be given to Claude, then mark them as copied so
 * that the next copy holds only the new ones. They stay marked as waiting when
 * the copy fails.
 * @returns How many remarks were copied.
 */
export async function copyPendingRemarks(): Promise<number> {
  const list = remarks();
  const pending = pendingRemarks(list);
  if (pending.length === 0) return 0;
  await navigator.clipboard.writeText(remarksDigest(pending));
  saveRemarks(
    list.map((remark) =>
      pending.includes(remark) ? { ...remark, copied: true } : remark,
    ),
  );
  return pending.length;
}

async function deliverToClaude(
  full: string,
  element: Element | null,
  prepared: Promise<unknown> | null,
): Promise<string> {
  const comments = commentsApi();
  if (!comments || !element) return '';
  try {
    const anchor = prepared
      ? await prepared
      : await comments.anchorFor(element);
    const body = { anchor, text: full.slice(0, 3900) };
    let why = '';
    try {
      await comments.sendToClaude(body);
      return 'Envoyé à Claude ✓ La réponse arrive dans la conversation.';
    } catch (error) {
      why = (error as { code?: string } | null)?.code || 'refus';
    }
    let can = '';
    try {
      can = await comments.canSendToClaude();
    } catch {
      can = 'off';
    }
    await comments.create(body);
    let copied = false;
    try {
      await navigator.clipboard.writeText(full);
      copied = true;
    } catch {
      copied = false;
    }
    return `Remarque posée sur l’aperçu ✓ mais claude.ai ne me prévient pas tout seul (${why}${can ? ` · ${can}` : ''}). Écrivez simplement « remarque » dans la conversation${copied ? ', ou collez-la : elle est copiée' : ''}.`;
  } catch {
    return '';
  }
}
