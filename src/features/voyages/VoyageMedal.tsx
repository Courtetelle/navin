import type { Voyage } from '../../model/voyages.ts';
import { usePhotoUrl } from '../onwater/index.ts';

function Photo({ photo, fallback }: { photo: string; fallback: string }) {
  const url = usePhotoUrl(photo);
  if (url === null) return <span className="voy-medal-icon">{fallback}</span>;
  return (
    <img
      className="voy-medal"
      alt=""
      data-voymedal={photo}
      src={url ?? undefined}
    />
  );
}

/**
 * The mark of a cruise: its photo in a medallion, or ⭐ when it is the
 * active one and ⛵ otherwise.
 * @param props - The cruise.
 * @param props.voyage - Its photo.
 * @param props.active - It is the active one.
 * @returns The medallion or the icon.
 */
export function VoyageMedal({
  voyage,
  active,
}: {
  voyage: Pick<Voyage, 'photo'>;
  active: boolean;
}) {
  const fallback = active ? '⭐' : '⛵';
  return voyage.photo ? (
    <Photo photo={voyage.photo} fallback={fallback} />
  ) : (
    <span className="voy-medal-icon">{fallback}</span>
  );
}
