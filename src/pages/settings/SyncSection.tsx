import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { RefreshButton } from '../../components/shared/RefreshButton.tsx';
import { KeyQr } from '../../features/onwater/KeyQr.tsx';
import { KeyScan } from '../../features/onwater/KeyScan.tsx';
import { relayAddress } from '../../features/onwater/relayRecord.ts';
import {
  newSyncKey,
  syncKey,
  syncRound,
  syncStatus,
} from '../../features/sync/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtHhMm } from '../../lib/format.ts';
import { state, toast, updateSettings } from '../../state/index.ts';

/**
 * The automatic synchronisation: what it does, its state, and the key that
 * pairs the devices (made on the first, read by QR code on the others).
 * @returns The block.
 */
export function SyncSection() {
  useSignals();
  const tr = useTr();
  const settings = state.preferences.settings.value;
  const key = syncKey();
  const relay = relayAddress();
  const auto = settings.syncAuto !== false;
  const status = syncStatus.value;
  return (
    <div className="sync-auto" id="sync">
      <h3>{tr('🔄 Synchronisation automatique')}</h3>
      <HelpText keep>
        Vos appareils (téléphone, tablette, iPad) gardent les mêmes données,
        seuls : navigations, journal, traces, fiches, bateaux, marques,
        équipages, journal SOS, photos et clés météo. Ce qui est effacé sur l’un
        l’est sur les autres. Les données passent par votre relais Cloudflare,
        chiffrées sur l’appareil (AES-256) : personne d’autre ne peut les lire.
        Le relais en garde la dernière version : c’est aussi votre sauvegarde.
        Les autres Paramétrages restent propres à chaque appareil. Vos menus
        (listes, boutons), sans aucune donnée personnelle, y sont aussi laissés
        en clair pour le développement de NavIn.
      </HelpText>
      {relay ? null : (
        <p className="sync-state sync-error">
          {tr(
            'Il faut d’abord le relais : Paramétrages › Clés météos et compte relais (Cloudflare).',
          )}
        </p>
      )}
      {relay && !key ? <SyncPairing /> : null}
      {relay && key ? (
        <>
          <p
            className={`sync-state sync-${status.kind}`}
            role="status"
            data-sync-state={status.kind}
          >
            {tr(status.said || 'Synchronisation prête')}
            {status.at ? ` · ${tr('dernière à')} ${timeOf(status.at)}` : ''}
          </p>
          <ButtonRow className="row c2">
            <RefreshButton
              className="btn big primary"
              label="🔄 Synchroniser maintenant"
              busy={status.kind === 'busy'}
              data-sync="now"
              onRefresh={() => syncRound(true)}
            />
            <Button
              className={auto ? 'btn big on' : 'btn big'}
              data-sync="auto"
              onClick={() => {
                buzz();
                updateSettings((next) => {
                  next.syncAuto = !auto;
                });
                if (!auto) void syncRound(true);
              }}
            >
              {tr(`Automatique : ${auto ? 'OUI' : 'NON'}`)}
            </Button>
          </ButtonRow>
          <HelpText>
            Pour ajouter un appareil, ou garder la clé en lieu sûr : « Partager
            la clé » montre son QR code. Sur l’autre appareil : Paramétrages ›
            Sauvegarde et synchronisation › « 📥 Importer la clé de
            synchronisation ». Sans la clé, la copie du relais ne peut plus être
            lue : gardez-en une photo du QR code en lieu sûr.
          </HelpText>
          <KeyQr id="sync" value={key} />
        </>
      ) : null}
    </div>
  );
}

/**
 * No key yet: made here on the first device, read by QR code on the others.
 * @returns The two ways.
 */
function SyncPairing() {
  const tr = useTr();
  return (
    <>
      <HelpText>
        Premier appareil : créez la clé de synchronisation. Autres appareils :
        importez-la en visant son QR code (montré par « Partager la clé » sur le
        premier). La clé ne passe jamais par Internet.
      </HelpText>
      <ButtonRow>
        <Button
          className="btn primary"
          data-sync="create"
          onClick={() => {
            buzz();
            updateSettings((settings) => {
              settings.windAlert = {
                ...settings.windAlert,
                syncKey: newSyncKey(),
              };
            });
            toast('🔑 Clé de synchronisation créée');
            void syncRound(true);
          }}
        >
          {tr('🔑 Créer la clé')}
          <small>{tr('sur le premier appareil seulement')}</small>
        </Button>
      </ButtonRow>
      <ButtonRow>
        <KeyScan only="sync" />
      </ButtonRow>
    </>
  );
}

function timeOf(at: number): string {
  return fmtHhMm(new Date(at));
}
