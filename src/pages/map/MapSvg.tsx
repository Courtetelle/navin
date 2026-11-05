import type { MapDataResult } from '../../features/map/mapData.ts';
import { entryColor, segments } from '../../features/map/mapData.ts';
import { rad } from '../../lib/geo.ts';

interface Scaled {
  x: string;
  y: string;
}

/**
 * The track drawn without any background, when Leaflet cannot load (legacy `drawSvg`).
 * @param props - Line and entries of the period.
 * @returns The SVG, or nothing without position.
 */
export function MapSvg({ line, ents }: MapDataResult) {
  const all: Array<{ lat: number; lon: number }> = [...line];
  for (const entry of ents) all.push(entry.v.pos);
  if (all.length === 0) return null;
  let sum = 0;
  for (const point of all) sum += point.lat;
  const scale = Math.cos(rad(sum / all.length));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of all) {
    minX = Math.min(minX, point.lon * scale);
    maxX = Math.max(maxX, point.lon * scale);
    minY = Math.min(minY, -point.lat);
    maxY = Math.max(maxY, -point.lat);
  }
  const span = Math.max(maxX - minX, maxY - minY) || 0.01;
  const place = (lat: number, lon: number): Scaled => ({
    x: (((lon * scale - minX) / span) * 340 + 10).toFixed(1),
    y: (((-lat - minY) / span) * 340 + 10).toFixed(1),
  });
  const parts = segments(line).map((part) =>
    part
      .map(([lat, lon]) => {
        const { x, y } = place(lat, lon);
        return `${x},${y}`;
      })
      .join(' '),
  );
  return (
    <svg viewBox="0 0 360 360" className="map-svg">
      {parts.map((points) => (
        <polyline
          key={points}
          points={points}
          fill="none"
          stroke="#d00000"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      ))}
      {ents.map((entry) => {
        const { x, y } = place(entry.v.pos.lat, entry.v.pos.lon);
        return (
          <circle
            key={entry.id}
            cx={x}
            cy={y}
            r="6"
            fill={entryColor(entry)}
            stroke="#000"
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
}
