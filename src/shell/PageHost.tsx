import { useSignals } from '@preact/signals-react/runtime';
import type { ErrorInfo, ReactNode } from 'react';
import { Component, Suspense, useLayoutEffect } from 'react';

import { noteError } from '../storage/errLog.ts';

import { errorContext } from './errorContext.ts';
import { pages } from './pageRegistry.ts';
import { blankedNavigation } from './parityHook.ts';
import { navigation } from './router.ts';
import type { ViewName } from './routing.ts';
import { VIEW_NAMES } from './routing.ts';
import { UiEditScopeContext } from './uiEdit/scope.ts';

/**
 * The current screen, remounted on every `go` (legacy views were re-rendered
 * from scratch), loaded lazily and isolated by an error boundary.
 * @returns The page element.
 */
export function PageHost() {
  useSignals();
  const current = navigation.value;
  useLayoutEffect(() => {
    globalThis.scrollTo(0, 0);
  }, [current.id]);
  if (current.id === 0 || !isViewName(current.view)) return null;
  if (blankedNavigation.value === current.id) return null;
  const Page = pages[current.view];
  return (
    <PageBoundary key={current.id} view={current.view}>
      <UiEditScopeContext value="view">
        <Suspense fallback={null}>
          <Page arg={current.arg} from={current.from} />
        </Suspense>
      </UiEditScopeContext>
    </PageBoundary>
  );
}

interface PageBoundaryProps {
  view: string;
  children: ReactNode;
}

interface PageBoundaryState {
  failed: boolean;
}

/** Keeps the chrome alive when a page throws while loading or rendering. */
class PageBoundary extends Component<PageBoundaryProps, PageBoundaryState> {
  override state: PageBoundaryState = { failed: false };

  static getDerivedStateFromError(): PageBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    noteError(
      `page ${this.props.view}: ${error instanceof Error ? error.message : String(error)}`,
      info.componentStack?.split('\n', 2)[1]?.trim() ?? '',
      errorContext,
    );
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

function isViewName(view: string): view is ViewName {
  return (VIEW_NAMES as readonly string[]).includes(view);
}
