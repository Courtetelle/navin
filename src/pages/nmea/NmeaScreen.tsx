import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useMarquee } from '../../components/shared/useMarquee.ts';
import {
  nmeaConnect,
  nmeaDisconnect,
  nmeaImportFile,
  nmeaLinkView,
  nmeaRedraw,
} from '../../features/tracking/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { textOf } from '../../lib/format.ts';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { state, updateSettings } from '../../state/index.ts';

import { nmeaCells } from './nmeaCells.ts';

const STATUS_LABELS = {
  off: '⚪ Non connecté',
  wait: '🟠 Connexion en cours…',
  ok: '🟢 Connecté',
  err: '🔴 Erreur',
} as const;

const STEPS: ReadonlyArray<[string, string]> = [
  [
    'Le matériel à bord',
    'Il faut une passerelle NMEA Wi-Fi (boîtier relié aux instruments, ou traceur avec Wi-Fi) et un serveur Signal K. Certaines passerelles l’intègrent ; sinon un petit ordinateur Raspberry Pi avec OpenPlotter (gratuit) le fait.',
  ],
  [
    'Pourquoi Signal K',
    'Une appli web ne peut pas lire les flux NMEA bruts (TCP ou UDP, port 10110 ou 2000 par exemple). Signal K reçoit ces flux et les republie dans une forme que NavIn sait lire (WebSocket).',
  ],
  [
    'Se mettre sur le Wi-Fi du bateau',
    'Réglages du téléphone › Wi-Fi : choisissez le réseau du bateau (nom et mot de passe sur le boîtier ou dans son manuel). Ce réseau n’a souvent pas internet : c’est normal, les cartes hors ligne restent disponibles.',
  ],
  [
    'L’adresse du serveur',
    'Elle est affichée par le serveur Signal K (par exemple 192.168.1.10 ou 10.10.10.1). Adresse à saisir ci-dessus : ws://ADRESSE:3000/signalk/v1/stream?subscribe=all',
  ],
  [
    'Connexion sécurisée (souvent obligatoire)',
    'NavIn étant une appli sécurisée (https), Safari et Chrome bloquent souvent ws://. Dans Signal K, activez SSL (port 3443) ; ouvrez une fois https://ADRESSE:3443 dans le navigateur et acceptez le certificat ; puis saisissez wss://ADRESSE:3443/signalk/v1/stream?subscribe=all',
  ],
  [
    'Ce que NavIn reçoit',
    'Position, vitesse et cap du bateau remplacent le GPS du téléphone (carte et journal automatique). Le vent réel des instruments est ajouté aux entrées automatiques. Profondeur, vitesse surface et température de l’eau sont affichées ici.',
  ],
  [
    'Sans connexion directe',
    'Enregistrez le flux NMEA dans un fichier (traceur, OpenCPN, enregistreur Signal K) puis importez-le ci-dessous en fin de navigation, comme une trace GPX.',
  ],
];

/**
 * The boat instruments: connection, live values, instructions, file import.
 * @returns The screen content.
 */
export function NmeaScreen() {
  useSignals();
  const tr = useTr();
  useNavFields();
  const fileInput = useRef<HTMLInputElement>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  useMarquee(urlInput);
  useEffect(() => {
    const timer = setInterval(nmeaRedraw, 2000);
    return () => clearInterval(timer);
  }, []);
  const { on, status, messages, server, error } = nmeaLinkView.value;
  const cruise = state.data.cruise.value;
  return (
    <>
      <PageTitle>📡 Instruments du bateau</PageTitle>
      <section className="field nm-box">
        <div className="nm-status" id="nmStatus">
          <b>{tr(STATUS_LABELS[status])}</b>
          {status === 'ok' ? (
            <small>{`${messages} messages${server ? ` · ${server}` : ''}`}</small>
          ) : null}
          {error ? <small className="nm-err">{tr(error)}</small> : null}
        </div>
        <label className="cf">
          <span>{tr('Adresse du serveur Signal K')}</span>
          <input
            ref={urlInput}
            className="text"
            id="nmUrl"
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            placeholder="wss://192.168.1.10:3443/signalk/v1/stream?subscribe=all"
            defaultValue={textOf(state.preferences.settings.peek().nmeaUrl)}
            onInput={(event) => {
              const url = event.currentTarget.value.trim();
              updateSettings((settings) => {
                settings.nmeaUrl = url;
              });
            }}
          />
        </label>
        <ButtonRow className="row">
          <Button
            type="button"
            className="btn big primary"
            id="nmGo"
            onClick={() => {
              buzz();
              if (on) nmeaDisconnect();
              else nmeaConnect();
            }}
          >
            {tr(on ? '⏹ Déconnecter' : '📡 Se connecter')}
          </Button>
        </ButtonRow>
        <div className="nm-live" id="nmLive">
          {nmeaCells().map(([label, value]) => (
            <div key={label}>
              <small>{tr(label)}</small>
              <b>{value}</b>
            </div>
          ))}
        </div>
      </section>
      <h2 className="sub-h">{tr('Mode d’emploi')}</h2>
      <ol className="nm-steps">
        {STEPS.map(([title, text]) => (
          <li key={title}>
            <b>{tr(title)}</b>
            <p className="nm-txt">{tr(text)}</p>
          </li>
        ))}
      </ol>
      <h2 className="sub-h">{tr('Importer un fichier NMEA')}</h2>
      <HelpText nextIsRow>
        Fichier NMEA 0183 enregistré à bord (.nmea, .log, .txt). NavIn crée les
        entrées comme pour une trace GPX : départ, arrivée, changements de cap,
        vent réel des instruments.
      </HelpText>
      <ButtonRow className="row">
        <Button
          type="button"
          className="btn big"
          id="nmFileBtn"
          onClick={() => fileInput.current?.click()}
        >
          {tr('📂 Importer un fichier NMEA')}
          <small>
            {tr(
              cruise
                ? 'dans la navigation en cours'
                : 'ouvrez d’abord une navigation',
            )}
          </small>
        </Button>
      </ButtonRow>
      <input
        ref={fileInput}
        type="file"
        id="nmFile"
        accept=".nmea,.log,.txt,.n0183,text/plain"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void nmeaImportFile(file);
        }}
      />
    </>
  );
}
