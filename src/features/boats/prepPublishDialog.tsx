import { createRoot } from 'react-dom/client';

import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import { state, toast } from '../../state/index.ts';

import { PrepPublishBox } from './PrepPublishBox.tsx';

/**
 * The « Partager » window of the report: layout, photos, then image or PDF
 * (legacy `prepPublishDialog`). It is appended to `<body>`, from any screen.
 * @param format - The format chosen with « Partager ».
 */
export function prepPublishDialog(format: ShareFormat = 'image'): void {
  if (!state.data.cruise.value) {
    toast('Choisissez d’abord le bateau');
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'ck-ask';
  document.body.append(overlay);
  const root = createRoot(overlay);
  const close = () => {
    root.unmount();
    overlay.remove();
  };
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  root.render(<PrepPublishBox format={format} onClose={close} />);
}
