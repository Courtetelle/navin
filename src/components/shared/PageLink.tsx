import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';

import { Button } from './Button.tsx';

/**
 * A link to a page of NavIn, the same everywhere and unlike a link to a
 * site: a grey band with its sign, its text and a › at the right, as an
 * entry of a menu. The page opens as a menu inside the page: its ◀ comes
 * back here.
 * @param props - The page.
 * @param props.view - The page opened.
 * @param props.icon - Its sign.
 * @param props.label - Its text.
 * @param props.sub - A line under it.
 * @returns The band.
 */
export function PageLink({
  view,
  icon,
  label,
  sub,
}: {
  view: string;
  icon: string;
  label: string;
  sub?: string;
}) {
  const tr = useTr();
  return (
    <Button
      type="button"
      className="btn page-link"
      data-page-link={view}
      onClick={() => {
        buzz();
        go(view);
      }}
    >
      <span className="page-link-ico" aria-hidden="true">
        {icon}
      </span>
      <span className="page-link-txt">
        <b>{tr(label)}</b>
        {sub ? <small>{tr(sub)}</small> : null}
      </span>
      <span className="page-link-go" aria-hidden="true">
        ›
      </span>
    </Button>
  );
}
