import { vi } from 'vitest';

vi.stubGlobal(
  'IntersectionObserver',
  class IntersectionObserverMock {
    disconnect = vi.fn();
    observe = vi.fn();
    takeRecords = vi.fn(() => []);
    unobserve = vi.fn();
  },
);
