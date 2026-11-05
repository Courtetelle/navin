import { Fragment } from 'react';

import type { Cruise } from '../../../model/types.ts';
import { lastKnownPos } from '../../../state/index.ts';

import type { SosProcedure } from './external.ts';
import { NATO, SOS, VOCAB, sosContext } from './external.ts';

/**
 * Radio messages: each procedure with its DSC steps and script, then the
 * alphabet and the vocabulary.
 * @param props - Cruise.
 * @param props.cruise - Cruise printed.
 * @returns The page.
 */
export function RadioPage({ cruise }: { cruise: Cruise }) {
  return (
    <section className="pg">
      <h1>Messages radio / Radio messages</h1>
      <div className="cols">
        {Object.values(SOS).map((procedure) => (
          <RadioBlock
            key={procedure.title}
            procedure={procedure}
            cruise={cruise}
          />
        ))}
      </div>
      <h3>Alphabet</h3>
      <p>
        {Object.entries(NATO)
          .map(([key, word]) => `${key} ${word}`)
          .join(' · ')}
      </p>
      <h3>Vocabulaire</h3>
      <p>
        {VOCAB.map(([word, meaning]) => `${word} = ${meaning}`).join(' · ')}
      </p>
    </section>
  );
}

interface RadioBlockProps {
  procedure: SosProcedure;
  cruise: Cruise;
}

function RadioBlock({ procedure, cruise }: RadioBlockProps) {
  const context = sosContext(
    {
      info: cruise.info,
      crew: cruise.crew,
      position: lastKnownPos(),
      now: new Date(),
    },
    null,
  );
  const lines = procedure.script(context).filter(Boolean);
  return (
    <div className="blk">
      <h3>{`${procedure.title} · ${procedure.sub}`}</h3>
      <ol>
        {procedure.asn.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {lines.map((line) => {
        const [english, french] = line ?? [''];
        return (
          <p key={english}>
            <b>{english}</b>
            {french ? ' ' : null}
            {french ? <i>{french}</i> : null}
          </p>
        );
      })}
      {procedure.natures ? (
        <p>
          {'Nature : '}
          {procedure.natures.map(([label, english], position) => (
            <Fragment key={label}>
              {position > 0 ? ' · ' : null}
              {`${label} = `}
              <i>{english}</i>
            </Fragment>
          ))}
        </p>
      ) : null}
    </div>
  );
}
