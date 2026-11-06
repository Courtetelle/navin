import type { IsobathLine } from './isobath.ts';
import { toLine } from './isobath.ts';

/**
 * Depth lines of Lake Geneva shipped with the app, computed from swissBATHY3D by
 * `scripts/bathy/generateLemanIsobaths.ts`. Lines computed on the device replace
 * the shipped ones where they overlap: they are finer.
 * @param device - Lines computed on the device, from 1 to 5 m.
 * @returns The lines to draw.
 */
export async function lemanIsobaths(
  device: readonly IsobathLine[],
): Promise<IsobathLine[]> {
  const { default: shipped } = await import('./lemanIsobaths.json');
  const deepest = Math.max(0, ...device.map((line) => line.d));
  return [...device, ...shipped.map(toLine).filter((line) => line.d > deepest)];
}
