/**
 * The automatic synchronisation between the devices of the skipper, through
 * their relay, encrypted on the devices (AES-256-GCM).
 */
export { newSyncKey } from './syncCrypto.ts';
export {
  syncDevice,
  syncKey,
  syncReady,
  syncRound,
  syncStatus,
} from './syncEngine.ts';
export type { SyncStatus } from './syncEngine.ts';
