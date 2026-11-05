/** A point of a stroke, in fractions of the signature area. */
export type SignaturePoint = readonly [number, number];
/** The points of one pen stroke. */
export type SignatureStroke = SignaturePoint[];

/**
 * Paint the strokes on a white background.
 * @param context - 2D context.
 * @param width - Width to paint.
 * @param height - Height to paint.
 * @param lineWidth - Pen width.
 * @param strokes - Strokes.
 */
export function drawStrokes(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  lineWidth: number,
  strokes: readonly SignatureStroke[],
): void {
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#000';
  context.lineWidth = lineWidth;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const stroke of strokes) {
    const first = stroke[0];
    if (!first) continue;
    context.beginPath();
    context.moveTo(first[0] * width, first[1] * height);
    for (let index = 1; index < stroke.length; index++) {
      const point = stroke[index] as SignaturePoint;
      context.lineTo(point[0] * width, point[1] * height);
    }
    if (stroke.length === 1) {
      context.lineTo(first[0] * width + 0.1, first[1] * height);
    }
    context.stroke();
  }
}

/** Box around a signature, in pixels of the full image. */
export interface SignatureCrop {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Scale keeping the image at most 900 px wide. */
  scale: number;
}

/**
 * Crop of a signature: its strokes with a 24 px margin, at most 900 px wide.
 * @param strokes - Strokes.
 * @param width - Full image width.
 * @param height - Full image height.
 * @returns The box and the scale.
 */
export function signatureCrop(
  strokes: readonly SignatureStroke[],
  width: number,
  height: number,
): SignatureCrop {
  const margin = 24;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const stroke of strokes) {
    for (const [fractionX, fractionY] of stroke) {
      left = Math.min(left, fractionX * width);
      right = Math.max(right, fractionX * width);
      top = Math.min(top, fractionY * height);
      bottom = Math.max(bottom, fractionY * height);
    }
  }
  const x0 = Math.max(0, left - margin);
  const y0 = Math.max(0, top - margin);
  const x1 = Math.min(width, right + margin);
  const y1 = Math.min(height, bottom + margin);
  return { x0, y0, x1, y1, scale: Math.min(1, 900 / (x1 - x0)) };
}

/**
 * Image of a signature: cropped, sharp when printed, light in memory.
 * @param strokes - Strokes (at least one).
 * @param width - Width of the signature area on screen.
 * @param height - Height of the signature area on screen.
 * @returns PNG data URL.
 */
export function signatureImage(
  strokes: readonly SignatureStroke[],
  width: number,
  height: number,
): string {
  const full = document.createElement('canvas');
  full.width = Math.round(width * 2);
  full.height = Math.round(height * 2);
  const fullContext = full.getContext('2d') as CanvasRenderingContext2D;
  drawStrokes(fullContext, full.width, full.height, 8, strokes);
  const { x0, y0, x1, y1, scale } = signatureCrop(
    strokes,
    full.width,
    full.height,
  );
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round((x1 - x0) * scale));
  out.height = Math.max(1, Math.round((y1 - y0) * scale));
  const context = out.getContext('2d') as CanvasRenderingContext2D;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, out.width, out.height);
  context.drawImage(
    full,
    x0,
    y0,
    x1 - x0,
    y1 - y0,
    0,
    0,
    out.width,
    out.height,
  );
  return out.toDataURL('image/png');
}
