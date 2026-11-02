/*
 * jsdom ships no IntersectionObserver, and the ui-kit `Dropdown` observes its
 * own trigger to close on scroll-out. A no-op stub is enough: nothing in these
 * tests depends on the observer firing, only on constructing one not throwing.
 */
class NoopIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: readonly number[] = [];
  readonly scrollMargin: string = '';
  /* eslint-disable @typescript-eslint/no-empty-function -- a stub observer observes nothing */
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  /* eslint-enable @typescript-eslint/no-empty-function */
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (!('IntersectionObserver' in globalThis)) {
  globalThis.IntersectionObserver =
    NoopIntersectionObserver as unknown as typeof IntersectionObserver;
}
