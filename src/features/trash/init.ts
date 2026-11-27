import { noteRevived } from '../sync/index.ts';

import { watchTrash, whenRestored } from './trash.ts';

// What leaves a list goes to the Poubelle (Paramètres), 30 days; what comes
// back from it comes back on the other devices too.
whenRestored(noteRevived);
watchTrash();
