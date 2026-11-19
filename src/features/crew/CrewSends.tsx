import { useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

import { blankPdf } from './blankPdf.tsx';
import { blankImport, blankSend } from './blankSheet.ts';
import { cvBlankText } from './cvBlank.ts';

/**
 * Under « Nouvelle fiche »: a blank card or a sailing CV sent to be filled
 * (text for a message or a mail, or a PDF), and the place where the answer
 * is pasted back, a card or a CV, read into the cards.
 * @returns The block.
 */
export function CrewSends() {
  const tr = useTr();
  const received = useRef<HTMLTextAreaElement>(null);
  return (
    <section className="crew-sends">
      <ButtonRow className="row c2">
        <Button
          className="btn big"
          data-lxx="blSend"
          onClick={() => {
            buzz();
            void blankSend();
          }}
        >
          {tr('✉️ Fiche à remplir')}
          <small>{tr('texte WhatsApp, Messages, mail')}</small>
        </Button>
        <Button
          className="btn big"
          data-lxx="blPdf"
          onClick={() => {
            buzz();
            blankPdf();
          }}
        >
          {tr('📄 Fiche vide')}
          <small>{tr('PDF à imprimer')}</small>
        </Button>
      </ButtonRow>
      <ButtonRow className="row">
        <Button
          className="btn big"
          data-lxx="cvSend"
          onClick={() => {
            buzz();
            void blankSend(cvBlankText());
          }}
        >
          {tr('✉️ CV nautique à remplir')}
          <small>{tr('texte pour un mail, relu ici au retour')}</small>
        </Button>
      </ButtonRow>
      <h2 className="sub-h">{tr('📥 Coller une fiche ou un CV reçu')}</h2>
      <textarea
        ref={received}
        className="text"
        id="lxBlIn"
        rows={4}
        placeholder={tr(
          'Collez ici le message complété (une fiche ou un CV nautique)',
        )}
      />
      <ButtonRow className="row">
        <Button
          className="btn big primary"
          data-lxx="blRead"
          onClick={() => {
            buzz();
            const text = received.current?.value ?? '';
            blankImport(text);
            if (received.current) received.current.value = '';
          }}
        >
          {tr('📥 Charger la fiche ou le CV')}
        </Button>
      </ButtonRow>
      <HelpText>
        Une fiche crée ou complète la fiche de la personne ; un CV va sur la
        fiche du même prénom et nom (créée au besoin). Coller un message à la
        fois.
      </HelpText>
    </section>
  );
}
