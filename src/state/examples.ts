import { EXAMPLE_BOATS } from '../model/boatSeeds.ts';
import { EXAMPLE_MEMBERS } from '../model/memberSeeds.ts';
import type { Cruise } from '../model/types.ts';
import { store } from '../storage/store.ts';

import { saveBoats } from './boats.ts';
import { EXAMPLE_CREW_IDS, saveCrewSets } from './crewSets.ts';
import { data } from './data.ts';
import { EXAMPLE_MARK_NOTES, saveMarks } from './marks.ts';
import { saveMembers } from './members.ts';

/**
 * Remove once the example records an earlier version copied on the device: boats,
 * people, crews and marks. An example used by an outing or by another crew, or
 * renamed, is kept: it holds data of the user. A copy of what was there stays in
 * `ldb.prePurge`.
 */
export function purgeExamples(): void {
  if (store.get('ldb.exPurged', false)) return;
  store.setRaw(
    'ldb.prePurge',
    JSON.stringify({
      t: new Date().toISOString(),
      boats: data.boats.value,
      members: data.members.value,
      crewSets: data.crewSets.value,
      marks: data.marks.value,
    }),
  );
  const cruises = data.index.value
    .map((meta) => store.get<Cruise | null>(`ldb.cruise.${meta.id}`, null))
    .filter((cruise) => cruise !== null);
  const usedBoats = new Set(cruises.map((cruise) => cruise.boatId));
  const exampleBoats = new Map(
    EXAMPLE_BOATS.map((boat) => [boat.id, boat.info.boat]),
  );
  data.boats.value = data.boats.value.filter(
    (boat) =>
      !exampleBoats.has(boat.id) ||
      usedBoats.has(boat.id) ||
      boat.info.boat !== exampleBoats.get(boat.id),
  );
  data.crewSets.value = data.crewSets.value.filter(
    (set) => EXAMPLE_CREW_IDS[set.id] !== set.name,
  );
  const usedMembers = new Set<unknown>();
  for (const cruise of cruises) {
    for (const line of cruise.crew) usedMembers.add(line.memberId);
  }
  for (const set of data.crewSets.value) {
    for (const line of set.crew) usedMembers.add(line.memberId);
  }
  const exampleMembers = new Map(
    EXAMPLE_MEMBERS.map((member) => [member.id, member.nom]),
  );
  data.members.value = data.members.value.filter(
    (member) =>
      !exampleMembers.has(member.id) ||
      usedMembers.has(member.id) ||
      member.nom !== exampleMembers.get(member.id),
  );
  data.marks.value = data.marks.value.filter(
    (mark) => EXAMPLE_MARK_NOTES[mark.id] !== mark.note,
  );
  saveBoats(true);
  saveCrewSets();
  saveMembers(true);
  saveMarks();
  store.set('ldb.exPurged', true);
}
