import { signal } from '@preact/signals-react';

/**
 * A route is being drawn on the map: a tap lays a point of the route, not
 * the cross.
 */
export const routeEditing = signal(false);
