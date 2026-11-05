import { HelpText } from '../../components/shared/HelpText.tsx';
import { ScaleLanguage } from '../../features/safety/ScaleLanguage.tsx';
import { useScaleEnglish } from '../../features/safety/useScaleEnglish.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { BEAUFORT_TBL } from '../../model/lists.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';

/**
 * Screen `beaufort` (legacy `VIEWS.beaufort`): the Beaufort scale, French or English.
 * @returns The screen content.
 */
export function BeaufortPage() {
  const english = useScaleEnglish();
  const tr = useTr();
  return (
    <>
      <PageBack
        label="◀ Listes"
        data-go="lists"
        onClick={() => {
          buzz();
          go('lists');
        }}
      >
        {tr('◀ Listes')}
      </PageBack>
      <h1>{tr(`🌬 ${english ? 'Beaufort scale' : 'Échelle de Beaufort'}`)}</h1>
      <ScaleLanguage />
      <table className="scale-tbl">
        <thead>
          <tr>
            <th>{tr('Force')}</th>
            <th>{tr(english ? 'Knots' : 'Nœuds')}</th>
            <th>{tr(english ? 'Description' : 'Appellation')}</th>
          </tr>
        </thead>
        <tbody>
          {BEAUFORT_TBL.map(([force, knots, nameFr, nameEn, seaFr, seaEn]) => (
            <tr key={force} className={`bf-${force}`}>
              <td className="sc-n">{force}</td>
              <td className="sc-kn">{tr(knots)}</td>
              <td>
                <b>{tr(english ? nameEn : nameFr)}</b>
                <small>{tr(english ? seaEn : seaFr)}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <HelpText>
        {english
          ? 'WMO scale. Wind rounded to the nearest knot. km/h = knots × 1.852.'
          : 'Échelle de l’OMM. Vent arrondi au nœud entier. km/h = nœuds × 1,852.'}
      </HelpText>
    </>
  );
}
