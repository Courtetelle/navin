import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { boatDocPhotos } from '../../features/boats/index.ts';
import { RestoreReportCard } from '../../features/data/RestoreReportCard.tsx';
import { syncPack } from '../../features/data/backup.ts';
import { sendMenus } from '../../features/data/menusExport.ts';
import { restoreFile } from '../../features/data/restoreFile.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { deliver, state, updateSettings } from '../../state/index.ts';

import { SyncSection } from './SyncSection.tsx';

/**
 * Paramétrages › Sauvegarde et synchronisation, in three parts whose reach
 * is said: the automatic synchronisation of the devices (and its copy kept
 * on the relay), a copy in a file (without Internet too), the menus sent to
 * the Mac.
 * @returns The three parts.
 */
export function BackupSections() {
  const tr = useTr();
  return (
    <>
      <SyncSection />
      <FileCopy />
      <FoldSection title="📋 Envoyer mes menus">
        <HelpText>
          Pour le développement de NavIn seulement : les check-in, listes,
          bases, boutons et météo que vous avez modifiés, sans aucune donnée
          personnelle, à envoyer par AirDrop vers le Mac.
        </HelpText>
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
          </Button>
        </ButtonRow>
      </FoldSection>
    </>
  );
}

/**
 * A copy of all the data in one file: to keep, to change of device, or to
 * pass the data to another device without Internet (AirDrop).
 * @returns The fold.
 */
function FileCopy() {
  useSignals();
  const tr = useTr();
  const file = useRef<HTMLInputElement>(null);
  const [making, setMaking] = useState(false);
  const withPhotos = state.preferences.settings.value.syncPhotos !== false;
  const make = async () => {
    buzz();
    setMaking(true);
    try {
      const pack = await syncPack(withPhotos, boatDocPhotos);
      pack.name = pack.name.replace('synchro', 'tout');
      await deliver(pack.json, pack.name, 'application/json');
    } finally {
      setMaking(false);
    }
  };
  return (
    <FoldSection id="backup" title="💾 Copie dans un fichier">
      <HelpText>
        Un fichier avec toutes les données de cet appareil : navigations,
        journal, traces, fiches, bateaux, marques, équipages, et les photos si
        vous le choisissez. Pour garder une copie (mail, Fichiers, Drive), pour
        changer d’appareil, ou pour passer les données à un autre appareil sans
        Internet, par AirDrop. Récupérer un fichier ajoute ce qui manque ici,
        sans rien effacer.
      </HelpText>
      <ButtonRow>
        <Button
          className={withPhotos ? 'btn on' : 'btn'}
          id="syncPhotos"
          onClick={() => {
            buzz();
            updateSettings((settings) => {
              settings.syncPhotos = settings.syncPhotos === false;
            });
          }}
        >
          {tr(`📷 Avec les photos : ${withPhotos ? 'OUI' : 'NON'}`)}
        </Button>
      </ButtonRow>
      <ButtonRow className="row c2">
        <Button
          className="btn big primary"
          id="allOut"
          disabled={making}
          onClick={() => {
            void make();
          }}
        >
          {tr('⬇ Exporter toutes les données')}
        </Button>
        <Button
          className="btn big"
          id="allIn"
          onClick={() => file.current?.click()}
        >
          {tr('⬆ Récupérer des données')}
        </Button>
      </ButtonRow>
      <RestoreReportCard />
      <HelpText>
        Récupérer ouvre le choix de fichier. Sur iPhone : Parcourir, puis Google
        Drive ou kDrive ; s’ils n’apparaissent pas, app Fichiers › Parcourir › ⋯
        › Modifier pour les activer. Sur Android, ils sont dans le menu ☰.
      </HelpText>
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
  );
}
