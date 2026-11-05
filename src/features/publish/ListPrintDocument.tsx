import type { ReactElement, ReactNode } from 'react';

import { useCaptionLight } from '../../components/shared/useCaptionLight.ts';
import { fmtShortDate } from '../../lib/format.ts';

import { stripName } from './listDocument.ts';
import type {
  CardsDocument,
  PublishItem,
  PublishPhoto,
  PublishSection,
} from './types.ts';

/** Props of {@link ListPrintDocument}. */
export interface ListPrintDocumentProps {
  /** Title, kicker and subtitle. */
  sheet: Pick<CardsDocument, 'title' | 'kicker' | 'sub'>;
  /** Elements to print. */
  list: readonly PublishItem[];
  /** Data URL of each photo. */
  urls: ReadonlyMap<string, string>;
  /** Data URL of each thumbnail, by element id. */
  avatars: ReadonlyMap<string, string>;
}

/**
 * The A4 document of a list: `.lx-doc` with its header, one `.lx-item` per
 * element, and the footer.
 * @param props - Texts, elements and pictures.
 * @returns The `section.pg.lx-doc`.
 */
export function ListPrintDocument({
  sheet,
  list,
  urls,
  avatars,
}: ListPrintDocumentProps): ReactElement {
  const one = list.length === 1;
  const [first] = list;
  const firstAvatar = first ? avatars.get(first.id) : undefined;
  return (
    <section className="pg lx-doc">
      <header className={one && firstAvatar ? 'lx-hd lx-hd-av' : 'lx-hd'}>
        {one && first ? <Avatar item={first} avatars={avatars} /> : null}
        <div className="lx-k">
          ⛵ NAVIN{sheet.kicker ? ` · ${sheet.kicker}` : ''}
        </div>
        <h1>{sheet.title}</h1>
        <p>{sheet.sub}</p>
      </header>
      {list.map((item) => (
        <div key={item.id} className="lx-item">
          {cardsOf(item, one, avatars)}
          <Photos item={item} one={one} urls={urls} />
        </div>
      ))}
      <footer className="lx-ft">NavIn · {fmtShortDate(new Date())}</footer>
    </section>
  );
}

function Avatar({
  item,
  avatars,
}: {
  item: PublishItem;
  avatars: ReadonlyMap<string, string>;
}): ReactElement | null {
  const url = avatars.get(item.id);
  if (!url) return null;
  return (
    <img
      className={item.faceRect ? 'lx-av lx-av-rect' : 'lx-av'}
      src={url}
      alt=""
    />
  );
}

function Card({
  item,
  section,
  one,
  avatar,
  avatars,
}: {
  item: PublishItem;
  section: PublishSection;
  one: boolean;
  avatar: boolean;
  avatars: ReadonlyMap<string, string>;
}): ReactElement {
  const title = one ? stripName(section.title, item.name) : section.title;
  let heading: ReactNode = null;
  if (avatar) {
    heading = (
      <h2 className="lx-h2-av">
        <Avatar item={item} avatars={avatars} />
        {title || item.name}
      </h2>
    );
  } else if (title) {
    heading = <h2>{title}</h2>;
  }
  return (
    <section className="lx-card">
      {heading}
      <div className="lx-rows">{rowsOf(section)}</div>
    </section>
  );
}

function cardsOf(
  item: PublishItem,
  one: boolean,
  avatars: ReadonlyMap<string, string>,
): ReactElement[] {
  const cards: ReactElement[] = [];
  for (const [position, section] of item.sections.entries()) {
    cards.push(
      <Card
        key={position}
        item={item}
        section={section}
        one={one}
        avatar={!one && position === 0 && avatars.has(item.id)}
        avatars={avatars}
      />,
    );
  }
  return cards;
}

function rowsOf(section: PublishSection): ReactElement[] {
  const rows: ReactElement[] = [];
  for (const [position, [label, value]] of section.rows.entries()) {
    rows.push(
      <div key={position} className="lx-r">
        <b>{label}</b>
        <span>{linesOf(value)}</span>
      </div>,
    );
  }
  return rows;
}

function linesOf(value: string): ReactNode[] {
  const lines: ReactNode[] = [];
  for (const [position, line] of value.split('\n').entries()) {
    if (position > 0) lines.push(<br key={position} />);
    lines.push(line);
  }
  return lines;
}

function Photos({
  item,
  one,
  urls,
}: {
  item: PublishItem;
  one: boolean;
  urls: ReadonlyMap<string, string>;
}): ReactElement | null {
  const photos = (item.photos ?? []).filter((photo) => urls.has(photo.id));
  if (photos.length === 0) return null;
  return (
    <section className="lx-card lx-phs">
      <h2>{`${one ? '' : `${item.name} · `}Photos`}</h2>
      {photos.map((photo) => (
        <Photo
          key={photo.id}
          photo={photo}
          url={urls.get(photo.id) as string}
        />
      ))}
    </section>
  );
}

function Photo({
  photo,
  url,
}: {
  photo: PublishPhoto;
  url: string;
}): ReactElement {
  const { className, onLoad } = useCaptionLight('lx-ph');
  return (
    <figure className={className}>
      <img src={url} alt="" onLoad={onLoad} />
      <figcaption>{photo.cap}</figcaption>
    </figure>
  );
}
