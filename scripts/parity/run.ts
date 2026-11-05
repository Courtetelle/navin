/**
 * Parity check between the legacy app (legacy/, served on LEGACY_URL) and the
 * React app (Vite dev server on REACT_URL).
 *
 * Usage:
 *   node scripts/parity/run.ts scripts/parity/scenarios/<file>.ts [...] [options]
 *
 * Options:
 *   --only <regex>        run only scenarios whose name matches
 *   --legacy-only         replay in the legacy app only (explore its DOM)
 *   --dump <name>         after each scenario, save the legacy localStorage as
 *                         scripts/parity/fixtures/<name>.json (implies --legacy-only)
 */
/* eslint-disable no-await-in-loop -- scenarios and steps must replay sequentially, in the same order in both apps */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { chromium } from 'playwright-core';

import { DEFAULT_SETTLE, openApp, runStep } from './browser.ts';
import { serializeDom } from './canonical.ts';
import { diffDom, diffPixels } from './compare.ts';
import type { Scenario, SnapshotResult } from './types.ts';

const LEGACY_URL = process.env.LEGACY_URL ?? 'http://localhost:4301/';
const REACT_URL = process.env.REACT_URL ?? 'http://localhost:4302/';
const OUT = resolve('parity-out');
// Internal data-* hooks are ignored unless the stylesheet selects on them.
const CSS_DATA_ATTRIBUTES =
  'theme|view|frame|val|key|b|pick|fiche|prep|photo|m|k|id|cs|cem|base';
const DEFAULT_IGNORE = `^data-(?!(${CSS_DATA_ATTRIBUTES})$)`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    only: { type: 'string' },
    'legacy-only': { type: 'boolean', default: false },
    dump: { type: 'string' },
  },
});
const legacyOnly = values['legacy-only'] || values.dump !== undefined;

const scenarios: Scenario[] = [];
for (const file of positionals) {
  const module = (await import(resolve(file))) as { scenarios: Scenario[] };
  scenarios.push(...module.scenarios);
}
const filter = values.only ? new RegExp(values.only) : null;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results: SnapshotResult[] = [];
try {
  for (const scenario of scenarios) {
    if (filter && !filter.test(scenario.name)) continue;
    results.push(...(await runScenario(scenario)));
  }
} finally {
  await browser.close();
}

let failed = 0;
for (const result of results) {
  const pass =
    !result.error && result.domDiffLines === 0 && result.pixelRatio < 0.001;
  if (!pass) failed++;
  const pixels = `${(result.pixelRatio * 100).toFixed(2)}%`;
  process.stdout.write(
    `${pass ? 'PASS' : 'FAIL'}  ${result.scenario} › ${result.snapshot}  dom:${result.domDiffLines}  px:${pixels}${result.error ? `  ${result.error}` : ''}\n`,
  );
}
process.stdout.write(
  `\n${results.length - failed}/${results.length} snapshots identical — details in ${OUT}\n`,
);
process.exitCode = failed > 0 ? 1 : 0;

async function runScenario(scenario: Scenario): Promise<SnapshotResult[]> {
  const directory = join(OUT, scenario.name.replaceAll(/[^\w.-]+/g, '_'));
  mkdirSync(directory, { recursive: true });
  const legacy = await openApp(browser, LEGACY_URL, scenario);
  const react = legacyOnly ? null : await openApp(browser, REACT_URL, scenario);
  const output: SnapshotResult[] = [];
  const settle = scenario.settle ?? DEFAULT_SETTLE;
  try {
    for (const step of scenario.steps) {
      if ('snapshot' in step) {
        output.push(await snapshot(step.snapshot));
        continue;
      }
      await runStep(legacy.page, step, false);
      if (react) await runStep(react.page, step, true);
      await legacy.page.waitForTimeout(settle);
    }
    if (values.dump) {
      const storage = await legacy.page.evaluate(() => {
        const entries: Record<string, string> = {};
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (key !== null) entries[key] = localStorage.getItem(key) ?? '';
        }
        return entries;
      });
      const parsed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(storage)) {
        try {
          parsed[key] = JSON.parse(value) as unknown;
        } catch {
          parsed[key] = value;
        }
      }
      const target = join(
        import.meta.dirname,
        'fixtures',
        `${values.dump}.json`,
      );
      writeFileSync(target, `${JSON.stringify(parsed, null, 2)}\n`);
      process.stdout.write(`dumped legacy localStorage to ${target}\n`);
    }
  } catch (error) {
    output.push({
      scenario: scenario.name,
      snapshot: '(steps)',
      domDiffLines: 0,
      pixelRatio: 0,
      error:
        error instanceof Error
          ? error.message.split('\n', 1)[0]
          : String(error),
    });
  } finally {
    await legacy.close();
    await react?.close();
  }
  return output;

  async function snapshot(name: string): Promise<SnapshotResult> {
    const base = join(directory, name.replaceAll(/[^\w.-]+/g, '_'));
    const ignore = scenario.ignoreAttributes ?? DEFAULT_IGNORE;
    const legacyDom = await legacy.page.evaluate(serializeDom, ignore);
    const legacyPng = await legacy.page.screenshot({
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
    });
    writeFileSync(`${base}.legacy.txt`, legacyDom);
    writeFileSync(`${base}.legacy.png`, legacyPng);
    const errors = [...legacy.errors.map((message) => `legacy: ${message}`)];
    if (!react) {
      return {
        scenario: scenario.name,
        snapshot: name,
        domDiffLines: 0,
        pixelRatio: 0,
        error: errors.join(' | ') || undefined,
      };
    }
    const reactDom = await react.page.evaluate(serializeDom, ignore);
    const reactPng = await react.page.screenshot({
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
    });
    writeFileSync(`${base}.react.txt`, reactDom);
    writeFileSync(`${base}.react.png`, reactPng);
    const { patch, changedLines } = diffDom(legacyDom, reactDom);
    writeFileSync(`${base}.diff`, patch);
    const { ratio, image } = diffPixels(legacyPng, reactPng);
    writeFileSync(`${base}.pixels.png`, image);
    errors.push(...react.errors.map((message) => `react: ${message}`));
    return {
      scenario: scenario.name,
      snapshot: name,
      domDiffLines: changedLines,
      pixelRatio: ratio,
      error: errors.join(' | ') || undefined,
    };
  }
}
