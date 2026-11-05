import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { useTr } from '../../i18n/useTr.ts';

const EXERCISES = [
  ['ch', '🆘 Exercice : large de Lausanne', 'Léman, eaux suisses'],
  ['fr', '🆘 Exercice : vers Meillerie', 'Léman, eaux françaises'],
  ['mer', '🆘 Exercice : large de Toulon', 'en mer'],
] as const;
const POSITIONS = [
  ['ch', '🧪 Simuler : large de Lausanne', 'eaux suisses'],
  ['fr', '🧪 Simuler : vers Meillerie', 'eaux françaises'],
  ['mer', '🧪 Simuler : large de Toulon', 'en mer'],
] as const;

/**
 * Exercises of the SOS button and simulated SOS positions. The buttons carry
 * `data-sosex` / `data-sossim`: the safety domain listens to them.
 * @returns The content of the section.
 */
export function SimulationSection() {
  const tr = useTr();
  return (
    <>
      <h3>{tr('🆘 Simulation complète du bouton SOS')}</h3>
      <p className="keep-help nav-hint">
        {tr(
          'Un exercice comme un vrai SOS pour se familiariser avec toutes ses fonctions : log, position figée, position qui bouge, Go To, numéros selon la zone, homme à la mer, fin de procédure. Aucun appel ni SMS ne part ; le log est marqué « 🧪 Exercice ».',
        )}
      </p>
      <ButtonRow className="row set-stack">
        {EXERCISES.map(([key, label, sub]) => (
          <Button key={key} type="button" className="btn big" data-sosex={key}>
            {tr(label)}
            <small>{tr(sub)}</small>
          </Button>
        ))}
      </ButtonRow>
      <h3>{tr('🆘 Simulation de la position SOS')}</h3>
      <p className="keep-help nav-hint">
        {tr(
          "Ouvre la page SOS avec une position simulée qui se déplace, sans procédure SOS ni log. Elle s'arrête en quittant la page.",
        )}
      </p>
      <ButtonRow className="row set-stack">
        {POSITIONS.map(([key, label, sub]) => (
          <Button key={key} type="button" className="btn big" data-sossim={key}>
            {tr(label)}
            <small>{tr(sub)}</small>
          </Button>
        ))}
      </ButtonRow>
    </>
  );
}
