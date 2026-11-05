import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import type { Zone } from '../../features/map/zoneStore.ts';
import { useTr } from '../../i18n/useTr.ts';
import { fmtShortDate } from '../../lib/format.ts';

/** Props of {@link ZoneItem}. */
export interface ZoneItemProps {
  /** The zone. */
  zone: Zone;
  /** Frame the zone on the map. */
  onShow: () => void;
  /** Delete the zone. */
  onDelete: () => void;
}

/**
 * One offline zone of the list.
 * @param props - The zone and its actions.
 * @returns The section.
 */
export function ZoneItem({ zone, onShow, onDelete }: ZoneItemProps) {
  const tr = useTr();
  const missing = zone.ko ? ` (${zone.ko} manquantes)` : '';
  return (
    <section className="field">
      <h3>{zone.name}</h3>
      <HelpText nextIsRow>
        {`${fmtShortDate(new Date(zone.at))} · zoom ${zone.zmax} · ${zone.ok} tuiles${missing}`}
      </HelpText>
      <div className="row c2">
        <Button className="btn" data-show={zone.id} onClick={onShow}>
          {tr('🗺 Voir')}
        </Button>
        <Button className="btn danger" data-del={zone.id} onClick={onDelete}>
          {tr('🗑 Supprimer')}
        </Button>
      </div>
    </section>
  );
}
