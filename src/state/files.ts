import { pad, textOf } from '../lib/format.ts';
import type { Cruise } from '../model/types.ts';

import { data } from './data.ts';
import { toast } from './toast.ts';

/** File saver of the claude.ai preview (`window.claude.use('downloads')`). */
interface ClaudeDownloads {
  save: (file: { filename: string; data: Blob }) => Promise<unknown>;
}

let claudeDownloadsLookup: Promise<ClaudeDownloads | false> | null = null;

/**
 * File name from the cruise name: accents removed, dashes, date (legacy `fileName`).
 * @param suffix - Added after the name (e.g. `-entrees`).
 * @param extension - File extension.
 * @param cruise - Cruise (the open one by default).
 * @returns e.g. `croatie-2026-entrees-20260715.csv`.
 */
export function fileName(
  suffix: string,
  extension: string,
  cruise: Cruise | null = data.cruise.value,
): string {
  const base = (textOf(cruise?.info.name) || 'navin')
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .replaceAll(/[^a-z0-9]+/gi, '-')
    .replaceAll(/^-|-$/g, '')
    .toLowerCase();
  const date = new Date();
  return `${base}${suffix}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.${extension}`;
}

/**
 * The claude.ai file saver when the page runs in its preview frame, looked up
 * once (legacy `claudeDownloads`).
 * @returns The saver, or `false`.
 */
export function claudeDownloads(): Promise<ClaudeDownloads | false> {
  claudeDownloadsLookup ??= findClaudeDownloads();
  return claudeDownloadsLookup;
}

async function findClaudeDownloads(): Promise<ClaudeDownloads | false> {
  try {
    const host = (
      globalThis as { claude?: { use?: (name: string) => Promise<unknown> } }
    ).claude;
    if (
      !host?.use ||
      !document.documentElement.classList.contains('in-frame')
    ) {
      return false;
    }
    return (
      ((await host.use('downloads')) as ClaudeDownloads | undefined) || false
    );
  } catch {
    return false;
  }
}

/**
 * Hand a file to the user: claude.ai saver, then the share sheet, then a
 * download link (legacy `deliver`).
 * @param content - File content.
 * @param name - File name.
 * @param type - MIME type.
 */
export async function deliver(
  content: BlobPart,
  name: string,
  type: string,
): Promise<void> {
  const blob = new Blob([content], { type });
  const saver = await claudeDownloads();
  if (saver) {
    try {
      await saver.save({ filename: name, data: blob });
      toast('Fichier enregistré · gardez-le dans Fichiers');
      return;
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'declined') return;
    }
  }
  const file = new File([blob], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
    }
  }
  const anchor = document.createElement('a');
  const url = URL.createObjectURL(blob);
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
