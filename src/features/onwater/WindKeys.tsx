import { KeyHealthNotice } from './KeyHealthNotice.tsx';
import { KeyQrAll } from './KeyQrAll.tsx';
import { KeyScan } from './KeyScan.tsx';
import { MfKeyRow } from './MfKeyRow.tsx';
import { RelayRow } from './RelayRow.tsx';
import { StationKeyRow } from './StationKeyRow.tsx';
import { AEMET_KEY, FROST_KEY, MET_OFFICE_KEY } from './stationKeys.ts';

/**
 * The keys of the networks of measured wind (Météo-France, AEMET, Met
 * Office) and the address of the relay, in Réglages: the wind alerts
 * themselves are in the Météo menu.
 * @returns The rows.
 */
export function WindKeys() {
  return (
    <div className="wind-alert wind-keys">
      <KeyHealthNotice />
      <div className="key-all">
        <KeyQrAll />
        <KeyScan all />
      </div>
      <MfKeyRow />
      <StationKeyRow station={AEMET_KEY} />
      <StationKeyRow station={MET_OFFICE_KEY} />
      <StationKeyRow station={FROST_KEY} />
      <RelayRow />
    </div>
  );
}
