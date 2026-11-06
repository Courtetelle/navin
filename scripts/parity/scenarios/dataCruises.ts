import type { Scenario, Step } from '../types.ts';

import {
  CLOCK_TICKED,
  FIXTURES,
  QUIET,
  SHOW_STORAGE,
  enter,
  screen,
  snap,
} from './dataSteps.ts';

// A finger sliding the first navigation of the list to the left.
const SWIPE_FIRST_CRUISE: Step = {
  eval: `{
    const row = document.querySelector('article.entry .when');
    const { x, y, width } = row.getBoundingClientRect();
    const finger = (type, clientX) => new PointerEvent(type, {
      bubbles: true, composed: true, pointerId: 1, isPrimary: true, clientX, clientY: y + 5,
    });
    const right = x + width - 10;
    row.dispatchEvent(finger('pointerdown', right));
    row.dispatchEvent(finger('pointermove', right - 40));
    row.dispatchEvent(finger('pointermove', right - 120));
    row.dispatchEvent(finger('pointerup', right - 120));
  }`,
};

/** Data menu and navigation list: modes, form, creation, opening, deletion. */
export const cruiseScenarios: Scenario[] = [
  // Data menu.
  ...FIXTURES.map((fixture) => screen('more', fixture, 'more')),
  {
    name: 'data-more-order',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('more'),
      { click: '[data-tile="log"]' },
      ...enter('more'),
      { click: '[data-tile="log"]' },
      ...enter('more'),
      { click: '[data-tile="soslogs"]' },
      ...enter('more'),
      ...snap('bumped'),
    ],
  },
  // Cruises.
  ...FIXTURES.map((fixture) => screen('cruises', fixture, 'cruises')),
  {
    name: 'data-cruises-modes',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: 'section.field h2' },
      ...snap('unfolded'),
      { click: '[data-type="mer"]' },
      ...snap('sea'),
      { click: 'section.field h2' },
      { click: '[data-zone="A"]' },
      ...snap('atlantic'),
      { click: '[data-type="lacc"]' },
      ...snap('lake-cruise'),
      { click: 'section.field h2' },
      { click: '[data-boat="exb2"]' },
      ...snap('other-boat'),
      { click: '[data-type="lacj"]' },
      { click: '[data-purpose="Location"]' },
      ...snap('rental'),
      ...enter('cruises'),
      ...snap('back'),
    ],
  },
  {
    name: 'data-cruises-fields',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: 'section.field h2' },
      { fill: '#newPlace', value: ' Split ' },
      ...snap('place'),
      { click: '#keepBoat' },
      ...snap('without-boat'),
      { click: '#keepBoat' },
      ...snap('with-boat'),
      { click: '#keepCrew' },
      ...snap('with-crew'),
      { click: '[data-zone="N"]' },
      ...snap('redrawn'),
      { fill: '#newName', value: 'Ma croisière' },
      { click: '[data-zone="B"]' },
      ...snap('typed-name'),
      ...enter('more'),
      ...enter('cruises'),
      ...snap('name-gone'),
    ],
  },
  {
    name: 'data-cruises-gps',
    fixture: 'sample',
    overrides: QUIET,
    geolocation: { latitude: 46.507, longitude: 6.626 },
    steps: [
      ...enter('cruises'),
      { click: 'section.field h2' },
      { wait: 4000 },
      ...snap('lake-port'),
    ],
  },
  {
    name: 'data-cruises-gps-sea',
    fixture: 'empty',
    overrides: QUIET,
    geolocation: { latitude: 49.6, longitude: -1.6 },
    steps: [...enter('cruises'), { wait: 300 }, ...snap('sea-zone')],
  },
  {
    name: 'data-cruises-create-lake',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: 'section.field h2' },
      { click: '[data-boat="exb1"]' },
      { click: '[data-purpose="Invitation"]' },
      { fill: '#newPlace', value: 'Morges' },
      { click: '#keepCrew' },
      { click: '#createBtn' },
      ...enter('cruises'),
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('created'),
    ],
  },
  {
    name: 'data-cruises-create-sea',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: 'section.field h2' },
      { click: '[data-zone="A"]' },
      { click: '#keepCrew' },
      { click: '#createBtn' },
      { wait: 300 },
      ...enter('cruises'),
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('created'),
    ],
  },
  {
    name: 'data-cruises-create-empty',
    fixture: 'empty',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: 'section.field h2' },
      { fill: '#newName', value: 'Grèce 2027' },
      { click: '#createBtn' },
      { wait: 300 },
      CLOCK_TICKED,
      ...snap('info'),
      SHOW_STORAGE,
      ...snap('stored'),
    ],
  },
  {
    name: 'data-cruises-open',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: '[data-type="mer"]' },
      { click: '[data-act="open"]' },
      ...enter('cruises'),
      CLOCK_TICKED,
      ...snap('opened'),
      { click: '[data-act="info"]' },
      ...snap('info'),
    ],
  },
  {
    name: 'data-cruises-delete',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: '[data-act="del"]' },
      ...snap('armed'),
      { click: '[data-act="del"]' },
      ...snap('asked'),
      { longpress: '[data-act="del"]' },
      { wait: 500 },
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('deleted'),
    ],
  },
  {
    name: 'data-cruises-swipe',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      SWIPE_FIRST_CRUISE,
      { wait: 200 },
      ...snap('confirm'),
      { longpress: '[data-swok]' },
      { wait: 500 },
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('deleted'),
    ],
  },
  {
    name: 'data-cruises-links',
    fixture: 'empty',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: '[data-go-settings]' },
      { wait: 200 },
      ...snap('settings'),
    ],
  },
];
