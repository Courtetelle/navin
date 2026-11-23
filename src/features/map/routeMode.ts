import { signal } from '@preact/signals-react';

/**
 * A route is being drawn on the map: a tap lays a point of the route, not
 * the cross.
 */
export const routeEditing = signal(false);

/** The part of Routes shown: draw routes, or a weather routing. */
export const routesPart = signal<'draw' | 'routing'>('draw');

/** « Nouvelle route »: a broken line with a ＋ at its end. */
export const ROUTE_NEW_ICON =
  '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 20.5 8 11l4.5 5.5 3-5" stroke-width="2.2"/><circle cx="3.5" cy="20.5" r="2.2" fill="currentColor" stroke="none"/><circle cx="8" cy="11" r="2.2" fill="#fff" stroke-width="1.6"/><circle cx="12.5" cy="16.5" r="2.2" fill="#fff" stroke-width="1.6"/><path d="M18.5 2.5v8M14.5 6.5h8" stroke="#1a8a3a" stroke-width="2.8"/></svg>';

/** « Routage météo »: a route bent by the wind, a barb above it. */
export const ROUTE_WX_ICON =
  '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 20.5c3-1 4-5 7.5-5.5s4.5 3 9.5-2" stroke-width="2.2" stroke-dasharray="0.1 3.6"/><circle cx="3.5" cy="20.5" r="2.2" fill="currentColor" stroke="none"/><circle cx="20.5" cy="13" r="2.2" fill="currentColor" stroke="none"/><path d="M4 7.5h11M15 7.5l3.5-4.5M12 7.5l3-4" stroke="#1e5aa8" stroke-width="2.2"/><path d="M6 11h8" stroke="#1e5aa8" stroke-width="1.8"/></svg>';

/** The route icon: a broken line between three points. */
export const ROUTE_ICON =
  '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 19.5 10 8.5l5.5 7L19.5 4.5" stroke-width="2.2"/><circle cx="4.5" cy="19.5" r="2.4" fill="currentColor" stroke="none"/><circle cx="10" cy="8.5" r="2.4" fill="#fff" stroke-width="1.6"/><circle cx="15.5" cy="15.5" r="2.4" fill="#fff" stroke-width="1.6"/><circle cx="19.5" cy="4.5" r="2.4" fill="currentColor" stroke="none"/></svg>';
