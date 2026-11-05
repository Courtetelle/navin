import { useEffect, useState } from 'react';

import { getPhoto } from '../../storage/photos.ts';

/**
 * Load a stored photo (the data part of legacy `fillPhotos`).
 * @param id - Photo id.
 * @returns Its source once read, `undefined` while reading, null when missing.
 */
export function usePhotoUrl(id: string): string | null | undefined {
  const [loaded, setLoaded] = useState<{ id: string; url: string | null }>();
  useEffect(() => {
    let current = true;
    void getPhoto(id).then((value) => {
      if (!current) return;
      setLoaded({ id, url: typeof value === 'string' ? value : null });
    });
    return () => {
      current = false;
    };
  }, [id]);
  return loaded?.id === id ? loaded.url : undefined;
}
