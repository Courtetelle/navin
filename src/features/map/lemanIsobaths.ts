import type { IsobathLine } from './isobath.ts';
import { toLine } from './isobath.ts';

/**
 * Depth lines of Lake Geneva shipped with the app, computed from swissBATHY3D by
 * `scripts/bathy/generateLemanDepths.ts`. Lines computed on the device replace
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

/**
 * All the depth lines of Lake Geneva, from 1 to 300 m, for the full layer.
 * @param device - Lines computed on the device, from 1 to 5 m.
 * @returns The lines to draw.
 */
export async function lemanFullIsobaths(
  device: readonly IsobathLine[],
): Promise<IsobathLine[]> {
  const { default: deep } = await import('./lemanIsobathsDeep.json');
  return [...(await lemanIsobaths(device)), ...deep.map(toLine)];
}
