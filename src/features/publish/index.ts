/**
 * Publish domain: the single « 📤 Publier » window that replaces every print and
 * export, the list print block, the image cards and the A4 print holder.
 *
 * | Legacy (nav.js)                          | New export                                                 |
 * | ---------------------------------------- | ---------------------------------------------------------- |
 * | `LX_THEMES`                              | `LX_THEMES` (`[id, label]` pairs)                          |
 * | `cardsPng(sd)`                           | `cardsPng(document: CardsDocument): Promise<Blob>`         |
 * | `window.lxOpen(k, only)`                 | `openListPublish(kind: ListKind, only?: string): void`     |
 * | `window.lxTheme(k)`                      | `listTheme(kind: ListKind): LxTheme`                       |
 * | `window.pubModal(sub, html, onClick, head)` | `<PubModal sub head pubBox onClose>…</PubModal>`        |
 * | `attach` (row added under each list)     | `<ListPublishRow kind="people" />`                         |
 * | holder + style + title + afterprint      | `printInHolder({ className, content, title, delay, css })` |
 *
 * ## `<ListPublishRow kind />`: under a data list
 *
 * Replaces the nav.js:676 observer. Renders `div.row.ck-pub-row.lx-pub.no-print.row-stack >
 * button.btn.big.ck-pub.act-plain` (« 📤 Publier » + `small` « image ou PDF », translated, through
 * `ButtonRow`) and opens the window on tap. It renders
 * nothing when the list has nothing to publish. Place it as the **last child of `#view`, or just
 * before a direct child `.page-end`** (delete zones stay at the very bottom). Render it only in
 * these screens and states (legacy `attach`, keyed on the current view, never for `boats`):
 *
 * | kind      | view      | render it when…                                    |
 * | --------- | --------- | -------------------------------------------------- |
 * | `people`  | `people`  | a `[data-fiche]` button is on screen               |
 * | `crews`   | `crews`   | a `[data-cs]` element is on screen                 |
 * | `traces`  | `traces`  | `#trkList` is on screen                            |
 * | `marks`   | `marks`   | `#mkList` is on screen                             |
 * | `ckbases` | `ckbases` | a `[data-base]` element is on screen               |
 * | `soslogs` | `soslogs` | always                                             |
 *
 * ## `openListPublish(kind, only?)`: the window itself
 *
 * Call it from a page button (it needs no component on the page, the window is a portal on
 * `<body>`). With `only`, that item alone stays checked: boats (`openListPublish('boats', boat.id)`
 * for `data-bpub`), crew sheet (`openListPublish('people', id)` for `#fImg`), SOS logs
 * (`openListPublish('soslogs', id)` for `data-share`).
 *
 * ## `<PubModal>`: other sends (crew list, boat dossier, face framing)
 *
 * Replaces `pubModal(...)`: render it conditionally from your page, the content is yours.
 *
 * ```tsx
 * const [open, setOpen] = useState(false);
 * {open ? (
 *   <PubModal sub="Liste d’équipage" onClose={() => setOpen(false)}>
 *     <div className="cp-in">…</div>
 *   </PubModal>
 * ) : null}
 * ```
 *
 * Renders in a portal on `<body>`: `div.ck-ask.lx-modal > div.ck-ask-box.pub-box` with `p` (head,
 * default « 📤 Publier »), `p.help.lx-modal-sub` (when `sub`), your children, then
 * `div.row > button.btn` « Fermer ». A tap on the overlay closes, every button inside buzzes.
 * `pubBox={false}` is legacy `classList.remove('pub-box')` (face framing, `head="🙂 Vignette du visage"`).
 * The legacy `onClick(button, overlay)` becomes plain `onClick` on your buttons; `overlay.remove()`
 * becomes your own `setOpen(false)`.
 *
 * ## `cardsPng(document)` and `listTheme(kind)`
 *
 * `cardsPng({ title, kicker, sub, theme, sections, photos, photosTitle, avatar, avatarRect })`
 * returns the PNG blob. A row is `[label, value, photos?]`, `photos` being `{ url, cap }` drawn under
 * the row. `shareBoatDossier` passes `theme: listTheme('boats')`.
 *
 * ## `printInHolder(options)`: every A4 print
 *
 * Replaces the block repeated by `printBook`, `printCrewList`, `printBoatDossier`, `blankPdf`,
 * `prepReportPrint`: appends `div.<className>` with your React `content` to `<body>`, adds the
 * print stylesheet to `<head>` (`css`, default `PRINT_CSS_A4_PORTRAIT`), sets `document.title`,
 * calls `window.print()` after `delay` ms and removes everything at `afterprint`.
 * `removeStale: true` first removes old `.lx-print` holders (`prepReportPrint`).
 */
export { cardsPng } from './cardsPng.ts';
export { ListPublishRow } from './ListPublishRow.tsx';
export type { ListPublishRowProps } from './ListPublishRow.tsx';
export { printInHolder } from './printHolder.tsx';
export type { PrintInHolderOptions } from './printHolder.tsx';
export { PubModal } from './PubModal.tsx';
export type { PubModalProps } from './PubModal.tsx';
export { listTheme } from './listPublishState.ts';
export { openListPublish } from './publishWindow.ts';
export { LX_THEMES } from './themes.ts';
export type {
  CardsDocument,
  CardsPhoto,
  CardsRow,
  CardsSection,
  ListKind,
  LxTheme,
} from './types.ts';
