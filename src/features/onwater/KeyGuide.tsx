import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import type { GuidePart } from '../../state/index.ts';
import { KEY_GUIDES, keyGuide, saveGuide, toast } from '../../state/index.ts';

const PART_TITLES: Readonly<Record<GuidePart, string>> = {
  first: '1ʳᵉ fois : créer le compte',
  again: 'Ensuite : avec compte et mot de passe, aller chercher la clé',
};

/**
 * One part of the guide, its steps and its ✏️: emptied, the steps come back
 * to those of NavIn.
 * @param props - The site and the part.
 * @param props.id - The site.
 * @param props.name - Its name.
 * @param props.part - The first time, or each time after.
 * @returns The part.
 */
function GuidePartBlock({
  id,
  name,
  part,
}: {
  id: string;
  name: string;
  part: GuidePart;
}) {
  const [text, setText] = useState(() => keyGuide(id, part));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const title = PART_TITLES[part];
  return (
    <section className="key-guide-part" data-guide-part={part}>
      <div className="key-guide-head">
        <b>{title}</b>
        {editing ? null : (
          <Button
            type="button"
            className="btn key-guide-pen"
            aria-label={`Modifier : ${title} (${name})`}
            onClick={() => {
              buzz();
              setDraft(text);
              setEditing(true);
            }}
          >
            ✏️
          </Button>
        )}
      </div>
      {editing ? (
        <>
          <textarea
            className="text key-guide-text"
            rows={9}
            value={draft}
            aria-label={`${title} (${name})`}
            onChange={(event) => setDraft(event.target.value)}
          />
          <p className="help">
            Une étape par ligne. Tout effacer redonne les étapes de NavIn.
          </p>
          <div className="row c2">
            <Button
              type="button"
              className="btn"
              onClick={() => setEditing(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              className="btn primary"
              onClick={() => {
                buzz();
                saveGuide(id, part, draft);
                setText(keyGuide(id, part));
                setEditing(false);
                toast(`Étapes enregistrées (${name})`);
              }}
            >
              Enregistrer
            </Button>
          </div>
        </>
      ) : (
        <>
          <ol className="key-guide-steps">
            {text
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, index) => (
                // eslint-disable-next-line react/no-array-index-key -- the steps are plain lines
                <li key={index}>{line.replace(/^\d+[.)]\s*/u, '')}</li>
              ))}
          </ol>
          {text === KEY_GUIDES[id]?.[part] ? null : (
            <p className="help">Étapes modifiées par vous.</p>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Under a key: where to find it on its site, step by step, in two parts:
 * the first time (the account, the subscription), then each time after
 * (logged in, the path to the key). Each part has its ✏️; the steps go in
 * the full backup.
 * @param props - The site.
 * @param props.id - Its key in the guides (`mf`…).
 * @param props.name - Its name.
 * @returns The guide.
 */
export function KeyGuide({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button
        type="button"
        className="btn key-guide-open"
        data-key-guide={id}
        onClick={() => {
          buzz();
          setOpen(true);
        }}
      >
        📋 Où trouver la clé {name}
        <small>pas à pas : la 1ʳᵉ fois, puis les fois suivantes</small>
      </Button>
    );
  }
  return (
    <div className="key-guide">
      <b className="key-guide-title">📋 Où trouver la clé {name}</b>
      <GuidePartBlock id={id} name={name} part="first" />
      <GuidePartBlock id={id} name={name} part="again" />
      <Button
        type="button"
        className="btn"
        onClick={() => {
          buzz();
          setOpen(false);
        }}
      >
        Fermer
      </Button>
    </div>
  );
}
