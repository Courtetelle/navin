import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { boatDocPhotos } from '../../features/boats/index.ts';
import { syncPack } from '../../features/data/backup.ts';
import { restoreFile } from '../../features/data/restoreFile.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { deliver, state, updateSettings } from '../../state/index.ts';

const SYNC_HELP =
  'Sans Internet : les deux appareils échangent un fichier par AirDrop (Wi-Fi et Bluetooth, de proche en proche). Chaque côté garde toutes les entrées des deux, et pour le reste c’est la modification la plus récente qui gagne.';
const SYNC_STEPS = [
  'Sur l’appareil A : Envoyer, puis AirDrop vers l’appareil B.',
  'Sur B : touchez la notification AirDrop, puis « Enregistrer dans Fichiers ».',
  'Sur B, dans l’appli : Recevoir et choisissez le fichier. B est à jour.',
  'Pour que A soit aussi à jour : refaites la même chose de B vers A.',
];

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
        <HelpText text={SYNC_HELP}>
          {tr('Sans Internet : les deux appareils échangent un fichier par ', {
            help: true,
          })}
          <b>{tr('AirDrop', { help: true })}</b>
          {tr(
            ' (Wi-Fi et Bluetooth, de proche en proche). Chaque côté garde toutes les entrées des deux, et pour le reste c’est la modification la plus récente qui gagne.',
            { help: true },
          )}
        </HelpText>
        <HelpText
          as="ol"
          className="sync-steps"
          items={SYNC_STEPS}
          text={SYNC_STEPS.join(' ')}
        >
          <li>
            {tr('Sur l’appareil A : ', { help: true })}
            <b>{tr('Envoyer', { help: true })}</b>
            {tr(', puis AirDrop vers l’appareil B.', { help: true })}
          </li>
          <li>{tr(SYNC_STEPS[1] as string, { help: true })}</li>
          <li>
            {tr('Sur B, dans l’appli : ', { help: true })}
            <b>{tr('Recevoir', { help: true })}</b>
            {tr(' et choisissez le fichier. B est à jour.', { help: true })}
          </li>
          <li>{tr(SYNC_STEPS[3] as string, { help: true })}</li>
        </HelpText>
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
        <HelpText>
          Sur le nouvel appareil, installez l’appli, ouvrez la roue dentée ⚙︎ et
          choisissez ce fichier. Les navigations déjà présentes sont fusionnées
          avec celles du fichier.
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
