import { useTr } from '../../i18n/useTr.ts';

/** Props of the installation steps. */
interface InstallStepsProps {
  /** Address of the site. */
  host: string;
}

/**
 * Installation steps on an iPhone or iPad.
 * @param props - Address of the site.
 * @returns The list items.
 */
export function IosSteps({ host }: InstallStepsProps) {
  const tr = useTr();
  return (
    <>
      <li>
        {tr('Ouvrez ')}
        <b>{tr('Safari')}</b>
        {tr(' (l’installation se fait depuis Safari) et allez sur ')}
        <b>{host}</b>
        {tr('.')}
      </li>
      <li>
        {tr('Touchez le bouton ')}
        <b>{tr('Partager')}</b> <span className="kbd">⬆︎</span>
        {tr(
          ' (carré avec une flèche vers le haut), en bas de l’écran (en haut sur iPad).',
        )}
      </li>
      <li>
        {tr('Faites défiler la liste vers le bas et touchez ')}
        <b>{tr('« Sur l’écran d’accueil »')}</b>
        {tr(
          '. Si vous ne la voyez pas, touchez « Plus » ou « Modifier les actions ». Ne touchez pas « Options » (Automatique, PDF, Archive web) : ces réglages servent à envoyer la page, pas à l’installer.',
        )}
      </li>
      <li>
        {tr(
          'Vérifiez que l’aperçu montre bien l’icône NavIn (fond bleu marine), laissez « Ouvrir comme app web » activé, puis touchez ',
        )}
        <b>{tr('« Ajouter »')}</b>
        {tr(' en haut à droite.')}
      </li>
      <li>
        {tr(
          `Si l’aperçu montre encore un simple « L » : l’iPhone garde en mémoire une ancienne icône ratée. Allez dans Réglages › Apps › Safari › Avancé › Données des sites web, cherchez le nom du site, supprimez ${host}, puis rouvrez le site dans Safari et recommencez à l’étape 2. Vérifiez aussi que Safari n’est pas en navigation privée.`,
        )}
      </li>
      <li>
        {tr('Ouvrez désormais l’appli par sa ')}
        <b>{tr('nouvelle icône')}</b>
        {tr(
          ' sur l’écran d’accueil, et non par Safari : sur iPhone, les données de l’appli installée sont séparées de celles de Safari.',
        )}
      </li>
      <li>
        {tr('Au premier point GPS, touchez ')}
        <b>{tr('« Autoriser lorsque l’app est active »')}</b>
        {tr('.')}
      </li>
    </>
  );
}

/**
 * Installation steps on Android.
 * @param props - Address of the site.
 * @returns The list items.
 */
export function AndroidSteps({ host }: InstallStepsProps) {
  const tr = useTr();
  return (
    <>
      <li>
        {tr('Ouvrez ')}
        <b>{tr('Chrome')}</b>
        {tr(' et allez sur ')}
        <b>{host}</b>
        {tr('.')}
      </li>
      <li>
        {tr('Touchez le menu ')}
        <span className="kbd">⋮</span>
        {tr(' en haut à droite.')}
      </li>
      <li>
        {tr('Touchez ')}
        <b>{tr('« Installer l’application »')}</b>
        {tr(' (ou « Ajouter à l’écran d’accueil » puis « Installer »).')}
      </li>
      <li>
        {tr('Confirmez avec ')}
        <b>{tr('« Installer »')}</b>
        {tr(
          ' : l’icône « NavIn » apparaît sur l’écran d’accueil et dans la liste des applis.',
        )}
      </li>
      <li>{tr('Ouvrez l’appli par son icône.')}</li>
      <li>
        {tr('Au premier point GPS, touchez ')}
        <b>{tr('« Lorsque vous utilisez l’application »')}</b>
        {tr(' pour autoriser la localisation.')}
      </li>
    </>
  );
}
