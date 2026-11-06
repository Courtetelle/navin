import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';

const AIRDROP_START =
  'Sans Internet : les deux appareils échangent un fichier par ';
const AIRDROP_END =
  ' (Wi-Fi et Bluetooth, de proche en proche). Chaque côté garde toutes les entrées des deux, et pour le reste c’est la modification la plus récente qui gagne.';
const STEPS = [
  ['Sur l’appareil A : ', 'Envoyer', ', puis AirDrop vers l’appareil B.'],
  [
    'Sur B : touchez la notification AirDrop, puis « Enregistrer dans Fichiers ».',
  ],
  [
    'Sur B, dans l’appli : ',
    'Recevoir',
    ' et choisissez le fichier. B est à jour.',
  ],
  ['Pour que A soit aussi à jour : refaites la même chose de B vers A.'],
] as const;

/**
 * Explanation of the sync by AirDrop (legacy `backupHtml`).
 * @returns The two help texts.
 */
export function SyncHelp() {
  const tr = useTr();
  const help = (text: string) => tr(text, { help: true });
  const steps = STEPS.map((parts) => parts.map(help));
  return (
    <>
      <HelpText
        text={`${AIRDROP_START}AirDrop${AIRDROP_END}`}
        items={[`${help(AIRDROP_START)}${help('AirDrop')}${help(AIRDROP_END)}`]}
      >
        {help(AIRDROP_START)}
        <b>{help('AirDrop')}</b>
        {help(AIRDROP_END)}
      </HelpText>
      <HelpText
        as="ol"
        className="sync-steps"
        text={STEPS.map((parts) => parts.join('')).join(' ')}
        items={steps.map((parts) => parts.join(''))}
      >
        {steps.map(([start, bold, end]) => (
          <li key={start}>
            {start}
            {bold ? <b>{bold}</b> : null}
            {end}
          </li>
        ))}
      </HelpText>
    </>
  );
}
