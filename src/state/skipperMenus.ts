import { uid } from '../lib/format.ts';

import { updateBoats } from './boats.ts';
import { data } from './data.ts';

/**
 * The menus as the skipper shaped them and sent them (« Envoyer mes menus »),
 * made the menus of the app, once on each device, after the boot (the boot
 * itself stays the one of the first app).
 *
 * 14.11.2026, the day check-in of the Savannah: the horseshoe put in place,
 * the sails at the end, no more « Mettre le contact » nor « Vérifier le
 * carburant ». What was added on the device is kept.
 */
export function applySkipperMenus(): void {
  const savannah = data.boats.value.find((boat) => boat.id === 'savannah');
  if (!savannah || savannah.ckMenus2611) return;
  updateBoats((boats) => {
    const boat = boats.find((one) => one.id === 'savannah');
    if (!boat) return;
    const list = (boat.checklistDep || []).filter(
      (item) =>
        item.label !== 'Mettre le contact' &&
        item.label !== 'Vérifier le carburant',
    );
    for (const item of list) {
      if (item.label === 'Sortir la bouée fer à cheval') {
        item.label = 'Installer la bouée fer à cheval';
      }
    }
    if (!list.some((item) => item.label === 'Installer les voiles')) {
      list.push({ id: uid(), label: 'Installer les voiles' });
    }
    boat.checklistDep = list;
    boat.ckMenus2611 = true;
  }, true);
}
