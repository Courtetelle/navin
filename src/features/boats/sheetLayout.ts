import { capOver } from '../../lib/canvas.ts';
import { fmtTime } from '../../lib/format.ts';
import { PHOTO_CTX } from '../../storage/photos.ts';
import type { CruisePhoto } from '../onwater/index.ts';

import type { SheetImageContent } from './sheetTypes.ts';

/** Width of the sheet image in pixels. */
export const SHEET_WIDTH = 1080;

const PADDING = 56;
const LABEL_WIDTH = 330;
const TEXT_WIDTH = SHEET_WIDTH - 2 * PADDING;
const NAVY = '#0a2a5c';

/** A photo ready to draw. */
export interface SheetPicture {
  photo: CruisePhoto;
  image: HTMLImageElement;
}

/** Pictures of a sheet, read beforehand. */
export interface SheetImages {
  signature: HTMLImageElement | null;
  trace: HTMLImageElement | null;
  pictures: readonly SheetPicture[];
}

interface Pen {
  context: CanvasRenderingContext2D;
  draw: boolean;
  y: number;
}

/**
 * Lay a sheet out, and draw it when asked.
 * @param context - Canvas context.
 * @param sheet - Sheet content.
 * @param images - Pictures of the sheet.
 * @param draw - `false` only measures.
 * @returns The height of the sheet in pixels.
 */
export function sheetLayout(
  context: CanvasRenderingContext2D,
  sheet: SheetImageContent,
  images: SheetImages,
  draw: boolean,
): number {
  const pen: Pen = { context, draw, y: 0 };
  drawTitle(pen, sheet.title);
  drawSections(pen, sheet);
  drawTrace(pen, images.trace);
  drawExtract(pen, sheet);
  if (sheet.showObs !== false) {
    heading(pen, '2 · Observations, constatations, propositions');
    const lines = wrap(pen, sheet.obs || '–', 30, 600, TEXT_WIDTH);
    pen.y += put(pen, lines, 30, 600, PADDING, pen.y, '#000') + 8;
  }
  if (images.pictures.length > 0) {
    heading(pen, sheet.photosTitle || 'Photos');
    drawPictures(pen, images.pictures);
  }
  drawSignature(pen, images.signature, sheet.sigName);
  drawChecks(pen, sheet);
  return Math.ceil(pen.y + PADDING);
}

function fontOf(size: number, weight: number): string {
  return `${weight} ${size}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
}

function wrap(
  { context }: Pen,
  text: string,
  size: number,
  weight: number,
  maxWidth: number,
): string[] {
  context.font = fontOf(size, weight);
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

function put(
  { context, draw }: Pen,
  lines: readonly string[],
  size: number,
  weight: number,
  x: number,
  top: number,
  color: string,
): number {
  if (draw) {
    context.font = fontOf(size, weight);
    context.fillStyle = color;
    for (const [index, line] of lines.entries()) {
      context.fillText(line, x, top + size + index * size * 1.3);
    }
  }
  return lines.length * size * 1.3;
}

function heading(pen: Pen, text: string): void {
  pen.y += 18;
  const lines = wrap(pen, text, 32, 800, TEXT_WIDTH);
  pen.y += put(pen, lines, 32, 800, PADDING, pen.y, NAVY) + 10;
}

function drawTitle(pen: Pen, title: string): void {
  const lines = wrap(pen, title, 46, 800, TEXT_WIDTH);
  const height = lines.length * 46 * 1.3 + 2 * 36;
  if (pen.draw) {
    pen.context.fillStyle = '#ffd400';
    pen.context.fillRect(0, 0, SHEET_WIDTH, height);
  }
  put(pen, lines, 46, 800, PADDING, 36, '#000');
  pen.y = height + 24;
}

function drawSections(pen: Pen, sheet: SheetImageContent): void {
  for (const section of sheet.sections) {
    heading(pen, section.title);
    for (const [label, value] of section.rows) {
      const labelLines = wrap(pen, label, 30, 500, LABEL_WIDTH - 20);
      const valueLines = wrap(pen, value, 34, 700, TEXT_WIDTH - LABEL_WIDTH);
      const left = put(pen, labelLines, 30, 500, PADDING, pen.y + 3, '#333');
      const x = PADDING + LABEL_WIDTH;
      const right = put(pen, valueLines, 34, 700, x, pen.y, '#000');
      pen.y += Math.max(left, right) + 14;
      if (pen.draw) {
        pen.context.fillStyle = '#ccc';
        pen.context.fillRect(PADDING, pen.y - 7, TEXT_WIDTH, 2);
      }
    }
  }
}

function drawTrace(pen: Pen, trace: HTMLImageElement | null): void {
  if (!trace) return;
  heading(pen, 'Trace du jour');
  const height = trace.height * (TEXT_WIDTH / trace.width);
  if (pen.draw) {
    pen.context.drawImage(trace, PADDING, pen.y, TEXT_WIDTH, height);
    pen.context.strokeStyle = '#000';
    pen.context.lineWidth = 3;
    pen.context.strokeRect(PADDING, pen.y, TEXT_WIDTH, height);
  }
  pen.y += height + 10;
}

function drawExtract(pen: Pen, sheet: SheetImageContent): void {
  const rows = sheet.extract ?? [];
  if (rows.length === 0) return;
  heading(pen, sheet.extractTitle || 'Extrait du journal');
  const x = PADDING + 130;
  for (const row of rows) {
    put(pen, [row.time], 32, 800, PADDING, pen.y, '#000');
    const what = wrap(pen, row.what, 32, 800, TEXT_WIDTH - 130);
    pen.y += put(pen, what, 32, 800, x, pen.y, '#000');
    if (row.more) {
      const more = wrap(pen, row.more, 26, 500, TEXT_WIDTH - 130);
      pen.y += put(pen, more, 26, 500, x, pen.y, '#333');
    }
    pen.y += 10;
  }
}

function drawPictures(pen: Pen, pictures: readonly SheetPicture[]): void {
  const cell = (TEXT_WIDTH - 20) / 2;
  for (let start = 0; start < pictures.length; start += 2) {
    let rowHeight = 0;
    for (const [column, picture] of pictures
      .slice(start, start + 2)
      .entries()) {
      const { image, photo } = picture;
      let width = cell;
      let height = image.height * (cell / image.width);
      if (height > cell) {
        width *= cell / height;
        height = cell;
      }
      rowHeight = Math.max(rowHeight, height);
      if (!pen.draw) continue;
      const x = PADDING + column * (cell + 20);
      pen.context.drawImage(image, x, pen.y, width, height);
      const caption = pictureCaption(photo);
      capOver(pen.context, x, pen.y, width, height, caption, 24);
    }
    pen.y += rowHeight + 18;
  }
}

function pictureCaption(photo: CruisePhoto): string {
  if (typeof photo.cap === 'string' && photo.cap) return photo.cap;
  const moment = (PHOTO_CTX[photo.ctx] ?? '').replace('📷 ', '');
  return `${moment} · ${fmtTime(new Date(photo.t))}`;
}

function drawSignature(
  pen: Pen,
  signature: HTMLImageElement | null,
  name: string | undefined,
): void {
  if (!signature) return;
  pen.y += 18;
  const title = `Signature${name ? ` · ${name}` : ''}`;
  pen.y += put(pen, [title], 32, 800, PADDING, pen.y, NAVY) + 8;
  const height = Math.min(
    220,
    signature.height * (TEXT_WIDTH / signature.width),
  );
  const width = signature.width * (height / signature.height);
  if (pen.draw) pen.context.drawImage(signature, PADDING, pen.y, width, height);
  pen.y += height;
}

function drawChecks(pen: Pen, sheet: SheetImageContent): void {
  for (const [position, list] of sheet.checks.entries()) {
    heading(pen, `${position || sheet.noNum ? '' : '3 · '}${list.name}`);
    for (const item of list.items) {
      const weight = item.ok ? 600 : 800;
      const text = `${item.ok ? '☑' : '☐'} ${item.label}`;
      const lines = wrap(pen, text, 30, weight, TEXT_WIDTH);
      const color = item.ok ? '#006b2d' : '#b00000';
      pen.y += put(pen, lines, 30, weight, PADDING, pen.y, color) + 4;
    }
  }
}
