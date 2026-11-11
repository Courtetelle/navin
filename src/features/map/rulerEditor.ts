import { buzz } from '../../lib/dom.ts';

/**
 * Read a number typed with a comma or a point.
 * @param text - What was typed.
 * @returns The number, or `null` when it is not one.
 */
export function readNumber(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) ? value : null;
}

/**
 * Whether a course and a distance can place the arrow.
 * @param course - Degrees, 0 to 360.
 * @param nm - Nautical miles, above 0, at most 1000.
 * @returns They are usable.
 */
export function validCourse(course: number | null, nm: number | null): boolean {
  return (
    course !== null &&
    nm !== null &&
    course >= 0 &&
    course <= 360 &&
    nm > 0 &&
    nm <= 1000
  );
}

const KM_PER_NM = 1.852;

/**
 * The course the other way.
 * @param course - Degrees.
 * @returns The reciprocal course, 0 to 359.
 */
export function reverseCourse(course: number): number {
  return Math.round((((course + 180) % 360) + 360) % 360);
}

/**
 * A distance in nautical miles, in kilometres.
 * @param nm - Nautical miles, as typed.
 * @returns For example « = 33,3 km », or empty when it is not a distance.
 */
export function kmText(nm: number | null): string {
  if (nm === null || nm <= 0) return '';
  const km = nm * KM_PER_NM;
  const digits = km < 10 ? 2 : 1;
  return `= ${km.toFixed(digits).replace('.', ',')} km`;
}

/**
 * A small box over the map to type the course and the distance of the
 * dividers' arrow; OK places it, ✖ or a touch outside closes the box.
 * @param course - Course shown, degrees.
 * @param nm - Distance shown, nautical miles.
 * @param onChosen - Gets the course and the distance typed.
 * @param onFlip - The arrow goes to the other point.
 */
export function openRulerEditor(
  course: number,
  nm: number,
  onChosen: (course: number, nm: number) => void,
  onFlip: () => void,
): void {
  document.querySelector('.ruler-edit')?.remove();
  const back = document.createElement('div');
  back.className = 'ruler-edit';
  back.innerHTML = `
    <form class="ruler-edit-box">
      <label>Cap (°)<input name="course" inputmode="numeric" autocomplete="off"></label>
      <label>Distance (NM)<input name="nm" inputmode="decimal" autocomplete="off"></label>
      <p class="ruler-edit-km" aria-live="polite"></p>
      <p class="ruler-edit-note">Depuis l’autre pointe, vers la flèche</p>
      <button type="button" class="btn ruler-flip" data-flip>⇄ Inverser la flèche</button>
      <div class="row c2">
        <button type="button" class="btn" data-close>✖ Annuler</button>
        <button type="submit" class="btn primary">✔ Placer</button>
      </div>
    </form>`;
  const form = back.querySelector('form') as HTMLFormElement;
  const courseInput = form.elements.namedItem('course') as HTMLInputElement;
  const nmInput = form.elements.namedItem('nm') as HTMLInputElement;
  courseInput.value = String(course).padStart(3, '0');
  nmInput.value = nm.toFixed(nm < 10 ? 2 : 1).replace('.', ',');
  const km = form.querySelector('.ruler-edit-km') as HTMLElement;
  const showKm = () => {
    km.textContent = kmText(readNumber(nmInput.value));
  };
  showKm();
  nmInput.addEventListener('input', showKm);
  const close = () => back.remove();
  back.addEventListener('click', (event) => {
    if (event.target === back) close();
  });
  back.querySelector('[data-close]')?.addEventListener('click', close);
  back.querySelector('[data-flip]')?.addEventListener('click', () => {
    buzz();
    onFlip();
    const typed = readNumber(courseInput.value);
    if (typed !== null) {
      courseInput.value = String(reverseCourse(typed)).padStart(3, '0');
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const typedCourse = readNumber(courseInput.value);
    const typedNm = readNumber(nmInput.value);
    if (!validCourse(typedCourse, typedNm)) {
      form.classList.add('ruler-edit-bad');
      return;
    }
    close();
    onChosen((typedCourse as number) % 360, typedNm as number);
  });
  document.body.append(back);
  courseInput.focus();
  courseInput.select();
}
