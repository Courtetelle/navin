import { AboardFlow } from '../../features/onwater/aboard/AboardFlow.tsx';

/**
 * Screen `tasktpl`: the rotation template, editable even without an open cruise
 * (legacy `VIEWS.tasktpl`).
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function TasktplPage() {
  return <AboardFlow initial="edit" />;
}
