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

/**
 * A small box over the map to type the course and the distance of the
 * dividers' arrow; OK places it, ✖ or a touch outside closes the box.
 * @param course - Course shown, degrees.
 * @param nm - Distance shown, nautical miles.
 * @param onChosen - Gets the course and the distance typed.
 */
export function openRulerEditor(
  course: number,
  nm: number,
  onChosen: (course: number, nm: number) => void,
): void {
  document.querySelector('.ruler-edit')?.remove();
  const back = document.createElement('div');
  back.className = 'ruler-edit';
  back.innerHTML = `
    <form class="ruler-edit-box">
      <label>Cap (°)<input name="course" inputmode="numeric" autocomplete="off"></label>
      <label>Distance (NM)<input name="nm" inputmode="decimal" autocomplete="off"></label>
      <p class="ruler-edit-note">Depuis l’autre pointe, vers la flèche</p>
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
  const close = () => back.remove();
  back.addEventListener('click', (event) => {
    if (event.target === back) close();
  });
  back.querySelector('[data-close]')?.addEventListener('click', close);
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
