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
  /**
   * Network of a measuring station outside Switzerland (`OpenWindMap`, `Météo-France`).
   * @default undefined
   */
  net?: string;
  /**
   * Station id in its network.
   * @default undefined
   */
  id?: string;
  /**
   * Station latitude.
   * @default undefined
   */
  lat?: number;
  /**
   * Station longitude.
   * @default undefined
   */
  lon?: number;
  /**
   * Air temperature in °C.
   * @default undefined
   */
  air?: number | null;
  /**
   * Sea-level pressure in hPa.
   * @default undefined
   */
  baro?: number | null;
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
  /** `'smn'` (MeteoSwiss), `'stations'` (other networks) or `'model'` (forecast). */
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
  /**
   * Networks of the stations read.
   * @default undefined
   */
  nets?: string[];
  /**
   * Radius searched for stations, in km.
   * @default undefined
   */
  radius?: number;
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
