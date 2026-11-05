let mapDay: string | null = null;

/**
 * Apply the argument of the map screen (legacy `VIEWS.map`): a day stays chosen
 * until another one, `'all'` shows the whole cruise.
 * @param day - Argument of the screen.
 * @returns The day shown, `null` for the whole cruise.
 */
export function applyMapDay(day: unknown): string | null {
  if (typeof day === 'string') mapDay = day === 'all' ? null : day;
  return mapDay;
}
