import { signal } from '@preact/signals-react';

/**
 * A route is being drawn on the map: a tap lays a point of the route, not
 * the cross.
 */
export const routeEditing = signal(false);

/** The route icon: a broken line between three points. */
export const ROUTE_ICON =
  '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 19.5 10 8.5l5.5 7L19.5 4.5" stroke-width="2.2"/><circle cx="4.5" cy="19.5" r="2.4" fill="currentColor" stroke="none"/><circle cx="10" cy="8.5" r="2.4" fill="#fff" stroke-width="1.6"/><circle cx="15.5" cy="15.5" r="2.4" fill="#fff" stroke-width="1.6"/><circle cx="19.5" cy="4.5" r="2.4" fill="currentColor" stroke="none"/></svg>';
