import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { textOf } from '../../lib/format.ts';
import type {
  BoatPolar,
  OrcBoat,
  OrcCatalogue,
  Polar,
} from '../../model/polars.ts';
import {
  CRUISE_COEF,
  emptyPolar,
  orcBoat,
  orcYears,
  parsePolar,
  polarSpeed,
  polarToText,
  searchOrc,
} from '../../model/polars.ts';
import type { Boat } from '../../model/types.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { boatById, deliver, toast } from '../../state/index.ts';

import { RealPolars } from './RealPolars.tsx';
import { setBoatPolar } from './boatActions.ts';
import { boatPolarOf, polarDigest } from './polarDigest.ts';

let catalogue: Promise<OrcCatalogue> | null = null;

/**
 * The ORC catalogue, read once from the site (about 1 MB, not kept offline:
 * the polar chosen is kept in the boat).
 * @returns The catalogue.
 */
function orcCatalogue(): Promise<OrcCatalogue> {
  catalogue ??= fetch(`${import.meta.env.BASE_URL}polars/orc.json`)
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<OrcCatalogue>;
    })
    .catch((error: unknown) => {
      catalogue = null;
      throw error;
    });
  return catalogue;
}

/** Props of {@link BoatPolarButton}. */
interface BoatPolarButtonProps {
  boat: Boat;
  onOpen: () => void;
}

/**
 * Button « ⛵ Polaire » of a boat sheet.
 * @param props - Boat and action.
 * @returns The row.
 */
export function BoatPolarButton({ boat, onOpen }: BoatPolarButtonProps) {
  const tr = useTr();
  const kept = boatPolarOf(boat);
  return (
    <ButtonRow style={{ padding: '0 14px' }}>
      <Button
        className="btn no-navact"
        data-polar={boat.id}
        onClick={(event) => {
          event.preventDefault();
          buzz();
          onOpen();
        }}
      >
        {kept
          ? `${tr('⛵ Polaire')} : ${kept.label}`
          : tr('⛵ Polaire du bateau (pour le routage)')}
      </Button>
    </ButtonRow>
  );
}

/** Props of {@link BoatPolarScreen}. */
interface BoatPolarScreenProps {
  boatId: string;
  onBack: () => void;
}

/**
 * The polar of a boat: found in the ORC certificates, read from a file or
 * typed in its table, with the share the boat really makes.
 * @param props - Boat and way back.
 * @returns The screen content.
 */
export function BoatPolarScreen({ boatId, onBack }: BoatPolarScreenProps) {
  useSignals();
  const tr = useTr();
  const boat = boatById(boatId);
  const file = useRef<HTMLInputElement>(null);
  if (!boat) return null;
  const kept = boatPolarOf(boat);
  const name = boat.info.boat || 'Bateau';
  const keep = (
    polar: Polar,
    from: BoatPolar['from'],
    label: string,
    coef: number,
  ) => {
    setBoatPolar(boatId, {
      polar,
      from,
      label,
      coef,
      at: new Date().toISOString(),
    });
  };
  return (
    <>
      <PageBack
        label="◀ Le bateau"
        id="polBack"
        onClick={() => {
          buzz();
          onBack();
        }}
      >
        {tr('◀ Le bateau')}
      </PageBack>
      <PageTitle>{`⛵ ${name} : polaire`}</PageTitle>
      {kept ? (
        <KeptPolar
          key={`${kept.from}|${kept.label}|${kept.polar.twa.join(',')}|${kept.polar.tws.join(',')}`}
          boatId={boatId}
          kept={kept}
        />
      ) : (
        <HelpText>
          Aucune polaire pour ce bateau. Le routage en a besoin pour calculer la
          vitesse selon le vent : cherchez-la dans les certificats ORC, importez
          un fichier ou remplissez un tableau.
        </HelpText>
      )}
      <OrcSearch
        boat={boat}
        onTake={(found) => {
          keep(
            found.polar,
            'orc',
            `ORC · ${found.name}${orcYears(found) ? ` (${orcYears(found)})` : ''}`,
            CRUISE_COEF,
          );
          toast('Polaire ORC gardée dans le bateau');
        }}
      />
      <h2 className="sub-h">{tr('Autres façons')}</h2>
      <ButtonRow>
        <Button
          className="btn"
          id="polFileBtn"
          onClick={() => {
            buzz();
            file.current?.click();
          }}
        >
          {tr('📂 Importer un fichier (.pol, .csv, .txt)')}
        </Button>
        <Button
          className="btn"
          id="polHandBtn"
          onClick={() => {
            buzz();
            keep(emptyPolar(), 'hand', 'Saisie à la main', 1);
          }}
        >
          {tr('✏️ Tableau vide à remplir')}
        </Button>
      </ButtonRow>
      <input
        type="file"
        id="polFile"
        accept=".pol,.csv,.txt,text/plain,text/csv"
        hidden
        ref={file}
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = '';
          if (!chosen) return;
          void chosen.text().then((text) => {
            const read = parsePolar(text);
            if ('error' in read) {
              toast(`Fichier non lu : ${read.error}`);
              return;
            }
            keep(read, 'file', chosen.name, 1);
            toast('Polaire du fichier gardée dans le bateau');
          });
        }}
      />
      <RealPolars boat={boat} />
      <WhereToFind />
      {kept ? (
        <>
          <ButtonRow>
            <ArmedButton
              className="btn danger"
              id="polDrop"
              armedLabel="Toucher encore : retirer"
              onClick={buzz}
              onConfirm={() => {
                setBoatPolar(boatId, null);
                toast('Polaire retirée');
              }}
            >
              {tr('🗑 Retirer la polaire')}
            </ArmedButton>
          </ButtonRow>
          <ButtonRow>
            <Button
              className="btn"
              id="polExport"
              onClick={() => {
                buzz();
                void deliver(
                  polarToText(kept.polar),
                  `${slug(name)}-polaire.pol`,
                  'text/plain',
                );
              }}
            >
              {tr('📤 Partager la polaire (.pol)')}
            </Button>
          </ButtonRow>
        </>
      ) : null}
    </>
  );
}

function slug(text: string): string {
  return (
    text
      .normalize('NFD')
      .replaceAll(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replaceAll(/[^a-z\d]+/g, '-')
      .replaceAll(/^-|-$/g, '') || 'bateau'
  );
}

interface KeptPolarProps {
  boatId: string;
  kept: BoatPolar;
}

function KeptPolar({ boatId, kept }: KeptPolarProps) {
  const tr = useTr();
  const change = (next: Partial<BoatPolar>) => {
    setBoatPolar(boatId, { ...kept, ...next, at: new Date().toISOString() });
  };
  return (
    <div className="section pol-kept" id="polKept">
      <p className="pol-label">
        <b>{kept.label}</b>
      </p>
      <p className="pol-digest">{polarDigest(kept)}</p>
      <label className="pol-coef">
        {tr('Part de la polaire faite par le bateau')}{' '}
        <input
          type="number"
          id="polCoef"
          min={30}
          max={120}
          step={1}
          inputMode="numeric"
          defaultValue={Math.round(kept.coef * 100)}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (value >= 30 && value <= 120) change({ coef: value / 100 });
          }}
        />{' '}
        %
      </label>
      {kept.from === 'orc' ? (
        <HelpText>
          Une polaire de certificat ORC est celle d’un bateau de course : voiles
          neuves, équipage complet. En croisière, on en fait souvent 80 à 90 %
          (85 % par défaut).
        </HelpText>
      ) : null}
      <PolarTable polar={kept.polar} onChange={(polar) => change({ polar })} />
    </div>
  );
}

interface PolarTableProps {
  polar: Polar;
  onChange: (polar: Polar) => void;
}

function PolarTable({ polar, onChange }: PolarTableProps) {
  const tr = useTr();
  return (
    <div className="pol-wrap">
      <table className="pol-table" id="polTable">
        <thead>
          <tr>
            <th scope="col">{tr(String.raw`Angle \ vent (nd)`)}</th>
            {polar.tws.map((tws) => (
              <th key={tws} scope="col">
                {tws}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {polar.twa.map((twa, row) => (
            <tr key={twa}>
              <th scope="row">{`${twa}°`}</th>
              {polar.tws.map((tws, column) => (
                <td key={tws}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={0.1}
                    min={0}
                    aria-label={`${twa}° à ${tws} nd`}
                    defaultValue={polar.kn[row]?.[column] ?? 0}
                    onChange={(event) => {
                      const value = Number(
                        event.target.value.replace(',', '.'),
                      );
                      if (!Number.isFinite(value) || value < 0) return;
                      const kn = polar.kn.map((line) => [...line]);
                      const line = kn[row];
                      if (line) line[column] = value;
                      onChange({ ...polar, kn });
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{tr('Vitesse du bateau en nd')}</th>
            {polar.tws.map((tws) => (
              <th key={tws}>{tws}</th>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

interface OrcSearchProps {
  boat: Boat;
  onTake: (found: OrcBoat) => void;
}

type SearchState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'failed' }
  | { kind: 'found'; boats: OrcBoat[] };

function OrcSearch({ boat, onTake }: OrcSearchProps) {
  const tr = useTr();
  const [search, setSearch] = useState(() =>
    [
      textOf(boat.info.model),
      textOf(boat.info.year).match(/\b(?:19|20)\d{2}\b/)?.[0],
    ]
      .filter(Boolean)
      .join(' '),
  );
  const [found, setFound] = useState<SearchState>({ kind: 'idle' });
  const run = () => {
    buzz();
    setFound({ kind: 'busy' });
    orcCatalogue().then(
      (orc) => {
        setFound({
          kind: 'found',
          boats: searchOrc(orc, search, 20).map((row) => orcBoat(orc, row)),
        });
      },
      () => setFound({ kind: 'failed' }),
    );
  };
  return (
    <>
      <h2 className="sub-h">{tr('Trouver la polaire (certificats ORC)')}</h2>
      <form
        className="pol-search"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <input
          type="search"
          id="polSearch"
          placeholder={tr('Modèle et année : Hanse 325 2011')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button className="btn primary" id="polSearchBtn" type="submit">
          {tr('🔎 Chercher')}
        </Button>
      </form>
      {found.kind === 'busy' ? <HelpText>{tr('Recherche…')}</HelpText> : null}
      {found.kind === 'failed' ? (
        <HelpText>
          Les certificats ne se chargent pas : il faut du réseau pour les
          chercher (la polaire choisie reste ensuite dans le bateau, hors
          ligne).
        </HelpText>
      ) : null}
      {found.kind === 'found' && found.boats.length === 0 ? (
        <HelpText>
          Aucun certificat pour ce modèle. Essayez sans l’année, ou un bateau
          proche (même chantier, même longueur).
        </HelpText>
      ) : null}
      {found.kind === 'found' && found.boats.length > 0 ? (
        <ul className="pol-found" id="polFound">
          {found.boats.map((item) => (
            <li key={item.name}>
              <button
                type="button"
                className="btn pol-take"
                onClick={() => {
                  buzz();
                  onTake(item);
                  setFound({ kind: 'idle' });
                }}
              >
                <b>{item.name}</b>
                <small>
                  {[
                    orcYears(item),
                    `${item.certificates} certificat${item.certificates > 1 ? 's' : ''}`,
                    item.loa > 0
                      ? `${item.loa.toFixed(2).replace('.', ',')} m`
                      : '',
                    `${polarSpeed(item.polar, 90, 10).toFixed(1).replace('.', ',')} nd au travers par 10 nd`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function WhereToFind() {
  const tr = useTr();
  return (
    <details className="section pol-where" id="polWhere">
      <summary>{tr('Où trouver les polaires ?')}</summary>
      <ul>
        <li>
          {tr(
            'Certificats ORC : la recherche ci-dessus reprend les certificats publics (vitesses calculées par le VPP de l’ORC, de 6 à 20 nd de vent), réunis par',
          )}{' '}
          <a
            href="https://github.com/jieter/orc-data"
            target="_blank"
            rel="noreferrer"
          >
            orc-data
          </a>{' '}
          {tr('(licence MIT). Un certificat d’un bateau précis :')}{' '}
          <a
            href="https://data.orc.org/public/WPub.dll"
            target="_blank"
            rel="noreferrer"
          >
            data.orc.org
          </a>
          .
        </li>
        <li>
          {tr(
            'Le chantier ou l’architecte : la polaire de la brochure ou du manuel du propriétaire (Hanse, Dufour, Jeanneau, Bénéteau en donnent souvent).',
          )}
        </li>
        <li>
          {tr(
            'Votre voilerie : elle peut calculer une polaire avec vos voiles réelles (code 0, spi, génois…).',
          )}
        </li>
        <li>
          {tr(
            'Les logiciels de routage (qtVlm, OpenCPN, SailGrib, Expedition) : leurs fichiers .pol ou .csv s’importent ici tels quels.',
          )}
        </li>
        <li>
          {tr(
            'Vos navigations : NavIn construit la polaire réelle du bateau, voilure par voilure (section « Polaire réelle » ci-dessus).',
          )}
        </li>
      </ul>
    </details>
  );
}
