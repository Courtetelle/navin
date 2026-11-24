import { startZoneArchive } from '../zones/zoneArchiveSync.ts';

import { installPhotoViewer } from './photoViewer.ts';
import { startWindWatch } from './windStart.ts';

installPhotoViewer();
startWindWatch();
startZoneArchive();
