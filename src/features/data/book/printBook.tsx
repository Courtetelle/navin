import type { ReactNode } from 'react';

import { activeFields, fileName, isLake, state } from '../../../state/index.ts';
import {
  CachedPrepReportPage,
  pickSheet,
  sheetData,
} from '../../boats/index.ts';
import { printInHolder } from '../../publish/index.ts';

import {
  BlankPage,
  CrewListPage,
  SafetyPage,
  TechPage,
  TitlePage,
} from './BookPages.tsx';
import { DayPage } from './DayPage.tsx';
import { LiveSheetPage, SheetPage } from './LakeDayPages.tsx';
import { RadioPage } from './RadioPage.tsx';

/**
 * Print the chosen pages of the log book (legacy `printBook`): A4, portrait on
 * a lake and landscape at sea, the browser offers to save a PDF.
 * @param ids - Page ids: `title`, `tech`, `crew`, `safety`, `radio`, `day:<key>`, `prep`, `blank`.
 */
export function printBook(ids: readonly string[]): void {
  const lake = isLake();
  const pages: ReactNode[] = [];
  for (const id of ids) pages.push(bookPage(id));
  // Printing a sea day leaves the day sheet on today.
  if (!lake && ids.some((id) => id.startsWith('day:'))) {
    state.view.currentDay.value = null;
  }
  printInHolder({
    className: 'print-only book',
    content: pages,
    title: fileName('', 'pdf').replace(/\.pdf$/, ''),
    css: `@media print { main { display:none } @page { size: A4 ${lake ? 'portrait' : 'landscape'}; margin: 8mm } }`,
  });
}

function bookPage(id: string): ReactNode {
  const cruise = state.data.cruise.value;
  if (!cruise) return null;
  const columns = activeFields().filter((field) => field.key !== 't');
  if (id === 'title') return <TitlePage key={id} cruise={cruise} />;
  if (id === 'tech') return <TechPage key={id} cruise={cruise} />;
  if (id === 'crew') return <CrewListPage key={id} cruise={cruise} />;
  if (id === 'safety') return <SafetyPage key={id} cruise={cruise} />;
  if (id === 'radio') return <RadioPage key={id} cruise={cruise} />;
  if (id === 'blank') return <BlankPage key={id} columns={columns} />;
  if (id === 'prep') return <CachedPrepReportPage key={id} />;
  if (!id.startsWith('day:')) return null;
  const dayId = id.slice(4);
  if (!isLake()) {
    return <DayPage key={id} cruise={cruise} dayId={dayId} columns={columns} />;
  }
  const live =
    state.view.currentView.value === 'sheet'
      ? document.querySelector('#sheet')
      : null;
  if (live) return <LiveSheetPage key={id} sheet={live} />;
  return <SheetPage key={id} sheet={pickSheet(sheetData(dayId), dayId)} />;
}
