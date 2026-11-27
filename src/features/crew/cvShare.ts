import { createElement } from 'react';

import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import type { MemberCv } from '../../model/memberCv.ts';
import { cvFacts, cvTrips } from '../../model/memberCv.ts';
import type { Member } from '../../model/types.ts';
import { deliver, memberName, toast } from '../../state/index.ts';
import { sheetPng } from '../boats/index.ts';
import { printInHolder } from '../publish/index.ts';

import { CvPage } from './CvPrintPage.tsx';
import { WATERS_TITLE, footLine, identity, nmShown, tiles } from './cvParts.ts';

/** The A4 page of the CV, its colours kept in print. */
const CV_CSS = `@media print {
  main { display:none }
  @page { size: A4 portrait; margin: 0 }
  .cv-print, .cv-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact }
}
.cv-print { font: 400 10.5pt/1.35 system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #14213d }
.cv-print .cv-band { background: #0b3a6e; color: #fff; padding: 7mm 10mm 6mm; border-radius: 0 0 4mm 4mm; margin: 0 -10mm 5mm }
.cv-print .cv-kicker { font-size: 10pt; letter-spacing: .25em; text-transform: uppercase; opacity: .8 }
.cv-print .cv-name { font-size: 25pt; font-weight: 800; margin: 1mm 0 2mm }
.cv-print .cv-ident { font-size: 9.5pt; opacity: .92 }
.cv-print .cv-ident span + span::before { content: '  ·  ' }
.cv-print .cv-intro { margin: 0 0 5mm; font-style: italic }
.cv-print .cv-tiles { display: flex; gap: 3mm; margin: 0 0 4mm }
.cv-print .cv-tile { flex: 1; border: 1px solid #c9d6e8; border-radius: 3mm; padding: 3mm; text-align: center; background: #f2f6fb }
.cv-print .cv-tile b { display: block; font-size: 17pt; color: #0b3a6e }
.cv-print .cv-tile small { font-size: 8.5pt; color: #4a5a75 }
.cv-print h2 { font-size: 13pt; color: #0b3a6e; border-bottom: 2px solid #0b3a6e; padding-bottom: 1mm; margin: 4mm 0 1.5mm }
.cv-print table.cv-tbl { width: 100%; border-collapse: collapse }
.cv-print table.cv-tbl, .cv-print .cv-tbl td { border: 0 !important }
.cv-print .cv-tbl td { border-bottom: 1px solid #e1e8f2 !important; padding: 1.3mm 2mm; vertical-align: top }
.cv-print .cv-tbl tr:nth-child(even) td { background: #f7f9fc }
.cv-print .cv-when { width: 22mm; font-weight: 700; color: #0b3a6e; white-space: nowrap }
.cv-print .cv-boat { width: 38mm }
.cv-print .cv-boat small { display: block; color: #4a5a75; font-size: 8.5pt }
.cv-print .cv-role { display: inline-block; background: #e3ecf8; color: #0b3a6e; border-radius: 2mm; padding: .3mm 2mm; font-size: 8.5pt; font-weight: 700; margin-bottom: .8mm }
.cv-print .cv-route small { color: #4a5a75 }
.cv-print .cv-nm { width: 16mm; text-align: right; font-weight: 700; white-space: nowrap }
.cv-print .cv-sum td { font-weight: 700; border-bottom: 0; background: none !important }
.cv-print .cv-certs { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 6mm; margin: 0; padding: 0; list-style: none }
.cv-print .cv-certs li { border-left: 3px solid #0b3a6e; padding: .5mm 0 .5mm 3mm }
.cv-print .cv-certs b { color: #0b3a6e }
.cv-print .cv-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 6mm; margin: 0; padding: 0; list-style: none }
.cv-print .cv-facts b { color: #0b3a6e }
.cv-print .cv-foot { margin-top: 6mm; font-size: 9pt; color: #4a5a75 }`;

/**
 * Share the sailing CV of a member: a PDF for the renters, or an image.
 * @param member - The card.
 * @param format - PDF or image.
 */
export async function shareCv(
  member: Member,
  format: ShareFormat,
): Promise<void> {
  // Only what was typed: NavIn adds no navigation of its own.
  const cv = member.cv ?? {};
  const name = memberName(member);
  const file = `CV-nautique-${name}`
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .replaceAll(/[^a-z0-9]+/gi, '-');
  if (format === 'pdf') {
    printInHolder({
      className: 'print-only book lx-print cv-print',
      title: file,
      delay: 150,
      css: CV_CSS,
      content: createElement(CvPage, { member, cv }),
    });
    return;
  }
  try {
    const blob = await sheetPng({
      title: `CV nautique · ${name}`,
      checks: [],
      showObs: false,
      sections: cvSections(member, cv),
    });
    await deliver(blob, `${file}.png`, 'image/png');
  } catch {
    toast('Image impossible : partagez le PDF');
  }
}

/**
 * The CV as the sections of an image: the person, then each navigation.
 * @param member - The card.
 * @param cv - Its CV.
 * @returns The sections.
 */
function cvSections(
  member: Member,
  cv: MemberCv,
): Array<{ title: string; rows: Array<readonly [string, string]> }> {
  const now = new Date().getFullYear();
  const sections: Array<{
    title: string;
    rows: Array<readonly [string, string]>;
  }> = [];
  const who = identity(member);
  const totals = tiles(cv).map(([value, label]) => `${value} ${label}`);
  if (
    who.length > 0 ||
    totals.length > 0 ||
    cv.intro ||
    cvFacts(cv, now).length > 0
  ) {
    sections.push({
      title: memberName(member),
      rows: [
        ...(cv.intro ? [['Présentation', cv.intro] as const] : []),
        ...(who.length > 0 ? [['Contact', who.join(' · ')] as const] : []),
        ...(totals.length > 0
          ? [['En bref', totals.join(' · ')] as const]
          : []),
        ...cvFacts(cv, now),
      ],
    });
  }
  for (const waters of ['mer', 'lac'] as const) {
    const trips = cvTrips(cv, waters, now);
    if (trips.length === 0) continue;
    sections.push({
      title: WATERS_TITLE[waters],
      rows: trips.map(
        (trip) =>
          [
            trip.when ?? '',
            [
              trip.boat,
              trip.boatType,
              trip.role,
              trip.route,
              trip.charter ? `Compagnie Charter ${trip.charter}` : '',
              trip.duration,
              nmShown(trip.nm),
            ]
              .filter(Boolean)
              .join(' · '),
          ] as const,
      ),
    });
  }
  const certs = (cv.certs ?? []).filter((cert) => cert.label);
  if (certs.length > 0) {
    sections.push({
      title: 'Brevets, certificats et formations',
      rows: certs.map((cert) => [cert.when ?? '', cert.label ?? ''] as const),
    });
  }
  sections.push({ title: '', rows: [['', footLine(cv)]] });
  return sections;
}
