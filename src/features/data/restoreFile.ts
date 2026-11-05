import { go } from '../../shell/router.ts';
import { toast } from '../../state/index.ts';

import { applyIcon } from './appIcon.ts';
import type { BackupFile } from './restoreBackup.ts';
import { restoreBackup } from './restoreBackup.ts';
import { restoredMessage } from './restoredMessage.ts';

/**
 * Read a backup or sync file chosen by the user and merge it, then show the
 * result (legacy `restoreFile`).
 * @param file - File picked.
 */
export async function restoreFile(file: Blob): Promise<void> {
  try {
    const backup = JSON.parse(await file.text()) as BackupFile;
    const result = await restoreBackup(backup);
    applyIcon();
    if (result.count === 0) {
      toast('🔄 Fiches récupérées : bateaux, équipage, check-lists');
      go('more');
      return;
    }
    toast(restoredMessage(backup, result));
    go('cruises');
  } catch {
    toast('Fichier de sauvegarde invalide');
  }
}
