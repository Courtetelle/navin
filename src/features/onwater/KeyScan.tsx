import jsQRModule from 'jsqr';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import type { KeyLinkId } from '../../state/index.ts';
import {
  KEY_LINKS,
  readKeyLink,
  saveKeyLink,
  toast,
} from '../../state/index.ts';

/** The decoder of jsQR, whichever way its CommonJS module is handed. */
const jsQR = ((jsQRModule as unknown as { default?: unknown }).default ??
  jsQRModule) as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => { data: string } | null;

/** Every network a key can come from: all read, the camera closes. */
const KEY_COUNT = Object.keys(KEY_LINKS).length;

/**
 * Which key a code holds.
 * @param text - The text of the code.
 * @returns The key, or null.
 */
function keyOf(text: string): KeyLinkId | null {
  try {
    return readKeyLink(new URL(text).hash)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * The words of the button.
 * @param all - Every key and the relay.
 * @param only - One key.
 * @returns The words.
 */
function label(all: boolean, only: KeyLinkId | undefined): string {
  if (all) return '📥 Importer les clés et relais disponibles';
  if (only === 'relay') return '📥 Importer l’adresse du relais';
  if (only === 'sync') return '📥 Importer la clé de synchronisation';
  return only
    ? `📥 Importer la clé ${KEY_LINKS[only].name}`
    : '📥 Importer une clé';
}

/** The camera image is looked at this often for a code. */
const LOOK_MS = 250;

/**
 * The camera of NavIn reads the QR code of a key shown by another device
 * (Paramétrages › Clés météos et compte relais › 📤 Partager la clé): the key is saved here at
 * once, in NavIn itself (on an iPhone, NavIn of the home screen does not
 * see what Safari keeps). No network is used.
 * @param props - What is read.
 * @param props.all - Every key and the relay, one code after the other.
 * @param props.only - Only this key (the button of its row).
 * @returns The button, or the camera while it reads.
 */
export function KeyScan({
  all = false,
  only,
}: {
  all?: boolean;
  only?: KeyLinkId;
}) {
  const [reading, setReading] = useState(false);
  const [read, setRead] = useState<string[]>([]);
  const seen = useRef<string[]>([]);
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
      // The button of a key reads only that key.
      const kind = keyOf(code.data);
      if (only && kind && kind !== only) {
        toast(
          `Ce code est la clé ${KEY_LINKS[kind].name}, pas la clé ${KEY_LINKS[only].name}`,
        );
        return;
      }
      const name = saveKeyLink(code.data);
      if (!name) {
        toast('Ce QR code ne contient pas de clé de NavIn');
        return;
      }
      if (!all) {
        buzz();
        toast(`Clé ${name} lue et enregistrée`);
        setReading(false);
        return;
      }
      // Every key, one code after the other: the camera stays open.
      if (seen.current.includes(name)) return;
      seen.current = [...seen.current, name];
      setRead(seen.current);
      buzz();
      toast(`Clé ${name} lue et enregistrée`);
      if (seen.current.length >= KEY_COUNT) setReading(false);
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
  }, [reading, all, only]);
  if (!reading) {
    return (
      <Button
        type="button"
        className="btn key-scan-open"
        onClick={() => {
          buzz();
          seen.current = [];
          setRead([]);
          setReading(true);
        }}
      >
        {label(all, only)}
        <small>
          {all
            ? 'NavIn range chaque clé et le relais à leur place'
            : 'l’appareil photo de NavIn lit le QR code d’un autre appareil'}
        </small>
      </Button>
    );
  }
  return (
    <div className="key-scan">
      <video ref={video} className="key-scan-video" playsInline muted />
      <p className="help">
        {all
          ? `Viser les codes de « 📤 Partager toutes les clés et le relais » sur l’autre appareil. Lues : ${read.length > 0 ? read.join(', ') : 'aucune encore'}.`
          : 'Viser le QR code affiché par « 📤 Partager la clé » sur l’autre appareil.'}
      </p>
      <Button
        type="button"
        className="btn"
        onClick={() => {
          buzz();
          setReading(false);
        }}
      >
        {all && read.length > 0 ? 'Terminer' : 'Annuler'}
      </Button>
    </div>
  );
}
