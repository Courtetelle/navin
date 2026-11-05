/** One wind reading: a station or a forecast model. */
export interface WindReading {
  name: string;
  /** Epoch milliseconds. */
  t: number;
  /** Mean wind in knots. */
  avg: number;
  /** Gusts in knots. */
  gust: number | null;
  /** Direction in degrees. */
  dir: number | null;
  /**
   * Distance of the station in km.
   * @default undefined
   */
  km?: number;
  /**
   * Forecast model id.
   * @default undefined
   */
  model?: string;
}

/** Sea state from the marine model. */
export interface SeaState {
  /** Wave height in metres. */
  waveH: number;
  /** Douglas degree. */
  douglas: number;
}

/** Context of a wind check. */
export interface WindMeta extends Partial<SeaState> {
  /** Readings compared. */
  n: number;
  /** `'smn'` (stations) or `'model'`. */
  src: string;
  /**
   * Region of the model.
   * @default undefined
   */
  region?: string;
  /**
   * Knots added to the thresholds' reading.
   * @default undefined
   */
  bias?: number;
  /**
   * Model names.
   * @default undefined
   */
  names?: string[];
}

/** The last wind check, kept in `day.windWatch` (legacy `windWatchLast`). */
export interface WindWatch extends WindMeta {
  /** Epoch milliseconds of the check. */
  at: number;
  /** Strongest reading. */
  top: WindReading;
  basis: string;
}

/** Last signal given (legacy `windLast`). */
export interface WindSignal {
  level: number;
  /** Epoch milliseconds. */
  at: number;
}
