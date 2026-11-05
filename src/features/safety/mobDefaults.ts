/** One step of a procedure: title, then details (may hold line breaks). */
export type MobStep = [string, string];

/** A section of a man-overboard procedure. */
export interface MobSection {
  title: string;
  steps: MobStep[];
  /** @default undefined */
  id?: string;
  /** @default undefined */
  intro?: string;
  /**
   * Option of the helmsman: only one such section is shown at a time.
   * @default undefined
   */
  allure?: boolean;
  [key: string]: unknown;
}

/** Procedures of one zone (`ldb.mob2`, `ldb.mob2mer`). */
export interface MobProcedure {
  /** @default undefined */
  real?: MobSection[];
  /** @default undefined */
  train?: MobSection[];
  /** @default undefined */
  recupAdded?: boolean;
  [key: string]: unknown;
}

/** Procedure kind: real incident or training. */
export type MobKind = 'real' | 'train';

const MOB_COMMON: MobStep[] = [
  ['Crier « Homme à la mer ! »', ''],
  [
    'Un, si possible deux équipiers pointent la personne',
    'Ils ne la quittent jamais des yeux et ne font que ça.',
  ],
  ['Lancer la bouée', 'Ou des objets flottants, tels que les coussins.'],
  [
    'Le barreur appuie immédiatement sur MOB',
    'Bouton MOB du GPS ou du traceur, pour enregistrer la position exacte.',
  ],
];
const MOB_ALERT: MobStep[] = [
  [
    'Si on la perd de vue, on alerte',
    'MAYDAY en mer ; 117 / 112 / 18 sur le Léman.',
  ],
];

/** Recovery and hypothermia sections, added once to stored procedures. */
export const MOB_RECUP: MobSection[] = [
  {
    id: 'recup3',
    title: 'Méthode d’urgence absolue : victime inconsciente ou épuisée',
    intro:
      'Le plan incliné ou la voile. Hisser une masse inerte de 80 kg mouillée par-dessus un franc-bord élevé est impossible à la seule force des bras. La technique du filet (ou de la voile d’avant) :',
    steps: [
      ['Affalez le génois ou utilisez une bâche ou un filet solide', ''],
      [
        'Fixez un côté au bastingage et jetez le reste à l’eau',
        'Pour former une poche sous-marine.',
      ],
      ['Glissez la victime dans cette poche', ''],
      [
        'Frappez l’autre extrémité de la voile sur une drisse et hissez au winch',
        'La voile s’enroule et fait remonter la victime le long de la coque comme dans un hamac, sans effort horizontal.',
      ],
    ],
  },
  {
    id: 'hypo',
    title: '⚠️ Règle d’or médicale : l’hypothermie',
    steps: [
      [
        'Allongez immédiatement la victime à l’horizontale',
        'Une fois la victime remontée, ne la forcez pas à se tenir debout. Le retour brutal du sang froid des extrémités vers le cœur (syndrome de l’hydrocution ou « afterdrop ») peut provoquer un arrêt cardiaque.',
      ],
    ],
  },
];

/** The original procedures (legacy `MOB_DEFAULT`). */
export const MOB_DEFAULT: Required<Pick<MobProcedure, MobKind>> = {
  real: [
    { title: 'Tout de suite', steps: MOB_COMMON },
    {
      title: 'Au près',
      allure: true,
      steps: [
        [
          'Virez de bord immédiatement sans toucher aux écoutes',
          'Tournez la barre pour faire passer le nez du bateau dans le lit du vent. Ne touchez ni à l’écoute de génois, ni à celle de la grand-voile.',
        ],
        [
          'Démarrez le moteur',
          'Lancez le moteur (au point mort) dès que le bateau traverse l’axe du vent.',
        ],
        [
          'Contrez à la barre',
          'Une fois le nez du bateau passé de l’autre côté du vent, poussez la barre à fond du côté où se trouve la grand-voile (barre sous le vent).',
        ],
        [
          'Le bateau est à la cape (arrêté)',
          'Le génois resté sur l’ancien bord se retrouve à contre. Le voilier se stabilise instantanément à l’arrêt, face ou trois-quarts au vent, et se met en dérive de sécurité très lente (1 nœud).',
        ],
        [
          'Affalage ou enroulage express',
          'Les voiles n’étant plus sous tension, vous pouvez enrouler le génois et affaler la grand-voile en toute sécurité, directement face au vent.',
        ],
        [
          'Route au moteur',
          'Vérifiez qu’aucun bout ne traîne à l’eau, remettez la barre au centre et embrayez la marche avant pour manœuvrer vers votre objectif.',
        ],
        [
          'Le brise-lame',
          'Présentez le côté du bateau (le franc-bord) à la victime. Le voilier fait écran contre les vagues et le vent, créant une zone d’eau calme pour faciliter la récupération.',
        ],
      ],
    },
    {
      title: 'Au portant (génois)',
      allure: true,
      steps: [
        [
          'Lofez immédiatement',
          'Tournez fermement la barre pour faire remonter le nez du bateau face au vent.',
        ],
        [
          'Ne touchez pas au génois',
          'Laissez la voile d’avant bordée. Elle va passer à contre dès que le bateau aura traversé l’axe du vent.',
        ],
        [
          'Mettez le moteur en route',
          'Profitez du moment où le bateau vire de bord pour démarrer le moteur (au point mort). Le moteur est prêt à être utilisé sans attendre.',
        ],
        [
          'Poussez et bloquez la barre',
          'Une fois le virement effectué, tournez la barre à fond du côté opposé (sous le vent).\n• Vent faible à modéré : barre à fond sous le vent (du même côté que la voile d’avant à contre), bloquée avec un bout ou le bloqueur de barre. Le bateau oscille gentiment et reste stable.\n• Vent fort, brise : le vent dans la grand-voile pousse fortement le bateau à lofer. Barre à fond, il risque de revirer dans l’autre sens (sur-capage) : ne braquez qu’à moitié ou aux deux tiers.\n• Grand-voile : choquez-la aux deux tiers. Elle ne doit pas trop propulser le bateau, seulement l’aider à garder son angle (environ 50° du vent).',
        ],
        [
          'Le bateau est stabilisé (à la cape)',
          'Le génois à contre et la barre se contrarient. Le voilier s’arrête instantanément et dérive très lentement.',
        ],
        [
          'Affalez les voiles si nécessaire',
          'Le bateau étant immobile et sécurisé, enroulez le génois et affalez la grand-voile sereinement.',
        ],
        [
          'Engagez la marche avant au moteur',
          'Assurez-vous qu’aucun cordage ne traîne dans l’eau, puis faites route au moteur vers votre objectif.',
        ],
      ],
    },
    {
      title: 'Au portant sous spi asymétrique',
      allure: true,
      intro:
        'Le but est de tuer la puissance de la voile instantanément sans que rien ne tombe à l’eau.',
      steps: [
        [
          'Le barreur abat en grand (plein vent arrière)',
          'Le bateau se met « plein cul ». La grand-voile, perpendiculaire au bateau, masque totalement le spi, qui se dégonfle d’un coup (déventé).',
        ],
        [
          'Larguez totalement et d’un coup la bosse d’amure (le point avant)',
          'Le spi ne tient plus que par son écoute et sa drisse. Il flotte comme un drapeau derrière la grand-voile, sans aucune force.',
        ],
        [
          'L’affalage express',
          'Un équipier, à la descente ou dans le cockpit, attrape l’écoute de spi et tire la voile à l’abri derrière la grand-voile pour la faire descendre directement dans le bateau. Le pianiste file la drisse à la demande, en veillant à ce que la voile ne touche pas l’eau.',
        ],
        [
          'Sécurisation des cordages',
          'Impératif absolu : ramassez toutes les écoutes et drisses qui traînent. Rien ne doit pendre à l’arrière ou sur les côtés, sous peine d’enrouler l’hélice.',
        ],
        ['Mise en route', 'Démarrez le moteur (au point mort).'],
        [
          'Enroulage du génois (si envoyé)',
          'Si vous aviez un génois en plus du spi, enroulez-le immédiatement.',
        ],
        [
          'Le demi-tour (manœuvre du bouton de chemise)',
          'Choquez la grand-voile en grand et affalez si possible.',
        ],
      ],
    },
    ...MOB_RECUP,
    { title: 'Si on la perd de vue', steps: MOB_ALERT },
  ],
  train: [
    { title: 'Tout de suite', steps: MOB_COMMON },
    {
      title: 'Manœuvre sous voile',
      steps: [
        ['Virer de bord ou empanner', ''],
        ['Lofer, virer foc à contre et continuer à abattre', ''],
        ['Passer sous le vent de la personne', ''],
        ['Empanner et remonter au près', ''],
        [
          'Attention à l’hélice',
          'Vérifier qu’aucun bout ne traîne dans l’eau avant d’embrayer.',
        ],
        ['Établir le contact', ''],
        ['Récupérer la personne', ''],
      ],
    },
    { title: 'Si on la perd de vue', steps: MOB_ALERT },
  ],
};

/** Labels of the two procedures. */
export const MOB_KINDS: Readonly<Record<MobKind, string>> = {
  real: '🚨 Cas réel',
  train: '🎓 Entraînement',
};
