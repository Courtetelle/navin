import { textOf } from '../../lib/format.ts';
import { state, toast } from '../../state/index.ts';

import type { SignalKMessage } from './nmeaApply.ts';
import { applyNmeaSentence, applySignalK } from './nmeaApply.ts';
import { nmeaLink, nmeaRedraw } from './nmeaLive.ts';
import { parseNmeaSentence } from './nmeaParser.ts';

const RETRY_MS = 8000;

/**
 * Connect to the Signal K server of the boat over WebSocket; a web page cannot
 * read raw NMEA TCP or UDP streams, so a relay is needed (legacy `nmConnect`).
 * NMEA 0183 sentences received as text are understood too.
 */
export function nmeaConnect(): void {
  nmeaDisconnect(true);
  const url = textOf(state.preferences.settings.peek().nmeaUrl).trim();
  if (!url) {
    nmeaLink.status = 'err';
    nmeaLink.error = 'Indiquez d’abord l’adresse du serveur.';
    nmeaRedraw();
    return;
  }
  nmeaLink.on = true;
  nmeaLink.status = 'wait';
  nmeaLink.error = '';
  nmeaRedraw();
  const blockedInsecure =
    globalThis.location.protocol === 'https:' && /^ws:/i.test(url);
  let socket: WebSocket;
  try {
    socket = new WebSocket(url);
  } catch {
    nmeaLink.status = 'err';
    nmeaLink.error = blockedInsecure
      ? 'Le navigateur bloque une adresse ws:// depuis une appli sécurisée (https). Utilisez wss:// (voir étape 5).'
      : 'Adresse refusée par le navigateur : vérifiez-la.';
    nmeaLink.on = false;
    nmeaRedraw();
    return;
  }
  nmeaLink.socket = socket;
  socket.addEventListener('open', () => {
    nmeaLink.status = 'ok';
    nmeaLink.error = '';
    nmeaLink.messages = 0;
    nmeaRedraw();
    toast('📡 Instruments connectés');
  });
  socket.addEventListener('message', (event: MessageEvent<unknown>) => {
    receive(event.data);
  });
  socket.addEventListener('error', () => {
    nmeaLink.error = blockedInsecure
      ? 'Connexion bloquée : depuis une appli en https, il faut souvent wss:// (voir étape 5).'
      : 'Connexion impossible : téléphone sur le Wi-Fi du bateau ? adresse et port justes ?';
  });
  socket.addEventListener('close', () => closed(socket));
}

/**
 * Close the connection (legacy `nmDisconnect`).
 * @param keepOn - Keep the link marked as wanted (a reconnection follows).
 */
export function nmeaDisconnect(keepOn = false): void {
  clearTimeout(nmeaLink.retry);
  if (!keepOn) {
    nmeaLink.on = false;
    nmeaLink.status = 'off';
    nmeaLink.error = '';
  }
  const { socket } = nmeaLink;
  nmeaLink.socket = null;
  try {
    socket?.close();
  } catch {
    // Already closed.
  }
  nmeaRedraw();
}

function receive(data: unknown): void {
  nmeaLink.messages++;
  const text = typeof data === 'string' ? data : '';
  if (!text) return;
  if (text.startsWith('{')) {
    try {
      applySignalK(JSON.parse(text) as SignalKMessage);
    } catch {
      // Not valid JSON.
    }
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    applyNmeaSentence(parseNmeaSentence(line));
  }
}

function closed(socket: WebSocket): void {
  if (nmeaLink.socket !== socket) return;
  nmeaLink.socket = null;
  if (nmeaLink.status === 'ok') {
    nmeaLink.error = 'Connexion perdue, nouvel essai…';
  }
  nmeaLink.status = nmeaLink.on ? 'wait' : 'off';
  nmeaRedraw();
  if (nmeaLink.on) {
    clearTimeout(nmeaLink.retry);
    nmeaLink.retry = setTimeout(() => {
      if (nmeaLink.on) nmeaConnect();
    }, RETRY_MS);
  }
}
