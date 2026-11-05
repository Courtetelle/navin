import { useEffect, useState } from 'react';

import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import type { OfflineStatus } from '../../features/data/offline.ts';
import { offlineState } from '../../features/data/offline.ts';
import { useTr } from '../../i18n/useTr.ts';

/**
 * Is the app ready to work offline? (legacy section « Hors ligne »,
 * `offlineState`).
 * @returns The section.
 */
export function OfflineSection() {
  const tr = useTr();
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  useEffect(() => {
    let current = true;
    void offlineState().then((result) => {
      if (current) setStatus(result);
    });
    return () => {
      current = false;
    };
  }, []);
  return (
    <FoldSection title="✈︎ Hors ligne">
      <HelpText id="offState" text="Vérification…" keep>
        <StatusText status={status} tr={tr} />
      </HelpText>
    </FoldSection>
  );
}

interface StatusTextProps {
  status: OfflineStatus | null;
  tr: ReturnType<typeof useTr>;
}

function StatusText({ status, tr }: StatusTextProps) {
  const help = { help: true };
  if (!status) return tr('Vérification…', help);
  if (status.kind === 'unknown') {
    return tr('⚠️ Vérification impossible sur ce navigateur.', help);
  }
  if (status.kind === 'not-ready') {
    return tr(
      '⚠️ Pas encore prête hors ligne : ouvrez l’appli une fois avec du réseau, depuis son icône sur l’écran d’accueil, puis rouvrez-la.',
      help,
    );
  }
  const protectedStorage = status.persisted ? ' (stockage protégé)' : '';
  const tiles = status.tiles
    ? ` Carte : ${status.tiles} morceaux de carte déjà vus sont gardés.`
    : '';
  return (
    <>
      {tr('✅ ', help)}
      <b>{tr('Prête hors ligne', help)}</b>
      {tr(
        ` : l’appli fonctionne sans Internet, en mode avion. Les données restent dans cet appareil${protectedStorage}.${tiles}`,
        help,
      )}
      <br />
      {tr(
        'Internet ne sert qu’à la météo du modèle, aux fonds de carte pas encore vus et aux mises à jour de l’appli.',
        help,
      )}
    </>
  );
}
