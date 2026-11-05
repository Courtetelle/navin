import { signal } from '@preact/signals-react';

/** What the depth alarm overlay shows. */
export interface DepthOverlayState {
  /** The overlay exists in the page (it is created once, at the first use). */
  mounted: boolean;
  on: boolean;
  danger: boolean;
  noFlash: boolean;
  test: boolean;
  /** `--da-col`. */
  color: string | null;
  /** `--da-op`. */
  opacity: string | null;
  /** `--da-per`. */
  period: string | null;
  title: string;
  subtitle: string;
}

/** State of `#depthAlarm`; once shown, its values stay until replaced, like legacy. */
export const depthOverlayState = signal<DepthOverlayState>({
  mounted: false,
  on: false,
  danger: false,
  noFlash: false,
  test: false,
  color: null,
  opacity: null,
  period: null,
  title: '',
  subtitle: '',
});
