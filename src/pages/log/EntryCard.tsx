import { useSignals } from '@preact/signals-react/runtime';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { TzTime } from '../../components/shared/TzTime.tsx';
import { deleteEntry, editEntry } from '../../features/logbook/entryActions.ts';
import type { CruisePhoto } from '../../features/onwater/index.ts';
import { PhotoStrip } from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtValue } from '../../lib/fieldFormat.ts';
import { textOf } from '../../lib/format.ts';
import type { Entry } from '../../model/types.ts';
import { activeFields, isLake, state } from '../../state/index.ts';

/**
 * One entry of the journal, with its values and actions.
 * @param props - The entry.
 * @param props.entry - Entry.
 * @returns The `article.entry`.
 */
export function EntryCard({ entry }: { entry: Entry }) {
  useSignals();
  const tr = useTr();
  const date = new Date(entry.t);
  const rows: Array<{ key: string; label: string; text: string }> = [];
  for (const field of activeFields()) {
    if (field.key === 't' || field.key === 'evt') continue;
    const text = fmtValue(field, entry.v[field.key]);
    if (text) rows.push({ key: field.key, label: field.label ?? '', text });
  }
  const photoIds = entry.v.photos as readonly string[] | undefined;
  const allPhotos = (state.data.cruise.value?.photos ?? []) as CruisePhoto[];
  const photos = allPhotos.filter((photo) => photoIds?.includes(photo.id));
  const source = weatherSource(entry);
  return (
    <article className={entry.auto ? 'entry auto' : 'entry'} data-id={entry.id}>
      <div className="when">
        <span>
          <TzTime date={date} />
          {entry.auto ? (
            <>
              {' '}
              <span className="tag">{tr('auto')}</span>
            </>
          ) : null}
        </span>
        <span>{tr(entry.v.evt ? entry.v.evt.join(', ') : '')}</span>
      </div>
      <dl>
        {rows.map((row) => [
          <dt key={`${row.key}-label`}>{tr(row.label)}</dt>,
          <dd key={row.key}>{tr(row.text.replace('  ', '\n'))}</dd>,
        ])}
      </dl>
      {photoIds ? <PhotoStrip photos={photos} /> : null}
      {entry.windSrc ? (
        <HelpText>Vent : enregistré dans la trace</HelpText>
      ) : null}
      {source ? <HelpText>{source}</HelpText> : null}
      <div className="actions">
        <Button
          className="btn"
          data-act="edit"
          onClick={() => {
            buzz();
            editEntry(entry);
          }}
        >
          {tr(entry.auto ? 'Compléter' : 'Modifier')}
        </Button>
        <ArmedButton
          className="btn danger"
          data-act="del"
          armedLabel="Confirmer ?"
          onClick={buzz}
          onConfirm={() => deleteEntry(entry.id)}
        >
          {tr('Supprimer')}
        </ArmedButton>
      </div>
    </article>
  );
}

function weatherSource(entry: Entry): string {
  if (!entry.wx && !entry.v.wxSrc) return '';
  const lake = isLake();
  let subject = lake ? 'Vent et baro' : 'Vent, mer et baro';
  if (entry.windSrc) subject = lake ? 'Baro' : 'Mer et baro';
  return `${subject} : ${textOf(entry.v.wxSrc) || 'modèle météo Open-Meteo'}`;
}
