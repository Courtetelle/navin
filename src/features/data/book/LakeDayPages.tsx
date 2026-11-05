import type { PickedSheet } from '../../boats/index.ts';
import { LakeSheet } from '../../boats/index.ts';

/**
 * Printed page of a lake day.
 * @param props - Sheet.
 * @param props.sheet - Parts of the day sheet to print.
 * @returns The page.
 */
export function SheetPage({ sheet }: { sheet: PickedSheet }) {
  return (
    <section className="pg">
      <LakeSheet sheet={sheet} />
    </section>
  );
}

/**
 * Printed copy of the sheet on screen: its map and photos are already drawn.
 * @param props - Sheet.
 * @param props.sheet - The `#sheet` element.
 * @returns The page.
 */
export function LiveSheetPage({ sheet }: { sheet: Element }) {
  return (
    <section
      className="pg"
      ref={(section) => {
        section?.replaceChildren(sheet.cloneNode(true));
      }}
    />
  );
}
