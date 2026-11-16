import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { SiteLogo } from '../../components/shared/SiteLogo.tsx';
import { SwipeRow } from '../../features/prep/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz, openLink } from '../../lib/dom.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import {
  hideSiteLink,
  restoreSiteLinks,
  saveSiteLink,
  siteDef,
  siteLinksVersion,
  sitesShown,
  toast,
} from '../../state/index.ts';

/**
 * Screen `sites` (data › Sites Internet): every site NavIn links to, one
 * band each with the text of its button, its full address and where it
 * stands. Swiped to the left: ✏️ Modifier (the text and the address) or
 * 🗑 Effacer (its button goes; « Rétablir » brings it back). The only place
 * the addresses show and change.
 * @returns The screen content.
 */
export function SitesPage() {
  useSignals();
  const tr = useTr();
  const [editing, setEditing] = useState<string | null>(null);
  const sites = siteLinksVersion.value >= 0 ? sitesShown() : [];
  const shown = sites.filter((site) => !site.hidden);
  const gone = sites.length - shown.length;
  return (
    <>
      <PageBack
        label="◀ data"
        data-go="more"
        onClick={() => {
          buzz();
          go('more');
        }}
      >
        {tr('◀ data')}
      </PageBack>
      <PageTitle
        helps={[
          'Glisser une bande vers la gauche : ✏️ Modifier le texte du bouton ou l’adresse, 🗑 Effacer (appui long). Toucher une bande ouvre le site.',
        ]}
      >
        🌐 Sites Internet
      </PageTitle>
      <div className="sites-list">
        {shown.map((site) => (
          <SwipeRow
            key={site.id}
            id={site.id}
            name={site.label}
            onView={() => {
              buzz();
              setEditing(site.id);
            }}
            viewAs={{ icon: '✏️', label: 'Modifier' }}
            onDelete={(id) => {
              hideSiteLink(id);
              if (editing === id) setEditing(null);
            }}
          >
            {editing === site.id ? (
              <SiteEdit
                id={site.id}
                label={site.label}
                url={site.url}
                onClose={() => setEditing(null)}
              />
            ) : (
              <button
                type="button"
                className="section site-band"
                data-site={site.id}
                aria-label={tr(`${site.label} : ouvrir le site`)}
                onClick={() => {
                  buzz();
                  openLink(site.url);
                }}
              >
                <SiteLogo />
                <span className="site-band-text">
                  <b>{tr(site.label)}</b>
                  <span className="site-band-url">{site.url}</span>
                  <small>{tr(site.where)}</small>
                </span>
              </button>
            )}
          </SwipeRow>
        ))}
      </div>
      {gone > 0 ? (
        <ButtonRow>
          <Button
            className="btn"
            data-sites="restore"
            onClick={() => {
              buzz();
              restoreSiteLinks();
              toast('Sites rétablis');
            }}
          >
            {tr(
              `↺ Rétablir ${gone > 1 ? `les ${gone} sites effacés` : 'le site effacé'}`,
            )}
          </Button>
        </ButtonRow>
      ) : null}
    </>
  );
}

/**
 * The text of the button and the address of a site, changed.
 * @param props - The site.
 * @param props.id - Its key.
 * @param props.label - Its text now.
 * @param props.url - Its address now.
 * @param props.onClose - Closes the form.
 * @returns The form.
 */
function SiteEdit({
  id,
  label,
  url,
  onClose,
}: {
  id: string;
  label: string;
  url: string;
  onClose: () => void;
}) {
  const tr = useTr();
  const [draft, setDraft] = useState({ label, url });
  const site = siteDef(id);
  return (
    <form
      className="section site-link-edit"
      onSubmit={(event) => {
        event.preventDefault();
        buzz();
        const same =
          draft.label.trim() === site?.label && draft.url.trim() === site.url;
        saveSiteLink(id, same ? { label: '', url: '' } : draft);
        toast('Site enregistré');
        onClose();
      }}
    >
      <label>
        <span>{tr('Texte du bouton')}</span>
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
          onChange={(event) => setDraft({ ...draft, url: event.target.value })}
        />
      </label>
      <div className="row c2">
        <Button type="button" className="btn" onClick={onClose}>
          {tr('Fermer')}
        </Button>
        <Button type="submit" className="btn primary">
          {tr('Enregistrer')}
        </Button>
      </div>
      {site ? (
        <Button
          type="button"
          className="btn site-link-reset"
          onClick={() => setDraft({ label: site.label, url: site.url })}
        >
          {tr('Rétablir le texte et l’adresse de NavIn')}
        </Button>
      ) : null}
    </form>
  );
}
