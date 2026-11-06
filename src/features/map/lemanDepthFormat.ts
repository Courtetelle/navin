/** Cells per side of a depth tile: 1 km at 2 m. */
export const DEPTH_TILE_CELLS = 500;
/** Metres per cell. */
export const DEPTH_CELL_M = 2;
/** Stored value per metre of depth. */
export const DEPTH_SCALE = 10;
/** Deepest water stored, in metres. */
export const DEPTH_MAX = 20;
/** Stored value of a cell deeper than {@link DEPTH_MAX}. */
export const DEPTH_DEEP = 254;
/** Stored value of a cell without data (land, or outside the survey). */
export const DEPTH_NONE = 255;
