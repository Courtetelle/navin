import type { TaskTemplate } from './types.ts';

/** Version shown in the app and written in backups and error records. */
export const APP_VERSION = 'v453';

/** Original aboard task rotation for a crew of eight (legacy `TASK_TPL_DEFAULT`). */
export const TASK_TPL_DEFAULT: Readonly<TaskTemplate> = {
  tasks: [
    { id: 'pdj', name: 'Petit déjeuner, vaisselle', n: 2 },
    { id: 'midi', name: 'Repas de midi, vaisselle', n: 2 },
    { id: 'soir', name: 'Repas du soir, vaisselle', n: 2 },
    {
      id: 'prop',
      name: 'Contrôle propreté',
      n: 1,
      desc: 'Rien d’inutile ne traîne dans le carré ni sur la table à carte. Cabines et WC tenus correctement ; faire les remarques nécessaires à l’équipage.',
    },
    {
      id: 'tech',
      name: 'Contrôle technique',
      n: 1,
      desc: 'Hublots, équipets, sécurité du gaz, ouverture et fermeture des vannes des WC.',
    },
  ],
  first: 'soir',
  last: 'pdj',
  end: 'Nettoyage du bateau : tout l’équipage',
  note: 'Pour les repas, les équipiers concernés (supervisés par le second ou le skipper) sont responsables du repas, de la vaisselle, de l’ordre et de la propreté de la cuisine et du carré. En fin de navigation, tout l’équipage participe au nettoyage du bateau.',
};

/** Days of the week, Sunday first (legacy `DOW_LONG`). */
export const DOW_LONG: readonly string[] = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];
