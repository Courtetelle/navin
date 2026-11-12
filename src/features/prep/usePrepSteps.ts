import { createElement, useLayoutEffect, useMemo } from 'react';

import type { NavStepsConfig } from '../../shell/navbar/navBarState.ts';
import { useNavSteps } from '../../shell/navbar/navHooks.ts';

import { PrepLineTitles, PrepPills } from './PrepPills.tsx';
import {
  prepBarBack,
  prepBarNext,
  prepBrowseNext,
  prepJump,
  prepReset,
} from './prepFlow.ts';
import type { PrepLineItem, PrepPill } from './prepLine.ts';
import { prepLineItems, prepPills } from './prepLine.ts';
import { prunePrepPaths } from './prepPaths.ts';
import type { PrepFlow } from './prepTypes.ts';

/** What the page adds to the steps of the nav bar. */
interface PrepStepsOptions {
  /**
   * The PréP bar is shown with its buttons.
   * @default false
   */
  bar?: boolean;
}

/**
 * Put the PréP steps in the nav bar: pills, line of step titles and buttons.
 * The nav bar keeps them as they are when the PréP ends, so they are values,
 * not components reading the state.
 * @param prep - PréP flow.
 * @param options - PréP bar.
 * @returns The pills, for the `.prep-steps` of the caller.
 */
export function usePrepSteps(
  prep: PrepFlow,
  { bar = false }: PrepStepsOptions,
): PrepPill[] {
  const pills = prepPills(prep);
  const snapshot = JSON.stringify({ pills, items: prepLineItems(prep) });
  const config = useMemo<NavStepsConfig>(() => {
    const parsed = JSON.parse(snapshot) as {
      pills: PrepPill[];
      items: PrepLineItem[];
    };
    return {
      pills: createElement(PrepPills, { pills: parsed.pills }),
      line: createElement(PrepLineTitles, { items: parsed.items }),
      onBrowseNext: prepBrowseNext,
      onReset: prepReset,
      onPill: prepJump,
      prepBar: bar ? { onNext: prepBarNext, onBack: prepBarBack } : undefined,
    };
  }, [snapshot, bar]);
  useNavSteps(config);
  const lake = prep.type !== 'mer';
  useLayoutEffect(() => {
    if (lake) prunePrepPaths();
  }, [lake, snapshot]);
  return pills;
}
