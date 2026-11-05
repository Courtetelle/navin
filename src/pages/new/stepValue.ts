import type { FieldDefinition } from '../../model/field.ts';

/**
 * Value after a step button: rounded to the field's decimals, wrapped around
 * (directions) or kept within its limits.
 * @param field - Field (`decimals`, `wrap`, `min`, `max`).
 * @param current - Current value.
 * @param step - Step.
 * @returns The new value.
 */
export function stepValue(
  field: Pick<FieldDefinition, 'decimals' | 'wrap' | 'min' | 'max'>,
  current: unknown,
  step: number,
): number {
  const { decimals = 0, wrap = false, min = 0, max = 0 } = field;
  const factor = 10 ** decimals;
  const value = Math.round((Number(current) + step) * factor) / factor;
  if (wrap) return ((value % (max + 1)) + (max + 1)) % (max + 1);
  return Math.min(max, Math.max(min, value));
}
