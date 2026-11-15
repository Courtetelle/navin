import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import { KEY_GUIDES, keyGuide, saveGuide, toast } from '../../state/index.ts';

/**
 * Under a key: where to find it on its site, step by step. The ✏️ changes
 * the steps (the menus of a site change); emptied, they come back to those
 * of NavIn. The steps go in the full backup.
 * @param props - The site.
 * @param props.id - Its key in the guides (`mf`…).
 * @param props.name - Its name.
 * @returns The guide.
 */
export function KeyGuide({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => keyGuide(id));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (!open) {
    return (
      <Button
        type="button"
        className="btn key-guide-open"
        data-key-guide={id}
        onClick={() => {
          buzz();
          setText(keyGuide(id));
          setOpen(true);
        }}
      >
        📋 Où trouver la clé {name}
        <small>pas à pas sur le site</small>
      </Button>
    );
  }
  return (
    <div className="key-guide">
      <div className="key-guide-head">
        <b>📋 Où trouver la clé {name}</b>
        {editing ? null : (
          <Button
            type="button"
            className="btn key-guide-pen"
            aria-label={`Modifier les étapes de la clé ${name}`}
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
            rows={8}
            value={draft}
            aria-label={`Étapes de la clé ${name}`}
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
                saveGuide(id, draft);
                setText(keyGuide(id));
                setEditing(false);
                toast(`Étapes de la clé ${name} enregistrées`);
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
          {text === KEY_GUIDES[id] ? null : (
            <p className="help">Étapes modifiées par vous.</p>
          )}
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
        </>
      )}
    </div>
  );
}
