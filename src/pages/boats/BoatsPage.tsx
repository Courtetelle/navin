import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useReadingMarquee } from '../../components/shared/useReadingMarquee.ts';
import { BoatCard } from '../../features/boats/BoatCard.tsx';
import { BoatVersions } from '../../features/boats/BoatVersions.tsx';
import { addBoat } from '../../features/boats/boatActions.ts';
import { boatsByNav } from '../../features/boats/navOrder.ts';
import { BoatFieldsEditor } from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PageValidate } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { useNavEdit } from '../../shell/navbar/useNavEdit.ts';
import type { PageProps } from '../../shell/pageTypes.ts';
import { boatById, toast } from '../../state/index.ts';

type BoatScreen =
  | { kind: 'list'; openId: string | null; version: number }
  | { kind: 'fields' | 'versions'; id: string };

/**
 * Screen `boats` (legacy `VIEWS.boats`): Mes bateaux, their label editor and
 * their previous versions, swapped inside the same screen.
 * @param props - Page props; `arg` is the id of the boat to open, or `{ fields: id }`.
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function BoatsPage({ arg }: PageProps) {
  const [screen, setScreen] = useState<BoatScreen>(() => {
    const fields = (arg as { fields?: string } | null)?.fields;
    if (fields) return { kind: 'fields', id: fields };
    return {
      kind: 'list',
      openId: typeof arg === 'string' ? arg : null,
      version: 0,
    };
  });
  // Saved boats open read-only: the pencil edits them until the green tick.
  const [editing, setEditing] = useState(false);
  const showList = (openId: string | null) => {
    setScreen((current) => ({
      kind: 'list',
      openId,
      version: current.kind === 'list' ? current.version + 1 : 0,
    }));
  };
  if (screen.kind !== 'list') {
    const close = () => showList(screen.id);
    return screen.kind === 'fields' ? (
      <BoatFieldsEditor boatId={screen.id} onDone={close} />
    ) : (
      <BoatVersions boatId={screen.id} onBack={close} />
    );
  }
  return (
    <BoatList
      key={screen.version}
      openId={screen.openId}
      fresh={screen.version === 0}
      reading={!editing}
      onEditing={setEditing}
      onShow={showList}
      onFields={(id) => setScreen({ kind: 'fields', id })}
      onVersions={(id) => setScreen({ kind: 'versions', id })}
    />
  );
}

interface BoatListProps {
  openId: string | null;
  fresh: boolean;
  reading: boolean;
  onEditing: (editing: boolean) => void;
  onShow: (openId: string | null) => void;
  onFields: (id: string) => void;
  onVersions: (id: string) => void;
}

function BoatList({
  openId,
  fresh,
  reading,
  onEditing,
  onShow,
  onFields,
  onVersions,
}: BoatListProps) {
  useSignals();
  const tr = useTr();
  const [opened, setOpened] = useState<ReadonlySet<string>>(
    () => new Set(openId ? [openId] : []),
  );
  const [order] = useState(() => boatsByNav().map((boat) => boat.id));
  const boats = order.flatMap((id) => boatById(id) ?? []);
  useNavFields(boats.some((boat) => opened.has(boat.id)));
  useNavEdit(reading, () => onEditing(true));
  const sheet = useRef<HTMLDivElement>(null);
  useReadingMarquee(reading, sheet);
  return (
    <>
      {reading ? null : (
        <PageValidate
          label="Valider"
          onClick={() => {
            onEditing(false);
            toast('Fiche du bateau validée');
          }}
          hidden
        >
          {tr('Valider')}
        </PageValidate>
      )}
      <PageTitle
        atTop={fresh}
        helps={[
          'Les données d’un bateau sont reprises à chaque sortie lacustre. Enregistrement automatique. 🗑 : le supprimer (avec confirmation).',
        ]}
      >
        Mes bateaux
      </PageTitle>
      <div
        ref={sheet}
        id="boatList"
        className={reading ? 'fiche-reading' : undefined}
      >
        {boats.map((boat) => (
          <BoatCard
            key={boat.id}
            boat={boat}
            open={boat.id === openId}
            reading={reading}
            onToggle={(open) => {
              setOpened((current) => {
                const next = new Set(current);
                if (open) next.add(boat.id);
                else next.delete(boat.id);
                return next;
              });
            }}
            onRefresh={() => onShow(boat.id)}
            onRemoved={() => onShow(null)}
            onFields={() => onFields(boat.id)}
            onVersions={() => onVersions(boat.id)}
          />
        ))}
      </div>
      <ButtonRow className="row b-addrow">
        <Button
          className="btn big primary"
          id="addBoat"
          onClick={() => {
            buzz();
            const id = addBoat();
            onEditing(true);
            onShow(id);
            setTimeout(() => focusBoatName(id), 100);
          }}
        >
          {tr('＋ Ajouter un bateau')}
        </Button>
      </ButtonRow>
    </>
  );
}

function focusBoatName(id: string): void {
  const name = document.querySelector<HTMLElement>(
    `[data-form="${CSS.escape(id)}"] [data-k="boat"]`,
  );
  name?.scrollIntoView({ block: 'center' });
  name?.focus();
}
