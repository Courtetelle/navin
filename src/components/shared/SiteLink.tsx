import { useState } from 'react';

import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { saveSiteLink, siteLink, toast } from '../../state/index.ts';

import { Button } from './Button.tsx';

/**
 * A link to another site, the same everywhere: a pill to touch with its
 * text, the address of the site written in full under it, and a ✏️ to
 * change both (emptied, NavIn's come back).
 * @param props - The link.
 * @param props.id - Its key, for the changes kept.
 * @param props.label - Its text by default.
 * @param props.url - Its address by default.
 * @returns The link.
 */
export function SiteLink({
  id,
  label,
  url,
}: {
  id: string;
  label: string;
  url: string;
}) {
  const tr = useTr();
  const [shown, setShown] = useState(() => siteLink(id, label, url));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(shown);
  if (editing) {
    return (
      <form
        className="site-link site-link-edit"
        onSubmit={(event) => {
          event.preventDefault();
          buzz();
          saveSiteLink(
            id,
            draft.label === label && draft.url === url
              ? { label: '', url: '' }
              : draft,
          );
          setShown(siteLink(id, label, url));
          setEditing(false);
          toast('Lien enregistré');
        }}
      >
        <label>
          <span>{tr('Texte de la pastille')}</span>
          <input
            className="text"
            value={draft.label}
            onChange={(event) =>
              setDraft({ ...draft, label: event.target.value })
            }
          />
        </label>
        <label>
          <span>{tr('Adresse du site')}</span>
          <input
            className="text"
            type="url"
            autoCapitalize="off"
            spellCheck={false}
            value={draft.url}
            onChange={(event) =>
              setDraft({ ...draft, url: event.target.value })
            }
          />
        </label>
        <div className="row c2">
          <Button
            type="button"
            className="btn"
            onClick={() => setEditing(false)}
          >
            {tr('Fermer')}
          </Button>
          <Button type="submit" className="btn primary">
            {tr('Enregistrer')}
          </Button>
        </div>
        <Button
          type="button"
          className="btn site-link-reset"
          onClick={() => setDraft({ label, url })}
        >
          {tr('Rétablir le lien de NavIn')}
        </Button>
      </form>
    );
  }
  return (
    <div className="site-link" data-site-link={id}>
      <div className="site-link-main">
        <a
          className="site-link-pill"
          href={shown.url}
          target="_blank"
          rel="noopener"
        >
          <span aria-hidden="true">↗</span> {shown.label}
        </a>
        <span className="site-link-url">{shown.url}</span>
      </div>
      <Button
        type="button"
        className="btn site-link-pen"
        aria-label={tr(`Modifier le lien : ${shown.label}`)}
        onClick={() => {
          buzz();
          setDraft(shown);
          setEditing(true);
        }}
      >
        ✏️
      </Button>
    </div>
  );
}
