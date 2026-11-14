import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

import type { SiteAccount } from './keyAccounts.ts';
import { saveAccount, siteAccount } from './keyAccounts.ts';

/**
 * Under a key: a button that opens a small form, the exact address of the
 * site (a link to open it), the user name and the password, so as never to
 * forget them. Kept on this device only.
 * @param props - The site.
 * @param props.id - Its key in the accounts (`mf`…).
 * @param props.name - Its name, as written on the button.
 * @param props.url - Its address by default.
 * @returns The button, or the form.
 */
export function KeyAccount({
  id,
  name,
  url,
}: {
  id: string;
  name: string;
  url: string;
}) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(() => siteAccount(id, url));
  const [shown, setShown] = useState(false);
  if (!open) {
    return (
      <Button
        type="button"
        className="btn key-account-open"
        data-key-account={id}
        onClick={() => {
          buzz();
          setAccount(siteAccount(id, url));
          setOpen(true);
        }}
      >
        🔐 Compte {name}
        <small>lien du site, nom d’utilisateur, mot de passe</small>
      </Button>
    );
  }
  const field = (key: keyof SiteAccount, value: string) => {
    setAccount((before) => ({ ...before, [key]: value }));
  };
  return (
    <form
      className="key-account"
      onSubmit={(event) => {
        event.preventDefault();
        buzz();
        saveAccount(id, account);
        setOpen(false);
        toast(`Compte ${name} gardé sur cet appareil`);
      }}
    >
      <label>
        <span>Lien du site</span>
        <input
          className="text"
          type="url"
          autoCapitalize="off"
          spellCheck={false}
          value={account.url}
          onChange={(event) => field('url', event.target.value)}
        />
      </label>
      {account.url ? (
        <a
          className="key-account-link"
          href={account.url}
          target="_blank"
          rel="noreferrer"
        >
          ↗ Ouvrir {account.url.replace(/^https?:\/\//, '')}
        </a>
      ) : null}
      <label>
        <span>Nom d’utilisateur</span>
        <input
          className="text"
          type="text"
          autoComplete="username"
          autoCapitalize="off"
          spellCheck={false}
          value={account.user}
          onChange={(event) => field('user', event.target.value)}
        />
      </label>
      <label>
        <span>Mot de passe</span>
        <span className="key-account-pass">
          <input
            className="text"
            type={shown ? 'text' : 'password'}
            autoComplete="current-password"
            autoCapitalize="off"
            spellCheck={false}
            value={account.password}
            onChange={(event) => field('password', event.target.value)}
          />
          <Button
            type="button"
            className="btn"
            aria-label={
              shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
            }
            onClick={() => setShown((value) => !value)}
          >
            {shown ? '🙈' : '👁'}
          </Button>
        </span>
      </label>
      <p className="help">
        Gardé sur cet appareil seulement : jamais dans une sauvegarde, une
        synchronisation ou un partage.
      </p>
      <div className="row c2">
        <Button type="button" className="btn" onClick={() => setOpen(false)}>
          Annuler
        </Button>
        <Button type="submit" className="btn primary">
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
