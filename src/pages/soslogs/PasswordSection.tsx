import { useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { MarqueeInput } from '../../features/logbook/index.ts';
import { sosHash } from '../../features/safety/sosHash.ts';
import { toastThenRedraw } from '../../features/safety/toastThenRedraw.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

/** Props of {@link PasswordSection}. */
export interface PasswordSectionProps {
  hasPassword: boolean;
  onRedraw: () => void;
}

/**
 * The password that protects the deletion of the logs (it does not encrypt them).
 * @param props - Current state and redraw.
 * @returns The folded details.
 */
export function PasswordSection({
  hasPassword,
  onRedraw,
}: PasswordSectionProps) {
  const tr = useTr();
  const previous = useRef<HTMLInputElement>(null);
  const next = useRef<HTMLInputElement>(null);
  const repeated = useRef<HTMLInputElement>(null);
  const save = async () => {
    const stored = store.get('ldb.sosPwd', '');
    if (stored && (await sosHash(previous.current?.value ?? '')) !== stored) {
      toast('⚠ Ancien mot de passe incorrect');
      return;
    }
    const password = next.current?.value ?? '';
    if (password.length < 4) {
      toast('Au moins 4 caractères');
      return;
    }
    if (password !== repeated.current?.value) {
      toast('Les deux mots de passe sont différents');
      return;
    }
    store.set('ldb.sosPwd', await sosHash(password));
    toastThenRedraw('Mot de passe enregistré', onRedraw);
  };
  return (
    <details className="section">
      <summary>{tr('🔑 Mot de passe d’effacement')}</summary>
      <div style={{ padding: '0 14px 12px' }}>
        {hasPassword ? (
          <>
            <HelpText>
              Un mot de passe est défini. Pour le changer, entrez l’ancien puis
              le nouveau.
            </HelpText>
            <MarqueeInput
              ref={previous}
              className="text"
              type="password"
              id="slOld"
              placeholder={tr.placeholder('Ancien mot de passe')}
              autoComplete="off"
            />
          </>
        ) : (
          <HelpText>
            Aucun mot de passe pour l’instant : il sera demandé au premier
            effacement, ou définissez-le ici.
          </HelpText>
        )}
        <MarqueeInput
          ref={next}
          className="text"
          type="password"
          id="slNew"
          placeholder={tr.placeholder('Nouveau mot de passe')}
          autoComplete="off"
        />
        <MarqueeInput
          ref={repeated}
          className="text"
          type="password"
          id="slNew2"
          placeholder={tr.placeholder('Répéter le nouveau')}
          autoComplete="off"
        />
        <Button
          className="btn big"
          id="slSet"
          onClick={() => {
            buzz();
            void save();
          }}
        >
          {tr(
            hasPassword ? 'Changer le mot de passe' : 'Définir le mot de passe',
          )}
        </Button>
        <HelpText>
          Le mot de passe protège contre un effacement par erreur sur ce
          téléphone. Il ne chiffre pas les logs.
        </HelpText>
      </div>
    </details>
  );
}
