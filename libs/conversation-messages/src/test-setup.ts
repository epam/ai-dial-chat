// jsdom does not implement IntersectionObserver; the ui-kit tooltip relies on it.
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: class {
    root: Element | Document | null = null;
    rootMargin = '';
    thresholds: ReadonlyArray<number> = [];
    scrollMargin = '';
    disconnect() {
      return undefined;
    }
    observe() {
      return undefined;
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    unobserve() {
      return undefined;
    }
  },
});
