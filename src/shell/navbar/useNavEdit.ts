import { useLayoutEffect, useRef } from 'react';

import { navEdit } from './navBarState.ts';

/**
 * A sheet read-only until edited: the green ✔ of the nav bar becomes a pencil.
 * @param reading - The sheet is read-only.
 * @param onEdit - The pencil was touched.
 */
export function useNavEdit(reading: boolean, onEdit: () => void): void {
  const action = useRef(onEdit);
  useLayoutEffect(() => {
    action.current = onEdit;
  });
  useLayoutEffect(() => {
    if (!reading) return undefined;
    navEdit.value = () => action.current();
    return () => {
      navEdit.value = null;
    };
  }, [reading]);
}
