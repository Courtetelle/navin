import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { LinkButton } from '../../components/shared/EditableLinks.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpPill, HelpText } from '../../components/shared/HelpText.tsx';
import { helpBubbleText } from '../../components/shared/helpRules.ts';
import { useIntroLead } from '../../components/shared/introLead.ts';
import { LEMAN_ARCGIS } from '../../features/map/constants.ts';
import { marksFly } from '../../features/map/longPress.ts';
import { showPlace } from '../../features/map/placeTarget.ts';
import { zoneDelete } from '../../features/map/zoneDownload.ts';
import type { Zone } from '../../features/map/zoneStore.ts';
import { zoneList } from '../../features/map/zoneStore.ts';
import { SwipeRow } from '../../features/prep/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { go } from '../../shell/router.ts';
import { state } from '../../state/index.ts';

import { LemanTools } from './LemanTools.tsx';
import { MapLayersSection } from './MapLayersSection.tsx';
import { OfflineMaps } from './OfflineMaps.tsx';

const HELP =
  'Importez un fichier de carte (.pmtiles) depuis Fichiers, kDrive ou Google Drive : il reste sur cet appareil et s’affiche sans réseau. Le fond de carte et les couches se choisissent ici.';

/**
 * Screen `cartes`: load the maps around me in one touch (legacy `VIEWS.cartes`).
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function CartesPage() {
  const [version, setVersion] = useState(0);
  return (
    <CartesContent
      key={version}
      onChange={() => setVersion((value) => value + 1)}
    />
  );
}

function CartesContent({ onChange }: { onChange: () => void }) {
  useSignals();
  const tr = useTr();
  const [zones] = useState(zoneList);
  const fresh = useIntroLead(state.view.currentView.value, 'Mes cartes');
  const help = tr(HELP, { help: true });
  return (
    <>
      <h1>
        {tr('Mes cartes')}
        <HelpPill inTitle text={helpBubbleText(help)} />
      </h1>
      <p className={fresh ? 'help help-pop help-lead' : 'help help-pop'}>
        {help}
      </p>
      <MapLayersSection />
      <OfflineMaps />
      <FoldSection title="🏔 Léman : données hors ligne">
        <LemanTools />
      </FoldSection>
      {zones.length > 0 ? (
        <section className="field">
          <h2>{tr('Anciennes zones')}</h2>
          <p className="help">
            {tr(
              'Elles peuvent ne pas contenir de vraie carte : supprimez-les.',
              {
                help: true,
              },
            )}
          </p>
          {zones.map((zone) => (
            <ZoneRow key={zone.id} zone={zone} onChange={onChange} />
          ))}
        </section>
      ) : null}
      <FoldSection title="🌐 Cartes en ligne">
        <HelpText nextIsRow>
          Réseau nécessaire, s’ouvrent dans le navigateur.
        </HelpText>
        <ButtonRow>
          <LinkButton
            className="btn big link-btn"
            href={LEMAN_ARCGIS}
            target="_blank"
            rel="noopener"
          >
            {tr('🌐 Carte ArcGIS du Léman')}
            <small>{tr('carte en ligne, réseau nécessaire')}</small>
          </LinkButton>
        </ButtonRow>
      </FoldSection>
    </>
  );
}

function ZoneRow({ zone, onChange }: { zone: Zone; onChange: () => void }) {
  const tr = useTr();
  const missing = zone.ko ? ` (${zone.ko} manquants)` : '';
  return (
    <SwipeRow
      id={zone.id}
      name={zone.name}
      onView={() => {
        marksFly.position = zone.center ?? [
          (zone.b.s + zone.b.n) / 2,
          (zone.b.w + zone.b.e) / 2,
        ];
        go('tracker');
      }}
      onDelete={(id) => {
        void zoneDelete(id).then(onChange);
      }}
    >
      <div className="cartes-z">
        <div>
          <b>{zone.name}</b>
          <small>
            {tr(
              `${fmtShortDate(new Date(zone.at))} · détail ${zone.zmax} · ${zone.ok || 0} morceaux${missing}`,
            )}
          </small>
        </div>
        <Button
          className="btn"
          data-cshow={zone.id}
          aria-label={`Voir ${zone.name} sur la carte`}
          onClick={() => {
            buzz();
            showPlace({
              name: zone.name,
              lat: (zone.b.s + zone.b.n) / 2,
              lon: (zone.b.w + zone.b.e) / 2,
            });
          }}
        >
          🗺
        </Button>
      </div>
    </SwipeRow>
  );
}
