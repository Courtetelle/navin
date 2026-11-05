import { HelpText } from '../../components/shared/HelpText.tsx';
import { ScaleLanguage } from '../../features/safety/ScaleLanguage.tsx';
import { useScaleEnglish } from '../../features/safety/useScaleEnglish.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { DOUGLAS, DOUGLAS_EN } from '../../model/lists.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';

/**
 * Screen `douglas` (legacy `VIEWS.douglas`): the Douglas sea scale, French or English.
 * @returns The screen content.
 */
export function DouglasPage() {
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
      <h1>
        {tr(`🌊 ${english ? 'Douglas sea scale' : 'Échelle de Douglas'}`)}
      </h1>
      <ScaleLanguage />
      <table className="scale-tbl">
        <thead>
          <tr>
            <th>{tr('Code')}</th>
            <th>{tr(english ? 'Wave height' : 'Hauteur')}</th>
            <th>{tr(english ? 'Sea state' : 'État de la mer')}</th>
          </tr>
        </thead>
        <tbody>
          {DOUGLAS.map(([code, name, height], index) => (
            <tr key={code}>
              <td className="sc-n">{code}</td>
              <td className="sc-kn">
                {tr(english ? heightInEnglish(height) : height)}
              </td>
              <td>
                <b>
                  {tr(
                    english
                      ? (DOUGLAS_EN[index] as string)
                      : `${name.charAt(0).toUpperCase()}${name.slice(1)}`,
                  )}
                </b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <HelpText>
        {english
          ? 'WMO sea state code (table 3700). Significant wave height.'
          : 'Code de l’état de la mer de l’OMM (table 3700), termes des bulletins Météo-France. Hauteur des vagues significatives.'}
      </HelpText>
    </>
  );
}

function heightInEnglish(height: string): string {
  return height
    .replaceAll(' à ', ' to ')
    .replace('plus de', 'over')
    .replaceAll(',', '.');
}
