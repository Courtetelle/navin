import { useSignals } from '@preact/signals-react/runtime';

import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { siteLinksVersion, siteShown } from '../../state/index.ts';

import { SiteLogo } from './SiteLogo.tsx';

/**
 * A link to a site, the same everywhere: a button with the sign of a site
 * and its text. Its address, and the text, are changed in data › Sites
 * Internet only; a site taken away there shows no button.
 * @param props - The link.
 * @param props.id - The site, in the list of data › Sites Internet.
 * @returns The button, or nothing.
 */
export function SiteLink({ id }: { id: string }) {
  useSignals();
  const tr = useTr();
  // Read again at each change of the list (the version is read to redraw).
  const shown = siteLinksVersion.value >= 0 ? siteShown(id) : null;
  if (!shown || shown.hidden) return null;
  return (
    <div className="site-link" data-site-link={id}>
      <a
        className="site-link-pill"
        href={shown.url}
        target="_blank"
        rel="noopener"
        onClick={() => buzz()}
      >
        <SiteLogo />
        <span>{tr(shown.label)}</span>
      </a>
    </div>
  );
}
