import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { boatDocPhotos } from '../../features/boats/index.ts';
import { syncPack } from '../../features/data/backup.ts';
import { sendMenus } from '../../features/data/menusExport.ts';
import { restoreFile } from '../../features/data/restoreFile.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { deliver, state, updateSettings } from '../../state/index.ts';

import { SyncHelp } from './SyncHelp.tsx';

async function exportEverything(): Promise<void> {
  buzz();
  const pack = await syncPack(false, boatDocPhotos);
  pack.name = pack.name.replace('synchro', 'tout');
  void deliver(pack.json, pack.name, 'application/json');
}

/**
 * Sync between two devices and backup of all the data (legacy `backupHtml`,
 * `bindBackup`).
 * @returns The two sections.
 */
export function BackupSections() {
  useSignals();
  const tr = useTr();
  const file = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const withPhotos = state.preferences.settings.value.syncPhotos !== false;
  const send = async () => {
    buzz();
    setSending(true);
    try {
      const pack = await syncPack(withPhotos, boatDocPhotos);
      await deliver(pack.json, pack.name, 'application/json');
    } finally {
      setSending(false);
    }
  };
  return (
    <>
      <FoldSection id="sync" title="🔄 Synchroniser téléphone et tablette">
        <SyncHelp />
        <ButtonRow className="row set-stack">
          <Button
            className={withPhotos ? 'btn big on' : 'btn big'}
            id="syncPhotos"
            onClick={() => {
              buzz();
              updateSettings((settings) => {
                settings.syncPhotos = settings.syncPhotos === false;
              });
            }}
          >
            <span className="sp-t">
              {tr(`📷 Avec les photos : ${withPhotos ? 'OUI' : 'NON'}`)}
            </span>
            <small>{tr('toucher pour changer')}</small>
          </Button>
          <Button
            className="btn big primary"
            id="syncOut"
            disabled={sending}
            onClick={() => {
              void send();
            }}
          >
            {tr('📤 Envoyer')}
            <small>{tr('vers l’autre appareil')}</small>
          </Button>
          <Button
            className="btn big"
            id="syncIn"
            onClick={() => file.current?.click()}
          >
            {tr('📥 Recevoir')}
            <small>{tr('fichier de l’autre appareil')}</small>
          </Button>
        </ButtonRow>
      </FoldSection>
      <FoldSection id="backup" title="Toutes mes données">
        <HelpText>
          Pour changer de téléphone ou garder une copie : « Exporter » crée un
          fichier avec toutes les croisières (journal, journées, équipage,
          signatures, traces) et les réglages. Envoyez-le vous par mail ou
          enregistrez-le dans Fichiers / Drive.
        </HelpText>
        <ButtonRow>
          <Button
            className="btn big primary"
            id="allOut"
            onClick={() => {
              void exportEverything();
            }}
          >
            {tr('⬇ Exporter toutes les données')}
          </Button>
        </ButtonRow>
        <ButtonRow>
          <Button
            className="btn big"
            id="menusOut"
            onClick={() => {
              buzz();
              void sendMenus();
            }}
          >
            {tr('📋 Envoyer mes menus')}
            <small>
              {tr(
                'check-in, listes, bases, boutons et météo modifiés · sans données personnelles · AirDrop vers le Mac',
              )}
            </small>
          </Button>
        </ButtonRow>
        <HelpText>
          Sur le nouvel appareil, installez l’appli, ouvrez les Réglages et
          choisissez ce fichier. Les navigations déjà présentes sont fusionnées
          avec celles du fichier.
        </HelpText>
        <HelpText>
          Le bouton ci-dessous ouvre le choix de fichier du téléphone. Sur
          iPhone, touchez Parcourir puis Google Drive ou kDrive. S’ils
          n’apparaissent pas : ouvrez l’app Fichiers, Parcourir, le bouton ⋯,
          Modifier, et activez-les (leurs apps doivent être installées). Sur
          Android, ils sont dans le menu ☰ du choix de fichier.
        </HelpText>
        <ButtonRow>
          <Button
            className="btn big"
            id="allIn"
            onClick={() => file.current?.click()}
          >
            {tr('⬆ Récupérer des données')}
          </Button>
        </ButtonRow>
        <input
          type="file"
          id="allFile"
          accept=".json,application/json"
          hidden
          ref={file}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            event.target.value = '';
            if (chosen) void restoreFile(chosen);
          }}
        />
      </FoldSection>
    </>
  );
}
