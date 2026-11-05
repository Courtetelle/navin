/**
 * Public API of the data domain (legacy app.js 2536-3280).
 *
 * | legacy                                | export                                         |
 * | ------------------------------------- | ---------------------------------------------- |
 * | `printBook(ids)`                      | {@link printBook}                              |
 * | `applyIcon()`                         | {@link applyIcon} (boot hook, see `init.ts`)   |
 * | `fileName(suffix, ext)`               | {@link fileName} (state layer)                 |
 * | `claudeDownloads()`                   | {@link claudeDownloads} (state layer)          |
 * | `deliver(content, name, type)`        | {@link deliver} (state layer)                  |
 * | `VIEW_LABELS`                         | {@link VIEW_LABELS} (model)                    |
 * | `newType`, `newPurpose`, `nameDirty`  | `state.view.newType`, `newPurpose`, `nameDirty` |
 */
export { applyIcon } from './appIcon.ts';
export { printBook } from './book/printBook.tsx';
export { VIEW_LABELS } from '../../model/views.ts';
export { claudeDownloads, deliver, fileName } from '../../state/index.ts';
