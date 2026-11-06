import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { LinkButton } from '../../components/shared/EditableLinks.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpPill, HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { helpBubbleText } from '../../components/shared/helpRules.ts';
import { useIntroLead } from '../../components/shared/introLead.ts';
import { LEMAN_ARCGIS } from '../../features/map/constants.ts';
import { zoneDelete } from '../../features/map/zoneDownload.ts';
import type { Zone } from '../../features/map/zoneStore.ts';
import { mapRadius, zoneList } from '../../features/map/zoneStore.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { go } from '../../shell/router.ts';
import { state, toast } from '../../state/index.ts';

import { useCartesDownload } from './useCartesDownload.ts';

const BEFORE =
  'Un appui charge le plan OpenStreetMap et le balisage OpenSeaMap dans un rayon de ';
const AFTER =
  ' autour de vous. Elles restent ensuite sur l’appareil, sans réseau. Rayon réglable dans la roue dentée. Wi-Fi conseillé. OpenSeaMap ne remplace pas une carte marine officielle.';

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
  const km = mapRadius();
  const [zones] = useState(zoneList);
  const fresh = useIntroLead(state.view.currentView.value, 'Mes cartes');
  const download = useCartesDownload(km, onChange);
  const before = tr(BEFORE, { help: true });
  const radius = tr(`${km} km`, { help: true });
  const after = tr(AFTER, { help: true });
  return (
    <>
      <h1>
        {tr('Mes cartes')}
        <HelpPill inTitle text={helpBubbleText(`${before}${radius}${after}`)} />
      </h1>
      <p className={fresh ? 'help help-pop help-lead' : 'help help-pop'}>
        {before}
        <b>{radius}</b>
        {after}
      </p>
      <ButtonRow>
        <Button
          className="btn big primary"
          id="cartesGo"
          disabled={download.disabled}
          onClick={download.start}
        >
          {download.progress ?? tr('⬇ Charger les cartes autour de moi')}
          <small>
            {download.progress
              ? tr('laissez l’appli ouverte')
              : tr(`rayon ${km} km`)}
          </small>
        </Button>
      </ButtonRow>
      <HelpText id="cartesState">{download.status}</HelpText>
      <FoldSection title="Cartes enregistrées">
        {zones.length > 0 ? (
          zones.map((zone) => (
            <ZoneRow key={zone.id} zone={zone} onChange={onChange} />
          ))
        ) : (
          <p className="help">
            {tr('Aucune carte chargée pour l’instant.', { help: true })}
          </p>
        )}
      </FoldSection>
      <ButtonRow>
        <Button
          className="btn"
          data-go="zones"
          onClick={() => {
            buzz();
            go('zones');
          }}
        >
          {tr('✋ Choisir une zone à la main sur la carte')}
        </Button>
      </ButtonRow>
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
    <div className="cartes-z">
      <div>
        <b>{zone.name}</b>
        <small>
          {tr(
            `${fmtShortDate(new Date(zone.at))} · détail ${zone.zmax} · ${zone.ok || 0} morceaux${missing}`,
          )}
        </small>
      </div>
      <HoldDeleteButton
        className="btn danger"
        data-cdel={zone.id}
        onDelete={() => {
          void zoneDelete(zone.id).then(() => {
            toast('Carte supprimée de l’appareil');
            onChange();
          });
        }}
      >
        🗑
      </HoldDeleteButton>
    </div>
  );
}
