import jsQRModule from 'jsqr';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import { saveKeyLink, toast } from '../../state/index.ts';

/** The decoder of jsQR, whichever way its CommonJS module is handed. */
const jsQR = ((jsQRModule as unknown as { default?: unknown }).default ??
  jsQRModule) as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => { data: string } | null;

/** The camera image is looked at this often for a code. */
const LOOK_MS = 250;

/**
 * The camera of NavIn reads the QR code of a key shown by another device
 * (Réglages › Clés météo › 📤 Partager la clé): the key is saved here at
 * once, in NavIn itself (on an iPhone, NavIn of the home screen does not
 * see what Safari keeps). No network is used.
 * @returns The button, or the camera while it reads.
 */
export function KeyScan() {
  const [reading, setReading] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!reading) return undefined;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const look = () => {
      const shown = video.current;
      if (!shown || !context || shown.videoWidth === 0) return;
      // A smaller image is read faster, the code stays readable.
      const scale = Math.min(1, 720 / shown.videoWidth);
      canvas.width = Math.round(shown.videoWidth * scale);
      canvas.height = Math.round(shown.videoHeight * scale);
      context.drawImage(shown, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height);
      if (!code?.data) return;
      const name = saveKeyLink(code.data);
      if (!name) {
        toast('Ce QR code ne contient pas de clé de NavIn');
        return;
      }
      buzz();
      toast(`Clé ${name} lue et enregistrée`);
      setReading(false);
    };
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((found) => {
        if (closed) {
          for (const track of found.getTracks()) track.stop();
          return;
        }
        stream = found;
        const shown = video.current;
        if (!shown) return;
        shown.srcObject = found;
        void shown.play();
        timer = setInterval(look, LOOK_MS);
      })
      .catch(() => {
        toast('Appareil photo refusé ou absent : l’autoriser pour NavIn');
        setReading(false);
      });
    return () => {
      closed = true;
      clearInterval(timer);
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [reading]);
  if (!reading) {
    return (
      <Button
        type="button"
        className="btn key-scan-open"
        onClick={() => {
          buzz();
          setReading(true);
        }}
      >
        📥 Importer une clé
        <small>
          l’appareil photo de NavIn lit le QR code d’un autre appareil
        </small>
      </Button>
    );
  }
  return (
    <div className="key-scan">
      <video ref={video} className="key-scan-video" playsInline muted />
      <p className="help">
        Viser le QR code affiché par « 📤 Partager la clé » sur l’autre
        appareil.
      </p>
      <Button
        type="button"
        className="btn"
        onClick={() => {
          buzz();
          setReading(false);
        }}
      >
        Annuler
      </Button>
    </div>
  );
}
