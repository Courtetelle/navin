import { layOutBlock } from './cardsBlock.ts';
import type { CardsPen } from './cardsPen.ts';
import { CARD_WIDTH, SERIF, font } from './cardsStyle.ts';
import type { LoadedPhoto, LoadedRow, LoadedSection } from './cardsTypes.ts';

/** A line once wrapped: label lines, value lines and heights. */
interface WrappedRow {
  label: string[];
  value: string[];
  photos: readonly LoadedPhoto[];
  textHeight: number;
  height: number;
}

/**
 * Lay out one section: two columns of cells in `mini`, label and value lines
 * in the other layouts.
 * @param pen - Pen.
 * @param section - The section.
 */
export function layOutSection(pen: CardsPen, section: LoadedSection): void {
  if (pen.theme === 'mini') gridSection(pen, section);
  else lineSection(pen, section);
}

/**
 * Lay out the footer.
 * @param pen - Pen.
 * @param date - Date printed in the footer.
 * @returns The height of the whole card.
 */
export function layOutFooter(pen: CardsPen, date: string): number {
  const { context, drawing, style, theme } = pen;
  const { margin } = style;
  const y = pen.y + 30;
  const footer = [`NavIn · ${date}`];
  if (theme === 'mini') {
    if (drawing) {
      context.fillStyle = '#111';
      context.fillRect(margin, y, CARD_WIDTH - 2 * margin, 2);
    }
    pen.text(footer, {
      font: font(22, 400),
      x: margin,
      y: y + 12,
      color: '#888',
      size: 22,
    });
  } else {
    const carnet = theme === 'carnet';
    pen.text(footer, {
      font: carnet ? `italic 24px ${SERIF}` : font(22, 600),
      x: CARD_WIDTH / 2,
      y,
      color: carnet ? '#8a7a5a' : '#8a95ab',
      size: 24,
      lineHeight: 1.3,
      align: 'center',
    });
  }
  return Math.ceil(y + 80);
}

function lineSection(pen: CardsPen, section: LoadedSection): void {
  const { context, drawing, innerWidth, style, theme } = pen;
  const {
    cardPadding,
    labelColor,
    labelFont,
    labelWidth,
    margin,
    separator,
    valueColor,
    valueFont,
  } = style;
  const carnet = theme === 'carnet';
  const left = margin + cardPadding;
  const valueWidth = innerWidth - labelWidth;
  const rows = section.rows.map((row) => wrapLine(pen, row, valueWidth));
  let bodyHeight = 0;
  for (const row of rows) bodyHeight += row.height;
  layOutBlock(pen, section.title, bodyHeight, (top) => {
    let y = top;
    for (const [index, row] of rows.entries()) {
      if (drawing && (index > 0 || carnet)) {
        context.fillStyle = separator;
        context.fillRect(
          left,
          carnet ? y + row.height - 2 : y - 2,
          innerWidth,
          carnet ? 1.5 : 2,
        );
      }
      pen.text(row.label, {
        font: labelFont,
        x: left,
        y: y + 14,
        color: labelColor,
        size: carnet ? 25 : 21,
        lineHeight: carnet ? 1.28 : 1.3,
      });
      pen.text(row.value, {
        font: valueFont,
        x: left + labelWidth,
        y: y + 8,
        color: valueColor,
        size: 32,
      });
      if (row.photos.length > 0) {
        const photoTop = y + row.textHeight - 16;
        pen.drawRowPhotos(row.photos, left + labelWidth, photoTop, valueWidth);
      }
      y += row.height;
    }
  });
}

function wrapLine(
  pen: CardsPen,
  row: LoadedRow,
  valueWidth: number,
): WrappedRow {
  const { style, theme } = pen;
  const labelText = style.labelUpper ? row.label.toUpperCase() : row.label;
  const label = pen.wrap(labelText, style.labelFont, style.labelWidth - 24);
  const value = pen.wrap(row.value, style.valueFont, valueWidth);
  const labelLine = theme === 'carnet' ? 32 : 27;
  const textHeight = Math.max(label.length * labelLine, value.length * 41) + 26;
  return {
    label,
    value,
    photos: row.photos,
    textHeight,
    height: textHeight + pen.rowPhotosHeight(row.photos, valueWidth),
  };
}

function gridSection(pen: CardsPen, section: LoadedSection): void {
  const { context, drawing, innerWidth, style } = pen;
  const { labelColor, labelFont, margin, separator, valueColor, valueFont } =
    style;
  const columns = section.rows.some((row) => row.photos.length > 0) ? 1 : 2;
  const cellWidth = columns === 1 ? innerWidth : (innerWidth - 48) / 2;
  const cells = section.rows.map((row) => wrapCell(pen, row, cellWidth));
  const rowHeights: number[] = [];
  let bodyHeight = 0;
  for (let index = 0; index < cells.length; index += columns) {
    const next = columns > 1 ? cells[index + 1] : undefined;
    const height = Math.max(
      (cells[index] as WrappedRow).height,
      next ? next.height : 0,
    );
    rowHeights.push(height);
    bodyHeight += height;
  }
  layOutBlock(pen, section.title, bodyHeight, (top) => {
    let y = top;
    for (let index = 0; index < cells.length; index += columns) {
      for (let column = 0; column < columns; column++) {
        const cell = cells[index + column];
        if (!cell) continue;
        const x = margin + column * (cellWidth + 48);
        if (drawing) {
          context.fillStyle = separator;
          context.fillRect(x, y, cellWidth, 2);
        }
        pen.text(cell.label, {
          font: labelFont,
          x,
          y: y + 12,
          color: labelColor,
          size: 19,
          lineHeight: 1.3,
        });
        pen.text(cell.value, {
          font: valueFont,
          x,
          y: y + 14 + cell.label.length * 25,
          color: valueColor,
          size: 31,
          lineHeight: 1.28,
        });
        if (cell.photos.length > 0) {
          pen.drawRowPhotos(
            cell.photos,
            x,
            y + cell.textHeight - 10,
            cellWidth,
          );
        }
      }
      y += rowHeights[index / columns] as number;
    }
  });
}

function wrapCell(
  pen: CardsPen,
  row: LoadedRow,
  cellWidth: number,
): WrappedRow {
  const { style } = pen;
  const labelText = row.label.toUpperCase();
  const label = pen.wrap(labelText, style.labelFont, cellWidth);
  const value = pen.wrap(row.value, style.valueFont, cellWidth);
  const textHeight = label.length * 25 + value.length * 40 + 34;
  return {
    label,
    value,
    photos: row.photos,
    textHeight,
    height: textHeight + pen.rowPhotosHeight(row.photos, cellWidth),
  };
}
