/**
 * Public API of the logbook domain.
 *
 * | legacy (app.js)                     | new export                                     |
 * | ----------------------------------- | ---------------------------------------------- |
 * | `compactForm(el, sections, data, onChange, flat)` | `<CompactForm sections data onChange flat />` |
 * | `flatFields(fields)`                | `flatFields` (model)                           |
 * | `carriedValues`, `addEntry`, `daysWithData`, `navForDay`, `navLabel` | same names (state) |
 * | `dayData(key)`                      | `ensureDay(key)`, `getDay(key)`, `updateDay` (state) |
 * | `currentDay`                        | `state.view.currentDay`                        |
 * | `getGps(btn, ok)`                   | `getGps(onBusy, onFix)`                        |
 * | `openSignature(title, onSave)`      | `<SignatureOverlay title onClose onSave />`    |
 * | `expParse`, `expState`              | same names                                     |
 * | `cycTxt(show, v, opts)`             | `cycleText`                                    |
 */
export { CompactForm } from './compact/CompactForm.tsx';
export type {
  CompactFormProps,
  CompactSection,
} from './compact/compactTypes.ts';
export { SignatureOverlay } from './compact/SignatureOverlay.tsx';
export type { SignatureOverlayProps } from './compact/SignatureOverlay.tsx';
export { expParse, expState } from './compact/expiry.ts';
export { cycleText } from './compact/fieldChange.ts';
export { getGps } from './gps.ts';
export { flatFields } from '../../model/field.ts';
export {
  addEntry,
  carriedValues,
  daysWithData,
  ensureDay,
  getDay,
  navForDay,
  navLabel,
  updateDay,
} from '../../state/index.ts';
