import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useLayoutEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { MasterCheck } from '../../components/shared/MasterCheck.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useIntroLead } from '../../components/shared/introLead.ts';
import { prepReportCache } from '../../features/boats/index.ts';
import { printBook } from '../../features/data/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { isLake, state, toast } from '../../state/index.ts';

import type { PrintPageChoice } from './printPages.ts';
import {
  defaultSelection,
  keepPrintSelection,
  printPages,
  printSelection,
  setPrintSelection,
} from './printPages.ts';

const TITLE = 'Partager le livre de bord';
const HELP =
  'Cochez les pages, puis « 📤 Partager ». Dans la fenêtre qui s’ouvre, choisissez « Enregistrer en PDF » (ou une imprimante).';

/**
 * Screen `print` (legacy `VIEWS.print`): choose the pages of the log book, then
 * publish them as an A4 PDF.
 * @returns The screen.
 */
export function PrintPage() {
  useSignals();
  const tr = useTr();
  const cruise = state.data.cruise.value;
  const pages = cruise ? printPages(cruise) : [];
  const selected = printSelection.value ?? defaultSelection(pages);
  // A choice redraws the page: its introduction is no longer a fresh entry.
  const [touched, setTouched] = useState(false);
  const fresh = useIntroLead('print', TITLE);
  useLayoutEffect(() => {
    keepPrintSelection(selected);
  }, [selected]);
  const lake = isLake();
  useEffect(() => {
    if (lake) prepReportCache();
  }, [lake, selected]);
  const select = (next: ReadonlySet<string>) => {
    buzz();
    setTouched(true);
    setPrintSelection(next);
  };
  const checked = pages.filter((page) => selected.has(page.id)).length;
  const publish = () => {
    buzz();
    if (selected.size === 0) {
      toast('Choisissez au moins une page');
      return;
    }
    printBook(
      pages.filter((page) => selected.has(page.id)).map((page) => page.id),
    );
  };
  return (
    <>
      <PageTitle helps={[HELP]} atTop={!touched}>
        {TITLE}
      </PageTitle>
      <p
        className={
          fresh && !touched ? 'help lx-sec-h help-lead' : 'help lx-sec-h'
        }
      >
        {tr('Réglages de l’envoi · pages', { help: true })}
      </p>
      {pages.some((page) => page.day) ? (
        <ButtonRow style={{ marginBottom: '12px' }}>
          <Button
            className="btn"
            data-sel="days"
            onClick={() => {
              select(
                new Set(
                  pages.filter((page) => page.day).map((page) => page.id),
                ),
              );
            }}
          >
            {tr('Journées seulement')}
          </Button>
        </ButtonRow>
      ) : null}
      <div className="checks">
        <MasterCheck
          checked={checked}
          total={pages.length}
          attribute="data-sel-all"
          onClick={() => {
            select(
              selected.size === pages.length
                ? new Set()
                : new Set(pages.map((page) => page.id)),
            );
          }}
        />
        {pages.map((page) => (
          <PageCheck
            key={page.id}
            page={page}
            on={selected.has(page.id)}
            onToggle={() => {
              const next = new Set(selected);
              if (!next.delete(page.id)) next.add(page.id);
              select(next);
            }}
          />
        ))}
      </div>
      <ButtonRow className="save-bar row ck-pub-row">
        <Button className="btn big ck-pub" id="doPrint" onClick={publish}>
          {tr('📤 Partager')}
          <small>
            {tr(
              `PDF A4 · ${selected.size} page${selected.size > 1 ? 's' : ''}`,
            )}
          </small>
        </Button>
      </ButtonRow>
    </>
  );
}

interface PageCheckProps {
  page: PrintPageChoice;
  on: boolean;
  onToggle: () => void;
}

function PageCheck({ page, on, onToggle }: PageCheckProps) {
  const tr = useTr();
  return (
    <Button
      className={on ? 'btn check on' : 'btn check'}
      data-p={page.id}
      onClick={onToggle}
    >
      <span className="box">{on ? '✔' : ''}</span>
      {tr(page.sub ? `${page.label} ` : page.label)}
      {page.sub ? <small>{tr(page.sub)}</small> : null}
    </Button>
  );
}
