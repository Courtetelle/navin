import type { CvTrip, MemberCv } from '../../model/memberCv.ts';
import { cvFacts, cvMiles, cvNmText, cvTrips } from '../../model/memberCv.ts';
import type { Member } from '../../model/types.ts';
import { memberName } from '../../state/index.ts';

import { WATERS_TITLE, footLine, identity, nmShown, tiles } from './cvParts.ts';

/**
 * The A4 CV: a band with the name, the totals, the navigations at sea and
 * on lakes, the licences, the boat owned.
 * @param props - The card and its CV.
 * @param props.member - The card.
 * @param props.cv - Its CV.
 * @returns The page.
 */
export function CvPage({ member, cv }: { member: Member; cv: MemberCv }) {
  const now = new Date().getFullYear();
  return (
    <div className="cv-print">
      <header className="cv-band">
        <div className="cv-kicker">CV nautique</div>
        <div className="cv-name">{memberName(member)}</div>
        <div className="cv-ident">
          {identity(member).map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </header>
      {cv.intro ? <p className="cv-intro">{cv.intro}</p> : null}
      {tiles(cv).length > 0 ? (
        <div className="cv-tiles pdf-keep">
          {tiles(cv).map(([value, label]) => (
            <div className="cv-tile" key={label}>
              <b>{value}</b>
              <small>{label}</small>
            </div>
          ))}
        </div>
      ) : null}
      {cvFacts(cv, now).length > 0 ? (
        <section>
          <h2>En bref</h2>
          <ul className="cv-facts">
            {cvFacts(cv, now).map(([question, answer]) => (
              <li key={question}>
                {question} : <b>{answer}</b>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {(['mer', 'lac'] as const).map((waters) => {
        const trips = cvTrips(cv, waters, now);
        if (trips.length === 0) return null;
        // A column nobody filled is not drawn.
        const shown = {
          when: trips.some((trip) => trip.when),
          boat: trips.some((trip) => trip.boat || trip.boatType),
          nm: trips.some((trip) => trip.nm),
        };
        const total = trips.reduce((sum, trip) => sum + cvMiles(trip.nm), 0);
        return (
          <section key={waters}>
            <h2>{WATERS_TITLE[waters]}</h2>
            <table className="cv-tbl">
              <tbody>
                {trips.map((trip) => (
                  <TripRow key={trip.id} trip={trip} shown={shown} />
                ))}
                {total ? (
                  <tr className="cv-sum">
                    {shown.when ? <td /> : null}
                    {shown.boat ? <td /> : null}
                    <td>Total</td>
                    <td className="cv-nm">{cvNmText(total)} NM</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        );
      })}
      {cv.certs?.some((cert) => cert.label) ? (
        <section>
          <h2>Brevets, certificats et formations</h2>
          <ul className="cv-certs">
            {cv.certs
              .filter((cert) => cert.label)
              .map((cert) => (
                <li key={cert.id}>
                  {cert.label}
                  {cert.when ? (
                    <>
                      <br />
                      <b>{cert.when}</b>
                    </>
                  ) : null}
                </li>
              ))}
          </ul>
          {/* The place and date go with the last block, never alone on a page. */}
          <p className="cv-foot">{footLine(cv)}</p>
        </section>
      ) : (
        <p className="cv-foot">{footLine(cv)}</p>
      )}
    </div>
  );
}

/**
 * One navigation: when, the boat and its kind, the role and the route, the
 * miles.
 * @param props - The navigation.
 * @param props.trip - The navigation.
 * @param props.shown - The columns drawn.
 * @returns The row.
 */
function TripRow({
  trip,
  shown,
}: {
  trip: CvTrip;
  shown: { when: boolean; boat: boolean; nm: boolean };
}) {
  return (
    <tr>
      {shown.when ? <td className="cv-when">{trip.when}</td> : null}
      {shown.boat ? (
        <td className="cv-boat">
          {trip.boat}
          {trip.boatType ? <small>{trip.boatType}</small> : null}
        </td>
      ) : null}
      <td className="cv-route">
        {trip.role ? (
          <>
            <span className="cv-role">{trip.role}</span>
            <br />
          </>
        ) : null}
        {trip.route}
        {trip.charter || trip.duration ? (
          <small>
            {trip.route ? ' · ' : ''}
            {[
              trip.charter ? `Compagnie Charter ${trip.charter}` : '',
              trip.duration,
            ]
              .filter(Boolean)
              .join(' · ')}
          </small>
        ) : null}
      </td>
      {shown.nm ? <td className="cv-nm">{nmShown(trip.nm)}</td> : null}
    </tr>
  );
}
