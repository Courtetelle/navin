import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { textOf, uid } from '../../lib/format.ts';
import type {
  CvCert,
  CvTrip,
  CvWaters,
  MemberCv,
} from '../../model/memberCv.ts';
import {
  CV_BOAT_TYPES,
  CV_ROLES,
  cvFacts,
  cvFilled,
  cvNmText,
  cvTotals,
  cvTrips,
} from '../../model/memberCv.ts';
import { toast } from '../../state/index.ts';

import { sendCvBlank } from './blankSheet.ts';
import { cvWithNavIn } from './cvNavIn.ts';
import { nmShown } from './cvParts.ts';
import { shareCv } from './cvShare.ts';
import type { FicheRecord } from './useFicheRecord.ts';

/** Props of {@link FicheCv}. */
interface FicheCvProps {
  record: FicheRecord;
  /** The card is read, not edited. */
  reading: boolean;
}

const WATERS_TITLE: Record<CvWaters, string> = {
  mer: 'Navigations en mer',
  lac: 'Navigations sur les lacs',
};

/**
 * The sailing CV of a card: its navigations at sea and on lakes, its
 * licences, and whether the member owns a boat; shared as a PDF for renters.
 * @param props - The card and its mode.
 * @returns `details.section`, none on a read card without CV.
 */
export function FicheCv({ record, reading }: FicheCvProps) {
  const tr = useTr();
  const cv = (record.data.cv ?? {}) as MemberCv;
  // The outings saved in NavIn are added to what was typed.
  const shown = cvWithNavIn(record.recordId, cv);
  const filled = cvFilled(shown);
  if (reading && !filled) return null;
  const save = (next: MemberCv) => {
    record.change({ ...record.latest(), cv: next });
    if (!record.persist()) {
      toast('Saisissez d’abord le prénom');
      record.prenomInput.current?.focus();
    }
  };
  return (
    <details className="section cv-sec" open={reading || filled}>
      <summary>{tr('⛵ CV nautique')}</summary>
      {reading ? (
        <CvReading cv={shown} />
      ) : (
        <CvEditor cv={cv} save={save} record={record} />
      )}
      {filled && record.recordId ? (
        <ButtonRow className="row ck-pub-row">
          <ShareButton
            big
            className="no-navact"
            data-cv="share"
            label="📤 Partager le CV nautique"
            onShare={(format) => {
              const card = record.persist();
              if (card) void shareCv(card, format);
            }}
          />
        </ButtonRow>
      ) : null}
    </details>
  );
}

/**
 * A CV read: its totals, then each navigation on one line.
 * @param props - The CV.
 * @param props.cv - The CV.
 * @returns The block.
 */
function CvReading({ cv }: { cv: MemberCv }) {
  const tr = useTr();
  const now = new Date().getFullYear();
  const totals = cvTotals(cv);
  const facts = cvFacts(cv, now);
  return (
    <div className="cv-read">
      {/* A read card hides the titles of its sections: the CV says its own. */}
      <h2 className="cv-read-title">{tr('⛵ CV nautique')}</h2>
      {cv.intro ? <p className="cv-intro">{cv.intro}</p> : null}
      <p className="cv-totals">
        {[
          totals.seaNm ? `${cvNmText(totals.seaNm)} NM en mer` : '',
          totals.lakeNm ? `${cvNmText(totals.lakeNm)} NM sur les lacs` : '',
          totals.skipperTrips
            ? `${totals.skipperTrips} fois skipper en mer`
            : '',
        ]
          .filter(Boolean)
          .map((part) => tr(part))
          .join(' · ')}
      </p>
      {facts.length > 0 ? (
        <>
          <h3 className="lx-sec-h">{tr('En bref')}</h3>
          <ul className="cv-list cv-facts">
            {facts.map(([question, answer]) => (
              <li key={question}>
                {tr(question)} : <b>{answer}</b>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {(['mer', 'lac'] as const).map((waters) => {
        const trips = cvTrips(cv, waters, now);
        if (trips.length === 0) return null;
        return (
          <div key={waters}>
            <h3 className="lx-sec-h">{tr(WATERS_TITLE[waters])}</h3>
            <ul className="cv-list">
              {trips.map((trip) => (
                <li key={trip.id}>
                  <b>{trip.when}</b>{' '}
                  {[
                    trip.boat,
                    trip.boatType,
                    trip.role,
                    trip.route,
                    trip.charter ? `loueur ${trip.charter}` : '',
                    trip.duration,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  {trip.nm ? (
                    <span className="cv-nm"> · {nmShown(trip.nm)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {cv.certs?.length ? (
        <>
          <h3 className="lx-sec-h">
            {tr('Brevets, certificats et formations')}
          </h3>
          <ul className="cv-list">
            {cv.certs.map((cert) => (
              <li key={cert.id}>
                {cert.label}
                {cert.when ? <b> · {cert.when}</b> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** Props of the editor parts. */
interface EditProps {
  cv: MemberCv;
  save: (next: MemberCv) => void;
}

/**
 * The CV edited: every field free, none required.
 * @param props - The CV and its saving.
 * @returns The block.
 */
function CvEditor({ cv, save, record }: EditProps & { record: FicheRecord }) {
  const tr = useTr();
  const trips = cv.trips ?? [];
  const certs = cv.certs ?? [];
  const setTrip = (id: string, patch: Partial<CvTrip>) => {
    save({
      ...cv,
      trips: trips.map((trip) =>
        trip.id === id ? { ...trip, ...patch } : trip,
      ),
    });
  };
  const setCert = (id: string, patch: Partial<CvCert>) => {
    save({
      ...cv,
      certs: certs.map((cert) =>
        cert.id === id ? { ...cert, ...patch } : cert,
      ),
    });
  };
  const addTrip = (waters: CvWaters) => {
    buzz();
    save({ ...cv, trips: [{ id: uid(), waters }, ...trips] });
  };
  return (
    <div className="cv-edit">
      <HelpText>
        Pour les loueurs de bateaux. Tout est libre : une année ou une période
        (« 1996 – 1998 », « Dès 2015 »), une phrase seule ou un bateau avec son
        rôle et ses milles. Les navigations se rangent de la plus récente à la
        plus ancienne. Les croisières en mer enregistrées dans NavIn s’ajoutent
        seules (sauf celles déjà écrites ici, même année et même bateau), et les
        sorties sur le lac en nombre de jours. Le CV peut aussi être rempli par
        la personne : « Envoyer le CV à remplir », puis sa réponse collée dans
        Les coéquipiers › Partager › « Collez ici le message complété ».
      </HelpText>
      <ButtonRow>
        <Button
          className="btn"
          data-cv="send-blank"
          onClick={() => {
            buzz();
            sendCvBlank({
              prenom: record.prenomInput.current?.value.trim(),
              nom: record.nomInput.current?.value.trim(),
              email: textOf(record.latest().email),
            });
          }}
        >
          {tr('✉️ Envoyer le CV à remplir')}
        </Button>
      </ButtonRow>
      <div className="cgrid">
        <CvText
          wide
          area
          label="Présentation (facultatif)"
          value={cv.intro}
          onChange={(intro) => save({ ...cv, intro })}
        />
      </div>
      <ButtonRow className="row c2">
        <Button
          className="btn"
          data-cv="add-mer"
          onClick={() => addTrip('mer')}
        >
          {tr('＋ Navigation en mer')}
        </Button>
        <Button
          className="btn"
          data-cv="add-lac"
          onClick={() => addTrip('lac')}
        >
          {tr('＋ Navigation sur un lac')}
        </Button>
      </ButtonRow>
      {trips.map((trip) => (
        <div className="cv-trip" key={trip.id} data-cv-trip={trip.id}>
          <ButtonRow className="row c2" choice>
            {(['mer', 'lac'] as const).map((waters) => (
              <Button
                key={waters}
                className={trip.waters === waters ? 'btn on' : 'btn'}
                onClick={() => {
                  buzz();
                  setTrip(trip.id, { waters });
                }}
              >
                {tr(waters === 'mer' ? '🌊 En mer' : '🏞 Sur un lac')}
              </Button>
            ))}
          </ButtonRow>
          <div className="cgrid">
            <CvText
              label="Année ou période"
              placeholder="ex. 2024, Dès 2015"
              value={trip.when}
              onChange={(when) => setTrip(trip.id, { when })}
            />
            <CvText
              label="Milles (NM)"
              inputMode="numeric"
              value={trip.nm}
              onChange={(nm) => setTrip(trip.id, { nm })}
            />
            <CvText
              label="Bateau"
              placeholder="ex. Dufour 530"
              value={trip.boat}
              onChange={(boat) => setTrip(trip.id, { boat })}
            />
            <CvText
              label="Type de bateau"
              list="cvTypes"
              value={trip.boatType}
              onChange={(boatType) => setTrip(trip.id, { boatType })}
            />
            <CvText
              label="Rôle à bord"
              list="cvRoles"
              value={trip.role}
              onChange={(role) => setTrip(trip.id, { role })}
            />
            <CvText
              label="Durée"
              placeholder="ex. 7 jours"
              value={trip.duration}
              onChange={(duration) => setTrip(trip.id, { duration })}
            />
            <CvText
              wide
              label="Loueur"
              placeholder="ex. Dream Yacht, Sunsail"
              value={trip.charter}
              onChange={(charter) => setTrip(trip.id, { charter })}
            />
            <CvText
              wide
              area
              label="Navigation : itinéraire, zone, régates"
              value={trip.route}
              onChange={(route) => setTrip(trip.id, { route })}
            />
          </div>
          <ButtonRow>
            <HoldDeleteButton
              className="btn danger"
              onClick={buzz}
              onDelete={() =>
                save({
                  ...cv,
                  trips: trips.filter((one) => one.id !== trip.id),
                })
              }
            >
              {tr('Effacer cette navigation')}
            </HoldDeleteButton>
          </ButtonRow>
        </div>
      ))}
      <h3 className="lx-sec-h">{tr('Brevets, certificats et formations')}</h3>
      {certs.map((cert) => (
        <div className="cv-trip" key={cert.id} data-cv-cert={cert.id}>
          <div className="cgrid">
            <CvText
              wide
              label="Brevet, certificat ou formation"
              placeholder="ex. Permis mer (hauturier)"
              value={cert.label}
              onChange={(label) => setCert(cert.id, { label })}
            />
            <CvText
              label="Année"
              value={cert.when}
              onChange={(when) => setCert(cert.id, { when })}
            />
          </div>
          <ButtonRow>
            <HoldDeleteButton
              className="btn danger"
              onClick={buzz}
              onDelete={() =>
                save({
                  ...cv,
                  certs: certs.filter((one) => one.id !== cert.id),
                })
              }
            >
              {tr('Effacer')}
            </HoldDeleteButton>
          </ButtonRow>
        </div>
      ))}
      <ButtonRow>
        <Button
          className="btn"
          data-cv="add-cert"
          onClick={() => {
            buzz();
            save({ ...cv, certs: [...certs, { id: uid() }] });
          }}
        >
          {tr('＋ Brevet, certificat ou formation')}
        </Button>
      </ButtonRow>
      <h3 className="lx-sec-h">{tr('Ce que demandent les loueurs')}</h3>
      <div className="cgrid">
        <CvText
          wide
          label="Jours de navigation par an"
          placeholder="ex. 15"
          value={cv.daysPerYear}
          onChange={(daysPerYear) => save({ ...cv, daysPerYear })}
        />
      </div>
      <CvYesNo
        question="A déjà loué un bateau comme chef de bord"
        name="charter"
        value={cv.charterSkipper}
        onChange={(charterSkipper) => save({ ...cv, charterSkipper })}
      />
      <CvYesNo
        question="Propriétaire d’un bateau (ou l’a été)"
        name="owner"
        value={cv.owner}
        onChange={(owner) => save({ ...cv, owner })}
      />
      <div className="cgrid">
        {cv.owner === 'Oui' ? (
          <>
            <CvText
              label="Depuis combien d’années"
              value={cv.ownerYears}
              onChange={(ownerYears) => save({ ...cv, ownerYears })}
            />
            <CvText
              label="Longueur"
              placeholder="ex. 7,65 m"
              value={cv.ownerLength}
              onChange={(ownerLength) => save({ ...cv, ownerLength })}
            />
            <CvText
              wide
              label="Type de bateau"
              placeholder="ex. Voilier, Surprise"
              value={cv.ownerType}
              onChange={(ownerType) => save({ ...cv, ownerType })}
            />
            <CvText
              wide
              label="Lieu"
              placeholder="ex. Port de Morges"
              value={cv.ownerPlace}
              onChange={(ownerPlace) => save({ ...cv, ownerPlace })}
            />
          </>
        ) : null}
        <CvText
          wide
          label="Lieu écrit en bas du CV"
          placeholder="ex. Lausanne"
          value={cv.place}
          onChange={(place) => save({ ...cv, place })}
        />
      </div>
      <datalist id="cvRoles">
        {CV_ROLES.map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>
      <datalist id="cvTypes">
        {CV_BOAT_TYPES.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
    </div>
  );
}

/**
 * A question answered Oui or Non; touched again, nothing is said.
 * @param props - The question, its answer and its saving.
 * @param props.question - The question.
 * @param props.name - Its key, for the tests.
 * @param props.value - Oui, Non or empty.
 * @param props.onChange - Saves the answer.
 * @returns The title and its two buttons.
 */
function CvYesNo({
  question,
  name,
  value,
  onChange,
}: {
  question: string;
  name: string;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  const tr = useTr();
  return (
    <>
      <p className="cv-question">{tr(question)}</p>
      <ButtonRow className="row c2" choice>
        {['Oui', 'Non'].map((answer) => (
          <Button
            key={answer}
            className={value === answer ? 'btn on' : 'btn'}
            data-cv-yes={`${name}-${answer}`}
            onClick={() => {
              buzz();
              onChange(value === answer ? '' : answer);
            }}
          >
            {tr(answer)}
          </Button>
        ))}
      </ButtonRow>
    </>
  );
}

/** Props of {@link CvText}. */
interface CvTextProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  wide?: boolean;
  area?: boolean;
  list?: string;
  inputMode?: 'numeric';
}

/**
 * A free field of the CV.
 * @param props - Its title, value and kind.
 * @returns `div.cf`.
 */
function CvText({
  label,
  value,
  onChange,
  placeholder,
  wide,
  area,
  list,
  inputMode,
}: CvTextProps) {
  const tr = useTr();
  return (
    <div className={wide ? 'cf wide' : 'cf'}>
      <label>
        {tr(label)}
        {area ? (
          <textarea
            className="text"
            rows={2}
            value={value ?? ''}
            placeholder={placeholder ? tr.placeholder(placeholder) : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input
            className="text"
            type="text"
            list={list}
            inputMode={inputMode}
            value={value ?? ''}
            placeholder={placeholder ? tr.placeholder(placeholder) : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </label>
    </div>
  );
}
