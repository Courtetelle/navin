import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import type { SiteAccount } from '../../state/index.ts';
import { saveAccount, siteAccount, toast } from '../../state/index.ts';

/**
 * Copy a text of the account, to paste it on the site.
 * @param text - The text.
 * @param said - The bubble once copied.
 */
function copy(text: string, said: string): void {
  buzz();
  navigator.clipboard
    .writeText(text)
    .then(() => toast(said))
    .catch(() => toast('Copie impossible sur cet appareil'));
}

/**
 * Under a key: a button that opens a small form, the exact address of the
 * site (a link to open it), the user name and the password, so as never to
 * forget them. Kept on the device and in the full backup.
 * @param props - The site.
 * @param props.id - Its key in the accounts (`mf`…).
 * @param props.name - Its name, as written on the button.
 * @param props.url - Its address by default.
 * @param props.mailOnly - A site without account (AEMET): only the address
 *   of the mail the key is sent to, no user name nor password.
 * @returns The button, or the form.
 */
export function KeyAccount({
  id,
  name,
  url,
  mailOnly = false,
}: {
  id: string;
  name: string;
  url: string;
  mailOnly?: boolean;
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
        {mailOnly ? `📧 Demande de clé ${name}` : `🔐 Compte ${name}`}
        <small>
          {mailOnly
            ? 'lien du site, adresse mail qui reçoit la clé (pas de compte)'
            : 'lien du site, nom d’utilisateur, mot de passe'}
        </small>
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
        toast(
          mailOnly
            ? `Demande de clé ${name} enregistrée`
            : `Compte ${name} enregistré`,
        );
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
          onClick={() => {
            // A page cannot fill the fields of another site: the password
            // waits in the clipboard, to paste in its field there.
            if (account.password) {
              copy(
                account.password,
                'Mot de passe copié : le coller dans le champ du site',
              );
            }
          }}
        >
          ↗ Ouvrir {account.url.replace(/^https?:\/\//, '')}
        </a>
      ) : null}
      {!mailOnly && (account.user || account.password) ? (
        <div className="row c2 key-account-copy">
          <Button
            type="button"
            className="btn"
            disabled={!account.user}
            onClick={() => copy(account.user, 'Nom d’utilisateur copié')}
          >
            📋 Copier l’utilisateur
          </Button>
          <Button
            type="button"
            className="btn"
            disabled={!account.password}
            onClick={() => copy(account.password, 'Mot de passe copié')}
          >
            📋 Copier le mot de passe
          </Button>
        </div>
      ) : null}
      <label>
        <span>
          {mailOnly ? 'Adresse mail qui reçoit la clé' : 'Nom d’utilisateur'}
        </span>
        <input
          className="text"
          type={mailOnly ? 'email' : 'text'}
          autoComplete={mailOnly ? 'email' : 'username'}
          autoCapitalize="off"
          spellCheck={false}
          value={account.user}
          onChange={(event) => field('user', event.target.value)}
        />
      </label>
      {mailOnly ? null : (
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
      )}
      <p className="help">
        {mailOnly
          ? `${name} n’a ni compte ni mot de passe : la clé arrive par mail à cette adresse ; pour la retrouver, chercher ce mail. Gardé sur cet appareil et dans la sauvegarde complète ; jamais dans un partage.`
          : 'Gardé sur cet appareil et dans la sauvegarde complète, pour le retrouver sur un autre appareil ; jamais dans un partage. Ouvrir le site copie le mot de passe, prêt à coller. Pour une connexion automatique, l’enregistrer une fois dans les mots de passe de l’appareil quand le site le propose.'}
      </p>
      <div className="row c2">
        <Button type="button" className="btn" onClick={() => setOpen(false)}>
          Fermer
        </Button>
        <Button type="submit" className="btn primary">
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
