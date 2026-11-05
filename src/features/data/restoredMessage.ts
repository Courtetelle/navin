import type { BackupFile, RestoreResult } from './restoreBackup.ts';

/**
 * Bubble shown after a restoration (legacy `restoreFile`).
 * @param backup - File restored.
 * @param result - What was restored.
 * @returns The message.
 */
export function restoredMessage(
  backup: BackupFile,
  { count, last }: RestoreResult,
): string {
  if ((backup.version ?? 0) >= 4) {
    return `🔄 Synchronisé : ${count} navigation${count > 1 ? 's' : ''}`;
  }
  return count > 1
    ? `${count} croisières récupérées`
    : `Croisière « ${last?.info.name || ''} » récupérée`;
}
